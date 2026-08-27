/**
 * All YouTube-specific selectors live here so a YouTube redesign can be
 * fixed by editing this single data file (GitHub issue #1).
 */

export const PLAYER_SELECTOR = "#movie_player";
export const VIDEO_PLAYER_SELECTOR = "video.html5-main-video";
export const BLUR_OVERLAY_ID = "autoskip-blur-overlay";

/** Known skip button selectors, scoped to the player container at query time. */
export const SKIP_BUTTON_SELECTORS = [
  ".ytp-skip-ad-button",
  ".ytp-ad-skip-button",
  ".ytp-ad-skip-button-modern",
  ".ytp-ad-skip-button-slot button",
  "button.ytp-ad-skip-button-modern",
  ".ytp-ad-skip-button-container button",
] as const;

/** Indicators that an ad is currently playing (OR logic, no scoring). */
export const AD_INDICATOR_SELECTORS = [
  ".ytp-ad-player-overlay",
  ".ytp-ad-module",
  ".video-ads",
  ".ytp-ad-text",
  ".ytp-ad-preview-container",
] as const;

export const AD_CLASS_NAMES = ["ad-showing", "ad-interrupting"] as const;

/**
 * Heuristic fallback keywords for when YouTube renames its classes.
 * Matched against short button text / aria-labels inside #movie_player only.
 */
export const SKIP_KEYWORDS = [
  "skip",
  "تخط", // تخطي / تخطى
  "saltar",
  "ignorer",
  "überspringen",
  "salta",
  "pular",
  "пропустить",
  "スキップ",
  "건너뛰기",
  "跳过",
  "跳過",
  "atla",
] as const;

export const MAX_HEURISTIC_LABEL_LENGTH = 40;
