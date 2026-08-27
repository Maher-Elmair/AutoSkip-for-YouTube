import {
  DEFAULT_WATCHER_STATE,
  WATCHER_STORAGE_KEY,
  ADS_SKIPPED_KEY,
  SELECTORS_STALE_KEY,
} from "@/constants/storage";
import { resolveBrowserApi } from "./shared/browserApi";
import { logDebug, logWarn } from "./shared/logger";
import {
  AD_CLASS_NAMES,
  AD_INDICATOR_SELECTORS,
  BLUR_OVERLAY_ID,
  MAX_HEURISTIC_LABEL_LENGTH,
  PLAYER_SELECTOR,
  SKIP_BUTTON_SELECTORS,
  SKIP_KEYWORDS,
  VIDEO_PLAYER_SELECTOR,
} from "./shared/skipSelectors";

/** Safety-net polling only. MutationObserver is the primary mechanism. */
const SAFETY_NET_INTERVAL_MS = 400;
/** If an ad runs this long with no matching skip button, selectors may be stale. */
const STALE_SELECTOR_THRESHOLD_MS = 20000;
const COUNTER_UPDATE_DELAY_MS = 2000;

class AutoSkipWatcher {
  private observer: MutationObserver | null = null;
  private intervalId: number | null = null;
  private isEnabled = DEFAULT_WATCHER_STATE;
  private readonly api = resolveBrowserApi();

  // Feature settings
  private muteAdSound = true;
  private blurAds = false;

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
          { once: true }
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

      window.addEventListener(
        "beforeunload",
        () => this.cleanup(),
        { once: true }
      );
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

    await new Promise<void>((resolve) => {
      this.api!.storage.sync.get([WATCHER_STORAGE_KEY], (result) => {
        if (this.checkForErrors()) return resolve();
        const stored = result[WATCHER_STORAGE_KEY];
        this.isEnabled =
          typeof stored === "boolean" ? stored : DEFAULT_WATCHER_STATE;
        logDebug("Watcher initial state:", this.isEnabled);
        resolve();
      });
    });
  }

  private async loadFeatureSettings() {
    if (!this.api?.storage?.sync) return;

    await new Promise<void>((resolve) => {
      this.api!.storage.sync.get(["muteAdSound", "blurAds"], (result) => {
        if (this.checkForErrors()) return resolve();
        if (typeof result.muteAdSound === "boolean") {
          this.muteAdSound = result.muteAdSound;
        }
        if (typeof result.blurAds === "boolean") {
          this.blurAds = result.blurAds;
        }
        resolve();
      });
    });
  }

  private listenToStorage() {
    if (!this.api?.storage?.onChanged) return;

    try {
      this.api.storage.onChanged.addListener(
        (
          changes: Record<string, chrome.storage.StorageChange>,
          areaName: string
        ) => {
          if (this.contextInvalidated || areaName !== "sync") return;

          const watcherChange = changes[WATCHER_STORAGE_KEY];
          if (watcherChange && typeof watcherChange.newValue === "boolean") {
            this.toggleWatcher(watcherChange.newValue);
          }

          if (
            changes.muteAdSound &&
            typeof changes.muteAdSound.newValue === "boolean"
          ) {
            this.muteAdSound = changes.muteAdSound.newValue;
            if (this.isAdPlaying && this.isEnabled) {
              if (this.muteAdSound) this.applyMuteFeature();
              else this.restoreVideoMute();
            }
          }

          if (changes.blurAds && typeof changes.blurAds.newValue === "boolean") {
            this.blurAds = changes.blurAds.newValue;
            if (this.blurAds && this.isAdPlaying && this.isEnabled) {
              this.applyBlurFeature();
            } else {
              this.removeBlurFeature();
            }
          }
        }
      );
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

  private getPlayer(): HTMLElement | null {
    return document.querySelector<HTMLElement>(PLAYER_SELECTOR);
  }

  private startWatching() {
    if (this.observer || !this.isEnabled) return;

    // Scope the observer to the player when it exists; otherwise watch the
    // body only until the player appears, then re-scope.
    const player = this.getPlayer();
    const root = player ?? document.body ?? document.documentElement;
    if (!root) return;

    try {
      this.observer = new MutationObserver(() => {
        if (!this.isEnabled || this.contextInvalidated) return;
        try {
          if (!player && this.getPlayer()) {
            // Player mounted after we started: re-scope to it without
            // touching the current ad state (no mute/blur flicker).
            this.rescopeObserverToPlayer();
            return;
          }
          this.tick();
        } catch (error) {
          logWarn("Failed to process mutations", error);
        }
      });


      this.observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });
      this.observerScopedToPlayer = player !== null;


      // Safety net only — never the primary mechanism.
      if (this.intervalId === null) {
        this.intervalId = window.setInterval(() => {
          if (!this.isEnabled || this.contextInvalidated) return;
          try {
            if (!this.observerIsScopedToPlayer() && this.getPlayer()) {
              this.rescopeObserverToPlayer();
              return;
            }
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

  private observerIsScopedToPlayer(): boolean {
    return this.observerScopedToPlayer;
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

    // 1) Click first — a visible, enabled skip button is proof enough.
    const clicked = this.scanAndClickSkipButton();

    // 2) Then update ad state for the cosmetic features + counter.
    this.updateAdState(clicked);
  }

  private updateAdState(clickedSkip: boolean) {
    const adPresent = this.isAdCurrentlyPlaying();

    if (adPresent && !this.isAdPlaying) {
      this.isAdPlaying = true;
      this.adStartedAt = Date.now();
      this.adCounterIncremented = false;
      this.staleSignalSent = false;
      if (this.muteAdSound) this.applyMuteFeature();
      if (this.blurAds) this.applyBlurFeature();
    } else if (!adPresent && this.isAdPlaying) {
      this.isAdPlaying = false;
      this.adStartedAt = 0;
      this.restoreVideoMute();
      this.removeBlurFeature();
      this.adCounterIncremented = false;
    }

    if (clickedSkip && !this.adCounterIncremented) {
      this.adCounterIncremented = true;
      this.scheduleCounterIncrement();
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
        player.classList.contains(name)
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

  /** Returns true when a skip button was actually clicked in this tick. */
  private scanAndClickSkipButton(): boolean {
    const player = this.getPlayer();
    if (!player) return false;

    const candidates = new Set<HTMLElement>();

    for (const selector of SKIP_BUTTON_SELECTORS) {
      try {
        player
          .querySelectorAll<HTMLElement>(selector)
          .forEach((button) => candidates.add(button));
      } catch (error) {
        logWarn("Failed to query skip buttons", error);
      }
    }

    if (candidates.size === 0) {
      this.collectHeuristicCandidates(player).forEach((b) => candidates.add(b));
    }

    for (const button of candidates) {
      if (this.isButtonReady(button)) {
        this.clickSkipButtonImmediately(button);
        logDebug("Skip button clicked");
        return true;
      }
    }

    return false;
  }

  /**
   * Fallback for when YouTube renames its classes (issue #1).
   * Scoped to the player, matches short skip-like text / aria-labels only.
   */
  private collectHeuristicCandidates(player: HTMLElement): HTMLElement[] {
    try {
      const nodes = player.querySelectorAll<HTMLElement>(
        'button, [role="button"]'
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

      if (style.display === "none" || style.visibility === "hidden") return false;
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
        new MouseEvent("mousedown", { ...base, button: 0, buttons: 1 })
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

  private getVideoElement(): HTMLVideoElement | null {
    return document.querySelector<HTMLVideoElement>(VIDEO_PLAYER_SELECTOR);
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
      BLUR_OVERLAY_ID
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

    try {
      this.api.storage.local.get([ADS_SKIPPED_KEY], (result) => {
        if (this.checkForErrors() || this.contextInvalidated) return;

        const current =
          typeof result[ADS_SKIPPED_KEY] === "number"
            ? (result[ADS_SKIPPED_KEY] as number)
            : 0;

        this.api!.storage.local.set({ [ADS_SKIPPED_KEY]: current + 1 }, () => {
          if (!this.checkForErrors()) {
            this.lastCounterUpdate = Date.now();
            logDebug("Skip counter:", current + 1);
          }
        });
      });
    } catch (error) {
      this.logError("Failed to increment counter", error);
    }
  }

  // ------------------------------------------------------- selector health

  /** Long-running ad with no matching button => selectors are probably stale. */
  private checkSelectorHealth(adPresent: boolean) {
    if (!adPresent || this.staleSignalSent || !this.adStartedAt) return;
    if (Date.now() - this.adStartedAt < STALE_SELECTOR_THRESHOLD_MS) return;

    const player = this.getPlayer();
    if (!player) return;

    const found = SKIP_BUTTON_SELECTORS.some(
      (selector) => player.querySelector(selector) !== null
    );
    if (found) return;

    this.staleSignalSent = true;
    try {
      this.api?.storage?.local?.set({
        [SELECTORS_STALE_KEY]: { detectedAt: Date.now() },
      });
      logWarn("Skip selectors may be stale — no matching button during a long ad");
    } catch (error) {
      logWarn("Failed to store stale-selector signal", error);
    }
  }

  // ----------------------------------------------------------------- errors

  private checkForErrors(): boolean {
    const lastError = this.api?.runtime?.lastError;
    if (!lastError) return false;

    const message = lastError.message || "";
    if (message.includes("Extension context invalidated")) {
      this.contextInvalidated = true;
      this.cleanup();
      return true;
    }

    logWarn("Runtime error:", message);
    return true;
  }

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
