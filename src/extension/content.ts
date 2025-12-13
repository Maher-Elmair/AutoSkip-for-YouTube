import {
  DEFAULT_WATCHER_STATE,
  WATCHER_STORAGE_KEY,
} from "@/constants/storage";

type ChromeLike = typeof chrome;

const resolveBrowserApi = (): ChromeLike | undefined => {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    return chrome;
  }

  if (typeof browser !== "undefined" && browser?.storage?.sync) {
    return browser as unknown as ChromeLike;
  }

  return undefined;
};

// Selectors for skip buttons
const SKIP_BUTTON_SELECTORS = [
  ".ytp-skip-ad-button",
  ".ytp-ad-skip-button",
  ".ytp-ad-skip-button-modern",
  ".ytp-ad-skip-button-slot button",
  "button.ytp-ad-skip-button-modern",
  ".ytp-ad-skip-button-container button",
  'button[class*="skip"]',
  'button[aria-label*="Skip"]',
  'button[aria-label*="skip"]',
] as const;

// Selectors for detecting ads
const AD_INDICATOR_SELECTORS = [
  ".ytp-ad-player-overlay",
  ".ytp-ad-module",
  ".video-ads",
  ".ytp-ad-text",
  ".ytp-ad-preview-container",
] as const;

// Selectors for video player
const VIDEO_PLAYER_SELECTOR = "video.html5-main-video";

// Selectors for ad overlays to blur (excluding skip button containers)
const AD_OVERLAY_SELECTORS = [
  ".video-ads",
  ".ytp-ad-image-overlay",
  "ytd-display-ad-renderer",
  "ytd-promoted-sparkles-web-renderer",
] as const;

// Selectors to exclude from blur (keep skip button visible)
const SKIP_BUTTON_CONTAINERS = [
  ".ytp-ad-skip-button-container",
  ".ytp-ad-skip-button-slot",
  ".ytp-ad-skip-button-modern",
] as const;

class AutoSkipWatcher {
  private observer: MutationObserver | null = null;
  private intervalId: number | null = null;
  private isEnabled = DEFAULT_WATCHER_STATE;
  private readonly api = resolveBrowserApi();
  private skipAttempts = new WeakMap<HTMLElement, number>();
  private readonly maxAttempts = 5;
  private readonly pollIntervalMs = 500;
  
  // Feature settings
  private muteAdSound = true;
  private blurAds = false;
  
  // Ad state tracking
  private isAdPlaying = false;
  private originalVolume: number | null = null;
  private originalMuted: boolean = false;
  private blurredElements = new Set<HTMLElement>();
  
  // Counter management to avoid quota issues
  private pendingCounterUpdate = false;
  private lastCounterUpdate = 0;
  private readonly counterUpdateDelay = 2000;
  private adCounterIncremented = false;
  
  // Error suppression flags
  private contextInvalidated = false;

  constructor() {
    this.bootstrap();
  }

  private async bootstrap() {
    try {
      await this.readInitialState();
      await this.loadFeatureSettings();
      this.listenToStorage();
      this.listenToFeatureSettings();

      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            if (this.isEnabled) {
              this.startWatching();
            }
          },
          { once: true }
        );
      } else if (this.isEnabled) {
        this.startWatching();
      }

      // Handle page navigation
      window.addEventListener("yt-navigate-finish", () => {
        if (this.isEnabled) {
          this.resetAdState();
          this.checkAdState();
        }
      });

      // Handle beforeunload gracefully
      window.addEventListener("beforeunload", () => {
        this.cleanup();
      }, { once: true });

    } catch (error) {
      this.logError("Bootstrap failed", error);
    }
  }

  private async readInitialState() {
    if (!this.api?.storage?.sync) {
      this.isEnabled = DEFAULT_WATCHER_STATE;
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        this.api!.storage.sync.get([WATCHER_STORAGE_KEY], (result) => {
          if (this.checkForErrors()) {
            resolve();
            return;
          }
          
          const stored = result[WATCHER_STORAGE_KEY];
          this.isEnabled = typeof stored === "boolean" ? stored : DEFAULT_WATCHER_STATE;
          console.warn(`[autoskip] Watcher initial state: ${this.isEnabled}`);
          resolve();
        });
      });
    } catch (error) {
      this.logError("Failed to read initial state", error);
      this.isEnabled = DEFAULT_WATCHER_STATE;
    }
  }

  private async loadFeatureSettings() {
    if (!this.api?.storage?.sync) {
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        this.api!.storage.sync.get(["muteAdSound", "blurAds"], (result) => {
          if (this.checkForErrors()) {
            resolve();
            return;
          }
          
          if (typeof result.muteAdSound === "boolean") {
            this.muteAdSound = result.muteAdSound;
            console.warn(`[autoskip] Mute ad sound setting: ${this.muteAdSound}`);
          }
          if (typeof result.blurAds === "boolean") {
            this.blurAds = result.blurAds;
            console.warn(`[autoskip] Blur ads setting: ${this.blurAds}`);
          }
          resolve();
        });
      });
    } catch (error) {
      this.logError("Failed to load feature settings", error);
    }
  }

  private listenToStorage() {
    if (!this.api?.storage?.onChanged) {
      return;
    }

    try {
      this.api.storage.onChanged.addListener(
        (changes: Record<string, chrome.storage.StorageChange>, areaName) => {
          if (this.contextInvalidated || areaName !== "sync") {
            return;
          }

          const change = changes[WATCHER_STORAGE_KEY];
          if (change && typeof change.newValue === "boolean") {
            console.warn(`[autoskip] Watcher state changed to: ${change.newValue}`);
            this.toggleWatcher(change.newValue);
          }
        }
      );
    } catch (error) {
      this.logError("Failed to listen to storage", error);
    }
  }

  private listenToFeatureSettings() {
    if (!this.api?.storage?.onChanged) {
      return;
    }

    try {
      this.api.storage.onChanged.addListener(
        (changes: Record<string, chrome.storage.StorageChange>, areaName) => {
          if (this.contextInvalidated || areaName !== "sync") {
            return;
          }

          if (changes.muteAdSound && typeof changes.muteAdSound.newValue === "boolean") {
            this.muteAdSound = changes.muteAdSound.newValue;
            console.warn(`[autoskip] Mute ad sound setting changed to: ${this.muteAdSound}`);
            if (this.isAdPlaying && this.isEnabled) {
              if (this.muteAdSound) {
                this.applyMuteFeature();
              } else {
                this.restoreVideoVolume();
              }
            }
          }

          if (changes.blurAds && typeof changes.blurAds.newValue === "boolean") {
            this.blurAds = changes.blurAds.newValue;
            console.warn(`[autoskip] Blur ads setting changed to: ${this.blurAds}`);
            if (this.isAdPlaying && this.isEnabled) {
              if (this.blurAds) {
                this.applyBlurFeature();
              } else {
                this.removeBlurFeature();
              }
            } else if (!this.blurAds) {
              this.removeBlurFeature();
            }
          }
        }
      );
    } catch (error) {
      this.logError("Failed to listen to feature settings", error);
    }
  }

  private toggleWatcher(shouldEnable: boolean) {
    if (shouldEnable === this.isEnabled) {
      return;
    }

    this.isEnabled = shouldEnable;
    if (shouldEnable) {
      console.warn("[autoskip] Watcher enabled");
      this.startWatching();
    } else {
      console.warn("[autoskip] Watcher disabled");
      this.stopWatching();
      this.restoreVideoVolume();
      this.removeBlurFeature();
    }
  }

  private startWatching() {
    if (this.observer || !this.isEnabled) {
      return;
    }

    const root = document.body ?? document.documentElement;
    if (!root) {
      return;
    }

    try {
      // Main observer for DOM changes
      this.observer = new MutationObserver((mutations) => {
        if (!this.isEnabled || this.contextInvalidated) {
          return;
        }

        try {
          if (this.containsAdRelatedChange(mutations)) {
            this.checkAdState();
            this.scanForSkipButtons();
          }
        } catch (error) {
          console.warn("[autoskip] Failed to process mutations", error);
        }
      });

      this.observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });

      // Polling interval for skip buttons and ad state
      if (this.intervalId === null) {
        this.intervalId = window.setInterval(() => {
          if (!this.isEnabled || this.contextInvalidated) {
            return;
          }
          
          try {
            this.checkAdState();
            if (this.isAdPlaying) {
              this.scanForSkipButtons();
            }
          } catch (error) {
            console.warn("[autoskip] Failed during polling interval", error);
          }
        }, this.pollIntervalMs);
      }

      // Initial checks
      this.checkAdState();
      console.warn("[autoskip] Started watching for ads");
    } catch (error) {
      this.logError("Failed to start watching", error);
    }
  }

  private stopWatching() {
    try {
      this.observer?.disconnect();
      this.observer = null;

      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }

      this.skipAttempts = new WeakMap<HTMLElement, number>();
      this.resetAdState();
      console.warn("[autoskip] Stopped watching for ads");
    } catch (error) {
      console.warn("[autoskip] Failed to stop watching", error);
    }
  }

  private cleanup() {
    this.contextInvalidated = true;
    this.stopWatching();
    this.restoreVideoVolume();
    this.removeBlurFeature();
    console.warn("[autoskip] Cleaned up all resources");
  }

  private resetAdState() {
    this.isAdPlaying = false;
    this.adCounterIncremented = false;
    this.restoreVideoVolume();
    this.removeBlurFeature();
    console.warn("[autoskip] Ad state reset");
  }

  private containsAdRelatedChange(mutations: MutationRecord[]): boolean {
    try {
      return mutations.some((mutation) => {
        if (mutation.type === "childList") {
          return Array.from(mutation.addedNodes).some((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) {
              return false;
            }
            return this.isAdElement(node as Element);
          });
        }

        if (mutation.type === "attributes") {
          return this.isAdElement(mutation.target as Element);
        }

        return false;
      });
    } catch (error) {
      console.warn("[autoskip] Failed to evaluate mutations", error);
      return false;
    }
  }

  private isAdElement(element: Element): boolean {
    try {
      const className = element.className?.toString().toLowerCase() ?? "";
      const id = element.id?.toLowerCase() ?? "";

      return (
        className.includes("ad") ||
        className.includes("ytp-ad") ||
        id.includes("ad") ||
        element.querySelector('.ytp-ad-text, [class*="ytp-ad"]') !== null
      );
    } catch (error) {
      console.warn("[autoskip] Failed to determine ad element", error);
      return false;
    }
  }

  private checkAdState() {
    if (!this.isEnabled || this.contextInvalidated) {
      return;
    }

    try {
      const adPresent = this.isAdCurrentlyPlaying();

      if (adPresent && !this.isAdPlaying) {
        this.isAdPlaying = true;
        this.adCounterIncremented = false;
        this.onAdStart();
      } else if (!adPresent && this.isAdPlaying) {
        this.isAdPlaying = false;
        this.onAdEnd();
      }
    } catch (error) {
      console.warn("[autoskip] Failed to check ad state", error);
    }
  }

  private isAdCurrentlyPlaying(): boolean {
    try {
      // Check multiple indicators with confidence scoring
      let confidence = 0;
      
      // 1. Check if video player has ad class (high confidence)
      const videoContainer = document.querySelector("#movie_player");
      const hasAdClass = 
        videoContainer?.classList.contains("ad-showing") ||
        videoContainer?.classList.contains("ad-interrupting") ||
        false;
      
      if (hasAdClass) {
        confidence += 3;
        console.warn("[autoskip] High confidence: Video container has ad class");
      }

      // 2. Check for skip button (medium confidence)
      const hasSkipButton = SKIP_BUTTON_SELECTORS.some(selector => {
        const button = document.querySelector(selector);
        return button !== null && this.isElementVisible(button);
      });
      
      if (hasSkipButton) {
        confidence += 2;
        console.warn("[autoskip] Medium confidence: Skip button visible");
      }

      // 3. Check for ad overlays (medium confidence)
      const hasAdOverlay = AD_INDICATOR_SELECTORS.some(
        (selector) => {
          const element = document.querySelector(selector);
          return element !== null && this.isElementVisible(element);
        }
      );
      
      if (hasAdOverlay) {
        confidence += 2;
        console.warn("[autoskip] Medium confidence: Ad overlay detected");
      }

      // 4. Check for ad text (low confidence)
      const adText = document.querySelector(".ytp-ad-text");
      const hasAdText = adText !== null && 
                        this.isElementVisible(adText) &&
                        (adText.textContent?.length ?? 0) > 0;
      
      if (hasAdText) {
        confidence += 1;
        console.warn("[autoskip] Low confidence: Ad text detected");
      }

      // 5. Check for ad marker in video timeline (high confidence)
      const adMarkers = document.querySelectorAll(".ytp-ad-marker-container, .ytp-ad-marker");
      const hasAdMarkers = adMarkers.length > 0;
      
      if (hasAdMarkers) {
        confidence += 3;
        console.warn("[autoskip] High confidence: Ad markers in timeline");
      }

      // 6. Check for video interruption (medium confidence)
      const isVideoInterrupted = videoContainer?.classList.contains("ad-interrupting") || false;
      if (isVideoInterrupted) {
        confidence += 2;
        console.warn("[autoskip] Medium confidence: Video interrupted by ad");
      }

      // Only consider it an ad if we have sufficient confidence
      const isAd = confidence >= 4; // Require at least 4 confidence points
      
      if (isAd) {
        console.warn(`[autoskip] Ad detected with confidence score: ${confidence}/13`);
      } else if (confidence > 0) {
        console.warn(`[autoskip] Low confidence ad detection: ${confidence}/13 - likely normal video`);
      }
      
      return isAd;
    } catch (error) {
      console.warn("[autoskip] Failed to determine ad state", error);
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
    } catch (error) {
      console.warn("[autoskip] Failed to check element visibility", error);
      return false;
    }
  }

  private onAdStart() {
    try {
      console.warn("[autoskip] Ad detected and started");
      
      if (this.isEnabled && this.muteAdSound) {
        this.applyMuteFeature();
      }

      if (this.isEnabled && this.blurAds) {
        this.applyBlurFeature();
      }
    } catch (error) {
      this.logError("Failed on ad start", error);
    }
  }

  private onAdEnd() {
    try {
      console.warn("[autoskip] Ad ended");
      this.adCounterIncremented = false;
      this.restoreVideoVolume();
      this.removeBlurFeature();
    } catch (error) {
      this.logError("Failed on ad end", error);
    }
  }

  private applyMuteFeature() {
    try {
      const video = this.getVideoElement();
      if (!video) {
        console.warn("[autoskip] Cannot mute - video element not found");
        return;
      }

      // Only mute if ad is actually playing
      if (!this.isAdPlaying) {
        console.warn("[autoskip] Skipping mute - no ad detected");
        return;
      }

      // Store original state only once
      if (this.originalVolume === null) {
        this.originalVolume = video.volume;
        this.originalMuted = video.muted;
      }

      // Mute the video
      video.muted = true;
      video.volume = 0;
      console.warn("[autoskip] Ad audio muted");
    } catch (error) {
      console.warn("[autoskip] Failed to apply mute feature", error);
    }
  }

  private restoreVideoVolume() {
    try {
      const video = this.getVideoElement();
      if (!video || this.originalVolume === null) {
        return;
      }

      // Restore original state
      video.muted = this.originalMuted;
      video.volume = this.originalVolume;
      this.originalVolume = null;
      console.warn("[autoskip] Video audio restored");
    } catch (error) {
      console.warn("[autoskip] Failed to restore video volume", error);
    }
  }

  private applyBlurFeature() {
    try {
      // Only blur if ad is actually playing
      if (!this.isAdPlaying) {
        console.warn("[autoskip] Skipping blur - no ad detected");
        return;
      }

      // Clear previous blur
      this.removeBlurFeature();

      let blurCount = 0;

      // Helper function to check if element or its children are skip buttons
      const containsSkipButton = (element: Element): boolean => {
        return SKIP_BUTTON_SELECTORS.some(selector => 
          element.querySelector(selector) !== null
        );
      };

      // Apply blur to ad overlays (excluding skip button containers and elements containing skip buttons)
      AD_OVERLAY_SELECTORS.forEach((selector) => {
        document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
          if (element && element.style && this.isElementVisible(element)) {
            // Check if element is not a skip button container
            const isSkipContainer = SKIP_BUTTON_CONTAINERS.some(skipSelector => 
              element.matches(skipSelector) || element.closest(skipSelector)
            );
            
            // Check if element contains skip button
            const hasSkipButton = containsSkipButton(element);
            
            if (!isSkipContainer && !hasSkipButton) {
              // Also check if element is parent/grandparent of skip button
              const skipButtonInParents = SKIP_BUTTON_SELECTORS.some(selector => {
                const skipButton = document.querySelector(selector);
                return skipButton && element.contains(skipButton) && !element.isSameNode(skipButton);
              });
              
              if (!skipButtonInParents) {
                element.style.setProperty("filter", "blur(30px)", "important");
                element.style.setProperty("transition", "filter 0.3s ease", "important");
                this.blurredElements.add(element);
                blurCount++;
              }
            }
          }
        });
      });

      // Blur video element only during ads
      const video = this.getVideoElement();
      if (video && video.style) {
        video.style.setProperty("filter", "blur(30px)", "important");
        video.style.setProperty("transition", "filter 0.3s ease", "important");
        this.blurredElements.add(video);
        blurCount++;
      }

      // Ensure skip button stays visible and clickable
      this.ensureSkipButtonVisibility();

      console.warn(`[autoskip] Blur applied to ${blurCount} ad elements`);
    } catch (error) {
      console.warn("[autoskip] Failed to apply blur feature", error);
    }
  }

  private ensureSkipButtonVisibility() {
    try {
      SKIP_BUTTON_SELECTORS.forEach((selector) => {
        document.querySelectorAll<HTMLElement>(selector).forEach((button) => {
          if (button && button.style) {
            button.style.setProperty("filter", "none", "important");
            button.style.setProperty("z-index", "9999", "important");
            button.style.setProperty("pointer-events", "auto", "important");
            
            // Also ensure parent containers are not blurred
            let parent = button.parentElement;
            let depth = 0;
            while (parent && depth < 3) {
              if (parent.style) {
                parent.style.setProperty("filter", "none", "important");
                parent.style.setProperty("pointer-events", "auto", "important");
              }
              parent = parent.parentElement;
              depth++;
            }
          }
        });
      });
    } catch (error) {
      console.warn("[autoskip] Failed to ensure skip button visibility", error);
    }
  }

  private removeBlurFeature() {
    try {
      this.blurredElements.forEach((element) => {
        if (element && element.style) {
          element.style.removeProperty("filter");
          element.style.removeProperty("transition");
        }
      });
      this.blurredElements.clear();
      console.warn("[autoskip] Blur removed from all elements");
    } catch (error) {
      console.warn("[autoskip] Failed to remove blur feature", error);
    }
  }

  private getVideoElement(): HTMLVideoElement | null {
    try {
      return document.querySelector<HTMLVideoElement>(VIDEO_PLAYER_SELECTOR);
    } catch (error) {
      console.warn("[autoskip] Failed to get video element", error);
      return null;
    }
  }

  private scanForSkipButtons() {
    if (!this.isEnabled || this.contextInvalidated) {
      return;
    }

    // Only scan if ad is playing
    if (!this.isAdPlaying) {
      return;
    }

    try {
      const candidates = new Set<HTMLElement>();

      SKIP_BUTTON_SELECTORS.forEach((selector) => {
        try {
          document.querySelectorAll<HTMLElement>(selector).forEach((button) => {
            if (button instanceof HTMLElement) {
              candidates.add(button);
            }
          });
        } catch (error) {
          console.warn("[autoskip] Failed to query skip buttons", error);
        }
      });

      candidates.forEach((button) => {
        try {
          this.handleSkipButton(button);
        } catch (error) {
          console.warn("[autoskip] Failed to handle skip button", error);
        }
      });
    } catch (error) {
      console.warn("[autoskip] Failed to scan for skip buttons", error);
    }
  }

  private handleSkipButton(button: HTMLElement): boolean {
    try {
      // Don't process if no ad is actually playing
      if (!this.isAdPlaying) {
        console.warn("[autoskip] Skip button detected but no ad is playing - ignoring");
        return false;
      }

      const attempts = this.skipAttempts.get(button) ?? 0;
      if (attempts >= this.maxAttempts) {
        console.warn("[autoskip] Skip button max attempts reached");
        return false;
      }

      const readyState = this.isButtonReady(button);
      if (!readyState.ready) {
        console.warn(`[autoskip] Skip button not ready: ${readyState.reason}`);
        return false;
      }

      this.skipAttempts.set(button, attempts + 1);
      
      // Store ad state before attempting to skip
      const wasAdPlaying = this.isAdPlaying;
      
      // Simulate human-like click
      const success = this.simulateHumanClick(button);
      
      // Only increment counter if:
      // 1. Click was successful
      // 2. Ad was playing before click
      // 3. Counter hasn't been incremented for this ad yet
      if (success && wasAdPlaying && !this.adCounterIncremented) {
        // Wait briefly to verify ad state changed
        setTimeout(() => {
          if (!this.isAdPlaying || this.wasAdSkipped(wasAdPlaying)) {
            this.scheduleCounterIncrement();
            this.adCounterIncremented = true;
            console.warn("[autoskip] Ad successfully skipped, scheduling counter increment");
          } else {
            console.warn("[autoskip] Skip button clicked but ad still playing - counter not incremented");
          }
        }, 300);
      } else if (success && this.adCounterIncremented) {
        console.warn("[autoskip] Counter already incremented for this ad");
      }

      // Clean up attempt tracking after delay
      setTimeout(() => {
        this.skipAttempts.delete(button);
      }, 5000);

      return success;
    } catch (error) {
      console.warn("[autoskip] Failed to handle skip button", error);
      return false;
    }
  }

  private wasAdSkipped(wasAdPlaying: boolean): boolean {
    // Check if ad state changed after click attempt
    return wasAdPlaying && !this.isAdPlaying;
  }

  private isButtonReady(button: HTMLElement): { ready: boolean; reason?: string } {
    try {
      if (!button || !button.isConnected) {
        return { ready: false, reason: "Button not connected to DOM" };
      }

      const style = window.getComputedStyle(button);
      const rect = button.getBoundingClientRect();

      // Check visibility
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        parseFloat(style.opacity) > 0.1;

      if (!visible) {
        return { ready: false, reason: "Button not visible" };
      }

      // Check if button is enabled
      const enabled =
        !button.hasAttribute("disabled") &&
        button.getAttribute("aria-disabled") !== "true";

      if (!enabled) {
        return { ready: false, reason: "Button is disabled" };
      }

      // Check if button has valid dimensions
      const hasSize = rect.width > 0 && rect.height > 0;

      if (!hasSize) {
        return { ready: false, reason: "Button has no size" };
      }

      // Check pointer-events
      const pointerEvents = style.pointerEvents;
      if (pointerEvents === "none") {
        console.warn("[autoskip] Skip button has pointer-events: none, element might be blocked");
        return { ready: false, reason: "Button has pointer-events: none" };
      }

      // Check z-index (should be reasonably high to be clickable)
      const zIndex = parseInt(style.zIndex, 10);
      if (!isNaN(zIndex) && zIndex < 0) {
        console.warn("[autoskip] Skip button has negative z-index, might be behind other elements");
        return { ready: false, reason: "Button has negative z-index" };
      }

      // Check if button is actually clickable (not covered by other elements)
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);
      if (topElement !== button && !button.contains(topElement)) {
        console.warn("[autoskip] Skip button is covered by another element:", topElement);
        return { ready: false, reason: "Button is covered by another element" };
      }

      // Check for skip-related patterns
      const text = button.textContent?.toLowerCase() ?? "";
      const ariaLabel = button.getAttribute("aria-label")?.toLowerCase() ?? "";
      const hasSkipKeyword = 
        text.includes("skip") || 
        ariaLabel.includes("skip") ||
        button.classList.contains("ytp-skip-ad-button") ||
        button.classList.contains("ytp-ad-skip-button");

      if (!hasSkipKeyword) {
        return { ready: false, reason: "Button does not contain skip keyword" };
      }

      return { ready: true };
    } catch (error) {
      console.warn("[autoskip] Failed to evaluate button readiness", error);
      return { ready: false, reason: "Error evaluating button" };
    }
  }

  private simulateHumanClick(target: HTMLElement): boolean {
    try {
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      // Create realistic mouse event sequence
      const events = [
        new MouseEvent("mouseover", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
        }),
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 1,
        }),
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0,
        }),
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0,
        }),
      ];

      // Dispatch events with slight delays
      events.forEach((event, index) => {
        setTimeout(() => {
          try {
            target.dispatchEvent(event);
          } catch (error) {
            console.warn("[autoskip] Failed to dispatch event", error);
          }
        }, index * 15);
      });

      // Also call native click as backup
      setTimeout(() => {
        try {
          if (target.isConnected && typeof target.click === "function") {
            target.click();
            console.warn("[autoskip] Skip button clicked successfully");
          }
        } catch (error) {
          console.warn("[autoskip] Failed to simulate click", error);
        }
      }, events.length * 15 + 50);

      return true;
    } catch (error) {
      console.warn("[autoskip] Failed to simulate human click", error);
      try {
        if (typeof target.click === "function") {
          target.click();
          return true;
        }
      } catch (retryError) {
        console.warn("[autoskip] Failed to simulate click", retryError);
      }
      
      return false;
    }
  }

  private scheduleCounterIncrement() {
    if (this.pendingCounterUpdate || this.contextInvalidated) {
      console.warn("[autoskip] Counter increment skipped - already pending or context invalidated");
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastCounterUpdate;

    if (timeSinceLastUpdate < this.counterUpdateDelay) {
      // Schedule for later to avoid quota issues
      this.pendingCounterUpdate = true;
      setTimeout(() => {
        this.pendingCounterUpdate = false;
        this.incrementSkipCounter();
      }, this.counterUpdateDelay - timeSinceLastUpdate);
    } else {
      this.incrementSkipCounter();
    }
  }

  private incrementSkipCounter() {
    if (!this.api?.storage?.sync || this.contextInvalidated) {
      console.warn("[autoskip] Cannot increment counter - storage unavailable or context invalidated");
      return;
    }

    // Verify ad is actually playing before incrementing
    if (!this.isAdPlaying) {
      console.warn("[autoskip] Counter increment skipped - no ad is playing");
      return;
    }

    try {
      this.api.storage.sync.get(["adsSkipped"], (result) => {
        if (this.checkForErrors() || this.contextInvalidated) {
          console.warn("[autoskip] Failed to get current counter value");
          return;
        }
        
        const currentCount = typeof result.adsSkipped === "number" ? result.adsSkipped : 0;
        const newCount = currentCount + 1;
        
        this.api!.storage.sync.set({ adsSkipped: newCount }, () => {
          if (!this.checkForErrors()) {
            this.lastCounterUpdate = Date.now();
            console.warn(`[autoskip] Skip counter incremented: ${currentCount} -> ${newCount}`);
          } else {
            console.warn("[autoskip] Failed to save counter value");
          }
        });
      });
    } catch (error) {
      this.logError("Failed to increment counter", error);
    }
  }

  private checkForErrors(): boolean {
    if (this.api?.runtime?.lastError) {
      const message = this.api.runtime.lastError.message || "";
      
      // Check for context invalidation
      if (message.includes("Extension context invalidated")) {
        console.warn("[autoskip] Extension context invalidated - extension may need to be reloaded");
        this.contextInvalidated = true;
        this.cleanup();
        return true;
      }
      
      // Check for quota errors
      if (message.includes("MAX_WRITE_OPERATIONS_PER_MINUTE") || message.includes("quota")) {
        console.warn("[autoskip] Storage quota exceeded - writes throttled");
        return true;
      }
      
      // Check for permission errors
      if (message.includes("permission") || message.includes("403")) {
        console.warn("[autoskip] Permission error: ", message);
        console.warn("[autoskip] Try reloading the extension or checking permissions");
        return true;
      }
      
      // Check for sandboxed frame errors
      if (message.includes("sandboxed")) {
        console.warn("[autoskip] Sandboxed frame error - cannot access this page");
        return true;
      }
      
      // Check for network errors
      if (message.includes("net::ERR_") || message.includes("network")) {
        console.warn("[autoskip] Network error: ", message);
        return true;
      }
      
      console.warn("[autoskip] Runtime error: ", message);
      return true;
    }
    return false;
  }

  private logError(message: string, error: any) {
    if (typeof error === "object" && error?.message?.includes("Extension context invalidated")) {
      this.contextInvalidated = true;
      this.cleanup();
    }
    console.warn(`[autoskip] ${message}`, error);
  }
}

// Initialize the watcher
(() => {
  try {
    console.warn("[autoskip] Initializing AutoSkipWatcher");
    new AutoSkipWatcher();
  } catch (error) {
    console.warn("[autoskip] Failed to initialize AutoSkipWatcher", error);
  }
})();