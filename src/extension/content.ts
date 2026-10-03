import {
  DEFAULT_WATCHER_STATE,
  WATCHER_STORAGE_KEY,
  ADS_SKIPPED_KEY,
  SELECTORS_STALE_KEY,
  SKIP_MODE_KEY,
  DEFAULT_SKIP_MODE,
  isSkipMode,
  type SkipMode,
} from "@/constants/storage";
import { resolveBrowserApi } from "./shared/browserApi";
import { logDebug, logWarn } from "./shared/logger";
import { onStorageChanged, storageGet, storageSet } from "./shared/storage";
import {
  AD_SKIP_SELECTORS,
  AD_CLASS_NAMES,
  AD_INDICATOR_SELECTORS,
  BLUR_OVERLAY_ID,
  HIGHLIGHT_OVERLAY_ID,
  INJECTED_STYLE_ID,
  TOAST_ID,
  FALLBACK_SKIP_SELECTORS,
  MAX_HEURISTIC_LABEL_LENGTH,
  OVERLAY_CLOSE_SELECTORS,
  PLAYER_SELECTOR,
  SKIP_EXCLUDE_KEYWORDS,
  SKIP_KEYWORDS,
  SURVEY_SKIP_SELECTORS,
  VIDEO_PLAYER_SELECTOR,
} from "./shared/skipSelectors";

/** Safety-net polling only. MutationObserver is the primary mechanism. */
const SAFETY_NET_INTERVAL_MS = 1000;
/** If an ad runs this long with no matching skip button, selectors may be stale. */
const STALE_SELECTOR_THRESHOLD_MS = 20000;
const COUNTER_UPDATE_DELAY_MS = 2000;
/** Wait after a click before deciding whether the ad really went away. */
const SKIP_VERIFICATION_DELAY_MS = 900;
/** A real skip works at once; don't re-click the same element every tick. */
const CLICK_COOLDOWN_MS = 1500;

/** Only a precise video-ad skip is eligible for the Ads Skipped counter. */
type SkipClickSource = "ad-skip" | "auxiliary" | "fallback" | null;

class AutoSkipWatcher {
  private observer: MutationObserver | null = null;
  private intervalId: number | null = null;
  private isEnabled = DEFAULT_WATCHER_STATE;
  private readonly api = resolveBrowserApi();

  // Feature settings
  private muteAdSound = true;
  private blurAds = false;
  private skipMode: SkipMode = DEFAULT_SKIP_MODE;

  // Auto mode: one in-flight trusted click at a time.
  private trustedClickPending = false;

  // Ad state
  private isAdPlaying = false;
  private adStartedAt = 0;
  private adCounterIncremented = false;
  private staleSignalSent = false;

  // Mute state: a single boolean is enough, video.volume is never touched.
  private wasMutedBeforeAd: boolean | null = null;

  // Counter throttling
  private pendingCounterUpdate = false;
  private lastCounterUpdate = 0;

  private contextInvalidated = false;

  constructor() {
    void this.bootstrap();
  }

  private async bootstrap() {
    try {
      await this.readInitialState();
      await this.loadFeatureSettings();
      this.listenToStorage();

      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            if (this.isEnabled) this.startWatching();
          },
          { once: true },
        );
      } else if (this.isEnabled) {
        this.startWatching();
      }

      window.addEventListener("yt-navigate-finish", () => {
        if (this.isEnabled) {
          this.resetAdState();
          this.tick();
        }
      });

      window.addEventListener("beforeunload", () => this.cleanup(), {
        once: true,
      });
    } catch (error) {
      this.logError("Bootstrap failed", error);
    }
  }

  // ---------------------------------------------------------------- storage

  private async readInitialState() {
    if (!this.api?.storage?.sync) {
      this.isEnabled = DEFAULT_WATCHER_STATE;
      return;
    }

    const result = await storageGet("sync", [WATCHER_STORAGE_KEY]);
    const stored = result[WATCHER_STORAGE_KEY];
    this.isEnabled =
      typeof stored === "boolean" ? stored : DEFAULT_WATCHER_STATE;
    logDebug("Watcher initial state:", this.isEnabled);
  }

  private async loadFeatureSettings() {
    if (!this.api?.storage?.sync) return;

    const result = await storageGet("sync", [
      "muteAdSound",
      "blurAds",
      SKIP_MODE_KEY,
    ]);
    if (typeof result.muteAdSound === "boolean") {
      this.muteAdSound = result.muteAdSound;
    }
    if (typeof result.blurAds === "boolean") {
      this.blurAds = result.blurAds;
    }
    if (isSkipMode(result[SKIP_MODE_KEY])) {
      this.skipMode = result[SKIP_MODE_KEY];
    }
  }

  private listenToStorage() {
    if (!this.api?.storage?.onChanged) return;

    try {
      onStorageChanged("sync", (changes) => {
        if (this.contextInvalidated) return;

        const watcherChange = changes[WATCHER_STORAGE_KEY];
        if (watcherChange && typeof watcherChange.newValue === "boolean") {
          this.toggleWatcher(watcherChange.newValue);
        }

        if (
          changes.muteAdSound &&
          typeof changes.muteAdSound.newValue === "boolean"
        ) {
          this.muteAdSound = changes.muteAdSound.newValue;
          if (!this.muteAdSound) this.restoreVideoMute();
          // Re-evaluate live instead of trusting a possibly stale ad flag.
          if (this.isEnabled) this.tick();
        }

        if (changes.blurAds && typeof changes.blurAds.newValue === "boolean") {
          this.blurAds = changes.blurAds.newValue;
          if (!this.blurAds) this.removeBlurFeature();
          if (this.isEnabled) this.tick();
        }

        const modeChange = changes[SKIP_MODE_KEY];
        if (modeChange && isSkipMode(modeChange.newValue)) {
          this.skipMode = modeChange.newValue;
          // Leftover assist highlight must not survive a mode switch.
          if (this.skipMode !== "assist") this.removeHighlight();
          if (this.isEnabled) this.tick();
        }
      });
    } catch (error) {
      this.logError("Failed to listen to storage", error);
    }
  }

  // ---------------------------------------------------------------- watching

  private toggleWatcher(shouldEnable: boolean) {
    if (shouldEnable === this.isEnabled) return;
    this.isEnabled = shouldEnable;

    if (shouldEnable) {
      logDebug("Watcher enabled");
      this.startWatching();
    } else {
      logDebug("Watcher disabled");
      this.stopWatching();
      this.restoreVideoMute();
      this.removeBlurFeature();
    }
  }

  /**
   * True only on a real playback surface. YouTube reuses `#movie_player`-like
   * markup in other UI contexts (e.g. the Premium downloads manager), where
   * clicking or observing caused issue #2. A route check plus a real, loaded
   * <video> inside the player is required before the extension touches
   * anything.
   */
  private isActivePlaybackContext(): boolean {
    const path = window.location.pathname;
    const isPlaybackRoute =
      path.startsWith("/watch") ||
      path.startsWith("/embed/") ||
      path.startsWith("/shorts/") ||
      path.startsWith("/live/") ||
      path.startsWith("/clip/");

    if (!isPlaybackRoute) return false;

    const container = document.querySelector<HTMLElement>(PLAYER_SELECTOR);
    if (!container) return false;

    const video = container.querySelector<HTMLVideoElement>("video");
    if (!video) return false;

    return (
      video.readyState > 0 ||
      !!video.currentSrc ||
      !!video.src ||
      video.duration > 0
    );
  }

  /** Cached for the duration of one tick to avoid repeated DOM work. */
  private cachedPlayer: HTMLElement | null = null;
  private playerCacheValid = false;
  private tickScheduled = false;

  private getPlayer(): HTMLElement | null {
    if (this.playerCacheValid) return this.cachedPlayer;
    this.playerCacheValid = true;
    this.cachedPlayer = this.isActivePlaybackContext()
      ? document.querySelector<HTMLElement>(PLAYER_SELECTOR)
      : null;
    return this.cachedPlayer;
  }

  private invalidatePlayerCache() {
    this.playerCacheValid = false;
    this.cachedPlayer = null;
  }

  /** Coalesces mutation bursts into at most one tick per animation frame. */
  private scheduleTick() {
    if (this.tickScheduled || !this.isEnabled || this.contextInvalidated)
      return;
    this.tickScheduled = true;
    window.requestAnimationFrame(() => {
      this.tickScheduled = false;
      if (!this.isEnabled || this.contextInvalidated) return;
      try {
        this.tick();
      } catch (error) {
        logWarn("Failed to process mutations", error);
      }
    });
  }

  private startWatching() {
    if (this.observer || !this.isEnabled) return;

    // Scope the observer to the player when it exists; otherwise watch the
    // body only until the player appears, then re-scope.
    this.invalidatePlayerCache();
    const player = this.getPlayer();
    const root = player ?? document.body ?? document.documentElement;
    if (!root) return;

    try {
      this.observer = new MutationObserver((mutations) => {
        if (this.hasRelevantMutation(mutations)) this.scheduleTick();
      });

      this.observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
      this.observerScopedToPlayer = player !== null;

      // Safety net only — never the primary mechanism.
      if (this.intervalId === null) {
        this.intervalId = window.setInterval(() => {
          if (!this.isEnabled || this.contextInvalidated) return;
          try {
            this.tick();
          } catch (error) {
            logWarn("Failed during safety-net interval", error);
          }
        }, SAFETY_NET_INTERVAL_MS);
      }

      this.tick();
      logDebug("Started watching for ads");
    } catch (error) {
      this.logError("Failed to start watching", error);
    }
  }

  private observerScopedToPlayer = false;

  /** Ignore progress-bar and control animation churn inside the player. */
  private hasRelevantMutation(mutations: MutationRecord[]): boolean {
    const relevantSelector = [
      ...AD_SKIP_SELECTORS,
      ...SURVEY_SKIP_SELECTORS,
      ...OVERLAY_CLOSE_SELECTORS,
      ...AD_INDICATOR_SELECTORS,
    ].join(",");

    return mutations.some((mutation) => {
      if (mutation.type === "attributes") {
        const target = mutation.target;
        return (
          target instanceof HTMLElement &&
          (target.matches(PLAYER_SELECTOR) || target.matches(relevantSelector))
        );
      }

      return Array.from(mutation.addedNodes).some((node) => {
        if (!(node instanceof HTMLElement)) return false;
        return (
          node.matches(relevantSelector) ||
          node.querySelector(relevantSelector) !== null
        );
      });
    });
  }

  /**
   * Re-attaches the observer to #movie_player once it mounts.
   * Deliberately does NOT reset ad state: an ad may already be running and
   * resetting would drop mute/blur for a frame.
   */
  private rescopeObserverToPlayer() {
    const player = this.getPlayer();
    if (!player || !this.observer) return;

    try {
      this.observer.disconnect();
      this.observer = null;
      this.observerScopedToPlayer = false;
      this.startWatching();
    } catch (error) {
      logWarn("Failed to re-scope observer to player", error);
    }
  }

  private stopWatching() {
    try {
      this.observer?.disconnect();
      this.observer = null;
      this.observerScopedToPlayer = false;

      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
      this.resetAdState();
    } catch (error) {
      logWarn("Failed to stop watching", error);
    }
  }

  private cleanup() {
    this.contextInvalidated = true;
    this.stopWatching();
    this.restoreVideoMute();
    this.removeBlurFeature();
  }

  private resetAdState() {
    this.isAdPlaying = false;
    this.adStartedAt = 0;
    this.adCounterIncremented = false;
    this.staleSignalSent = false;
    this.restoreVideoMute();
    this.removeBlurFeature();
    this.removeHighlight();
  }

  // -------------------------------------------------------------------- tick

  /**
   * The single unified path. Called by the MutationObserver on every relevant
   * DOM change (primary) and by the safety-net interval (fallback).
   *
   * Skip-button clicking is NEVER gated on ad-detection state.
   */
  private tick() {
    if (!this.isEnabled || this.contextInvalidated) return;

    this.invalidatePlayerCache();

    if (!this.observerScopedToPlayer && this.getPlayer()) {
      // Player mounted after we started: re-scope without touching ad state.
      this.rescopeObserverToPlayer();
      return;
    }

    const adPresent = this.isAdCurrentlyPlaying();

    // One combined precise query runs on every tick. Broad selectors and text
    // heuristics stay gated behind a real ad signal.
    const clicked = this.scanAndClickSkipButton(adPresent);

    this.updateAdState(adPresent, clicked);
  }

  private updateAdState(adPresent: boolean, clickedSkip: SkipClickSource) {
    if (adPresent && !this.isAdPlaying) {
      this.isAdPlaying = true;
      this.adStartedAt = Date.now();
      this.adCounterIncremented = false;
      this.staleSignalSent = false;
    } else if (!adPresent && this.isAdPlaying) {
      this.isAdPlaying = false;
      this.adStartedAt = 0;
      this.restoreVideoMute();
      this.removeBlurFeature();
      this.adCounterIncremented = false;
    }

    // Re-assert both features every tick while an ad runs: YouTube swaps
    // video elements and overlays mid-ad, and settings can change live.
    if (adPresent) {
      if (this.muteAdSound) this.applyMuteFeature();
      else this.restoreVideoMute();

      if (this.blurAds) this.applyBlurFeature();
      else this.removeBlurFeature();
    }

    // Only a click on a KNOWN skip button can ever be counted. Heuristic
    // clicks are emergency attempts, not reliable statistics — counting them
    // made ads that ended naturally register as successful skips.
    if (clickedSkip === "ad-skip" && adPresent && !this.adCounterIncremented) {
      this.adCounterIncremented = true;
      this.verifyAndCountSkip();
    }

    this.checkSelectorHealth(adPresent);
  }

  // ------------------------------------------------------------- ad detection

  /** Simple OR logic — no confidence scoring gate. */
  private isAdCurrentlyPlaying(): boolean {
    try {
      const player = this.getPlayer();
      if (!player) return false;

      const hasAdClass = AD_CLASS_NAMES.some((name) =>
        player.classList.contains(name),
      );
      if (hasAdClass) return true;

      return AD_INDICATOR_SELECTORS.some((selector) => {
        const element = player.querySelector(selector);
        return element !== null && this.isElementVisible(element);
      });
    } catch (error) {
      logWarn("Failed to determine ad state", error);
      return false;
    }
  }

  private isElementVisible(element: Element): boolean {
    try {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        parseFloat(style.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------- skipping

  /**
   * Behaviour depends on the three-state skip mode:
   *  off    — no scanning at all (cheapest path)
   *  assist — locate the button and highlight it; the user clicks it
   *  auto   — real click dispatched by the background via chrome.debugger,
   *           with the synthetic click kept as a fallback
   */
  private scanAndClickSkipButton(adPresent: boolean): SkipClickSource {
    if (this.skipMode === "off") {
      this.removeHighlight();
      return null;
    }

    const player = this.getPlayer();
    if (!player) return null;

    const precise = this.queryCandidates(player, AD_SKIP_SELECTORS);
    const preciseReady = precise.find((candidate) =>
      this.isButtonReady(
        candidate.closest<HTMLElement>('button, [role="button"]') ?? candidate,
      ),
    );

    if (this.skipMode === "assist") {
      const target = preciseReady
        ? (preciseReady.closest<HTMLElement>('button, [role="button"]') ??
          preciseReady)
        : null;
      if (target) this.highlightButton(target);
      else this.removeHighlight();
      return null;
    }

    // ---- auto mode ----
    this.removeHighlight();

    if (preciseReady) {
      const target =
        preciseReady.closest<HTMLElement>('button, [role="button"]') ??
        preciseReady;
      if (this.canClickAgain(target)) {
        this.requestTrustedClick(target);
        logDebug("Video-ad skip button clicked");
        return "ad-skip";
      }
    }

    if (!adPresent) return null;

    const auxiliary = this.queryCandidates(player, [
      ...SURVEY_SKIP_SELECTORS,
      ...OVERLAY_CLOSE_SELECTORS,
    ]);
    if (this.clickFirstReady(auxiliary)) {
      logDebug("Auxiliary ad control clicked (not counted)");
      return "auxiliary";
    }

    const fallback = this.queryCandidates(player, FALLBACK_SKIP_SELECTORS);
    if (this.clickFirstReady(fallback)) {
      logDebug("Fallback skip control clicked (not counted)");
      return "fallback";
    }

    if (this.clickFirstReady(this.collectHeuristicCandidates(player))) {
      logDebug("Heuristic skip control clicked (not counted)");
      return "fallback";
    }

    return null;
  }

  // -------------------------------------------------- trusted click (auto)

  /**
   * Asks the background service worker to dispatch a real input event at the
   * button's centre. Falls back to the synthetic click when the debugger path
   * is unavailable, and downgrades to "assist" when the optional permission
   * was denied or revoked.
   */
  private requestTrustedClick(button: HTMLElement) {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const sendMessage = this.api?.runtime?.sendMessage;
    if (!sendMessage || this.trustedClickPending) {
      this.clickSkipButtonImmediately(button);
      return;
    }

    this.trustedClickPending = true;

    void (async () => {
      try {
        const response = (await this.api!.runtime.sendMessage({
          type: "SKIP_AD_TRUSTED_CLICK",
          x,
          y,
        })) as { success?: boolean; reason?: string } | undefined;

        if (response?.success) {
          this.showToast();
          return;
        }

        if (response?.reason === "unexpected-missing-permission") {
          // Should never happen: `debugger` is a required manifest permission.
          // Log and skip this attempt only — keep the user's mode untouched.
          logWarn(
            "Debugger permission unexpectedly missing — skipping this click",
          );
          return;
        }

        // Any other failure: the synthetic click is still better than nothing.
        this.clickSkipButtonImmediately(button);
      } catch (error) {
        logWarn("Trusted click request failed", error);
        this.clickSkipButtonImmediately(button);
      } finally {
        this.trustedClickPending = false;
      }
    })();
  }

  // ------------------------------------------------------ assist highlight

  private ensureInjectedStyle() {
    if (document.getElementById(INJECTED_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = INJECTED_STYLE_ID;
    style.textContent = `
@keyframes autoskip-highlight-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.55); }
  50% { box-shadow: 0 0 0 8px rgba(255, 0, 0, 0); }
}`;
    (document.head ?? document.documentElement).appendChild(style);
  }

  /** Draws a separate pulsing ring over the button; YouTube's DOM is untouched. */
  private highlightButton(button: HTMLElement) {
    try {
      const player = this.getPlayer();
      if (!player) return;

      this.ensureInjectedStyle();

      let ring = document.getElementById(
        HIGHLIGHT_OVERLAY_ID,
      ) as HTMLDivElement | null;

      if (!ring) {
        ring = document.createElement("div");
        ring.id = HIGHLIGHT_OVERLAY_ID;
        ring.style.position = "absolute";
        ring.style.pointerEvents = "none";
        ring.style.zIndex = "60";
        ring.style.borderRadius = "18px";
        ring.style.border = "2px solid rgba(255, 0, 0, 0.9)";
        ring.style.animation =
          "autoskip-highlight-pulse 1.4s ease-out infinite";

        if (getComputedStyle(player).position === "static") {
          player.style.position = "relative";
        }
        player.appendChild(ring);
      }

      const playerRect = player.getBoundingClientRect();
      const rect = button.getBoundingClientRect();
      ring.style.display = "block";
      ring.style.left = `${rect.left - playerRect.left - 2}px`;
      ring.style.top = `${rect.top - playerRect.top - 2}px`;
      ring.style.width = `${rect.width}px`;
      ring.style.height = `${rect.height}px`;
    } catch (error) {
      logWarn("Failed to highlight skip button", error);
    }
  }

  private removeHighlight() {
    const ring = document.getElementById(HIGHLIGHT_OVERLAY_ID);
    if (ring) (ring as HTMLElement).style.display = "none";
  }

  // ------------------------------------------------------------- auto toast

  private toastTimeout: number | null = null;

  private showToast() {
    try {
      const player = this.getPlayer();
      if (!player) return;

      let toast = document.getElementById(TOAST_ID) as HTMLDivElement | null;
      if (!toast) {
        toast = document.createElement("div");
        toast.id = TOAST_ID;
        toast.style.position = "absolute";
        toast.style.left = "16px";
        toast.style.bottom = "64px";
        toast.style.zIndex = "70";
        toast.style.padding = "8px 12px";
        toast.style.borderRadius = "8px";
        toast.style.background = "rgba(0, 0, 0, 0.8)";
        toast.style.color = "#fff";
        toast.style.font = "500 13px/1.4 Roboto, Arial, sans-serif";
        toast.style.pointerEvents = "none";

        if (getComputedStyle(player).position === "static") {
          player.style.position = "relative";
        }
        player.appendChild(toast);
      }

      toast.textContent = this.toastMessage();
      toast.style.display = "block";

      if (this.toastTimeout !== null) window.clearTimeout(this.toastTimeout);
      this.toastTimeout = window.setTimeout(() => {
        const node = document.getElementById(TOAST_ID);
        if (node) (node as HTMLElement).style.display = "none";
      }, 2000);
    } catch (error) {
      logWarn("Failed to show toast", error);
    }
  }

  private toastMessage(): string {
    const lang = (document.documentElement.lang || "").toLowerCase();
    return lang.startsWith("ar")
      ? "تم تخطي الإعلان تلقائيًا"
      : "Ad skipped automatically";
  }

  private queryCandidates(
    player: HTMLElement,
    selectors: readonly string[],
  ): HTMLElement[] {
    try {
      return Array.from(
        player.querySelectorAll<HTMLElement>(selectors.join(",")),
      );
    } catch (error) {
      logWarn("Failed to query skip controls", error);
      return [];
    }
  }

  private clickFirstReady(candidates: Iterable<HTMLElement>): boolean {
    for (const candidate of candidates) {
      const button =
        candidate.closest<HTMLElement>('button, [role="button"]') ?? candidate;
      if (!this.isButtonReady(button) || !this.canClickAgain(button)) continue;
      this.clickSkipButtonImmediately(button);
      return true;
    }
    return false;
  }

  /**
   * Prevents hammering the same element on every tick. A real skip removes the
   * ad immediately; repeated clicks on a non-functional match only add noise
   * and made the counter fire on ads that simply ended on their own.
   */
  private readonly lastClickAt = new WeakMap<HTMLElement, number>();

  private canClickAgain(button: HTMLElement): boolean {
    const now = Date.now();
    const previous = this.lastClickAt.get(button);
    if (previous !== undefined && now - previous < CLICK_COOLDOWN_MS) {
      return false;
    }
    this.lastClickAt.set(button, now);
    return true;
  }

  /**
   * Fallback for when YouTube renames its classes (issue #1).
   * Scoped to the player, matches short skip-like text / aria-labels only.
   */
  private collectHeuristicCandidates(player: HTMLElement): HTMLElement[] {
    try {
      const nodes = player.querySelectorAll<HTMLElement>(
        'button, [role="button"]',
      );
      const matches: HTMLElement[] = [];

      nodes.forEach((node) => {
        const label = (
          node.getAttribute("aria-label") ||
          node.textContent ||
          ""
        )
          .trim()
          .toLowerCase();

        if (!label || label.length > MAX_HEURISTIC_LABEL_LENGTH) return;
        // "Skip intro", chapter skipping, etc. are not ad-skip buttons.
        if (SKIP_EXCLUDE_KEYWORDS.some((word) => label.includes(word))) return;
        if (SKIP_KEYWORDS.some((keyword) => label.includes(keyword))) {
          matches.push(node);
        }
      });

      return matches;
    } catch (error) {
      logWarn("Heuristic skip detection failed", error);
      return [];
    }
  }

  private isButtonReady(button: HTMLElement): boolean {
    try {
      if (!button.isConnected) return false;

      const style = window.getComputedStyle(button);
      const rect = button.getBoundingClientRect();

      if (style.display === "none" || style.visibility === "hidden")
        return false;
      if (parseFloat(style.opacity) <= 0.1) return false;
      if (rect.width <= 0 || rect.height <= 0) return false;
      if (style.pointerEvents === "none") return false;
      if (button.hasAttribute("disabled")) return false;
      if (button.getAttribute("aria-disabled") === "true") return false;

      return true;
    } catch {
      return false;
    }
  }

  /** Fully synchronous: no setTimeout can let YouTube swap the node first. */
  private clickSkipButtonImmediately(button: HTMLElement) {
    try {
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const base = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      };

      button.dispatchEvent(new MouseEvent("mouseover", base));
      button.dispatchEvent(
        new MouseEvent("mousedown", { ...base, button: 0, buttons: 1 }),
      );
      button.dispatchEvent(new MouseEvent("mouseup", { ...base, button: 0 }));
      button.click();
    } catch (error) {
      logWarn("Failed to click skip button", error);
      try {
        button.click();
      } catch {
        /* nothing else to try */
      }
    }
  }

  // ------------------------------------------------------------------- mute

  /**
   * Some ad formats render into a different <video> than the main one, so
   * fall back to any video inside the player.
   */
  private getVideoElement(): HTMLVideoElement | null {
    const main = document.querySelector<HTMLVideoElement>(
      VIDEO_PLAYER_SELECTOR,
    );
    if (main) return main;

    const player = this.getPlayer();
    return player?.querySelector<HTMLVideoElement>("video") ?? null;
  }

  private applyMuteFeature() {
    try {
      const video = this.getVideoElement();
      if (!video) return;

      if (this.wasMutedBeforeAd === null) {
        this.wasMutedBeforeAd = video.muted;
      }
      video.muted = true;
    } catch (error) {
      logWarn("Failed to apply mute feature", error);
    }
  }

  /** Restores exactly the user's own mute choice; volume is never touched. */
  private restoreVideoMute() {
    try {
      const video = this.getVideoElement();
      if (!video || this.wasMutedBeforeAd === null) {
        this.wasMutedBeforeAd = null;
        return;
      }
      video.muted = this.wasMutedBeforeAd;
      this.wasMutedBeforeAd = null;
    } catch (error) {
      logWarn("Failed to restore mute state", error);
    }
  }

  // ------------------------------------------------------------------- blur

  /** Blur lives on a separate overlay; the <video> element is never touched. */
  private ensureBlurOverlay(): HTMLDivElement | null {
    const existing = document.getElementById(
      BLUR_OVERLAY_ID,
    ) as HTMLDivElement | null;
    if (existing) return existing;

    const player = this.getPlayer();
    if (!player) return null;

    const overlay = document.createElement("div");
    overlay.id = BLUR_OVERLAY_ID;
    overlay.style.position = "absolute";
    overlay.style.inset = "0";
    overlay.style.zIndex = "40"; // below the skip button layer
    overlay.style.backdropFilter = "blur(30px)";
    overlay.style.setProperty("-webkit-backdrop-filter", "blur(30px)");
    overlay.style.pointerEvents = "none";
    overlay.style.display = "none";

    if (getComputedStyle(player).position === "static") {
      player.style.position = "relative";
    }
    player.appendChild(overlay);
    return overlay;
  }

  private applyBlurFeature() {
    const overlay = this.ensureBlurOverlay();
    if (overlay) overlay.style.display = "block";
  }

  private removeBlurFeature() {
    const overlay = document.getElementById(BLUR_OVERLAY_ID);
    if (overlay) (overlay as HTMLElement).style.display = "none";
  }

  // ---------------------------------------------------------------- counter

  /**
   * A click alone proves nothing: count the skip only after the ad actually
   * disappears within a short verification window. Otherwise reset the flag
   * so a later, real skip can still be counted.
   */
  private verifyAndCountSkip() {
    if (this.contextInvalidated) return;

    window.setTimeout(() => {
      if (this.contextInvalidated) return;

      this.invalidatePlayerCache();
      if (!this.isAdCurrentlyPlaying()) {
        this.scheduleCounterIncrement();
      } else {
        this.adCounterIncremented = false;
      }
    }, SKIP_VERIFICATION_DELAY_MS);
  }

  private scheduleCounterIncrement() {
    if (this.pendingCounterUpdate || this.contextInvalidated) return;

    const elapsed = Date.now() - this.lastCounterUpdate;
    if (elapsed < COUNTER_UPDATE_DELAY_MS) {
      this.pendingCounterUpdate = true;
      window.setTimeout(() => {
        this.pendingCounterUpdate = false;
        this.incrementSkipCounter();
      }, COUNTER_UPDATE_DELAY_MS - elapsed);
    } else {
      this.incrementSkipCounter();
    }
  }

  /** Counter lives in storage.local (frequent writes, no sync quota). */
  private incrementSkipCounter() {
    if (!this.api?.storage?.local || this.contextInvalidated) return;

    void (async () => {
      try {
        const result = await storageGet("local", [ADS_SKIPPED_KEY]);
        if (this.contextInvalidated) return;

        const current =
          typeof result[ADS_SKIPPED_KEY] === "number"
            ? (result[ADS_SKIPPED_KEY] as number)
            : 0;

        const ok = await storageSet("local", {
          [ADS_SKIPPED_KEY]: current + 1,
        });
        if (ok) {
          this.lastCounterUpdate = Date.now();
          logDebug("Skip counter:", current + 1);
        }
      } catch (error) {
        this.logError("Failed to increment counter", error);
      }
    })();
  }

  // ------------------------------------------------------- selector health

  /** Long-running ad with no matching button => selectors are probably stale. */
  private checkSelectorHealth(adPresent: boolean) {
    if (!adPresent || this.staleSignalSent || !this.adStartedAt) return;
    if (Date.now() - this.adStartedAt < STALE_SELECTOR_THRESHOLD_MS) return;

    const player = this.getPlayer();
    if (!player) return;

    const found = AD_SKIP_SELECTORS.some(
      (selector) => player.querySelector(selector) !== null,
    );
    if (found) return;

    this.staleSignalSent = true;
    void storageSet("local", {
      [SELECTORS_STALE_KEY]: { detectedAt: Date.now() },
    });
    logWarn(
      "Skip selectors may be stale — no matching button during a long ad",
    );
  }

  // ----------------------------------------------------------------- errors

  private logError(message: string, error: unknown) {
    const text =
      typeof error === "object" && error && "message" in error
        ? String((error as { message?: string }).message)
        : String(error);

    if (text.includes("Extension context invalidated")) {
      this.contextInvalidated = true;
      this.cleanup();
    }
    logWarn(message, error);
  }
}

(() => {
  try {
    logDebug("Initializing AutoSkipWatcher");
    new AutoSkipWatcher();
  } catch (error) {
    logWarn("Failed to initialize AutoSkipWatcher", error);
  }
})();
