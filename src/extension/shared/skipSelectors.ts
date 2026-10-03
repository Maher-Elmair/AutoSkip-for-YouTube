/**
 * All YouTube-specific selectors live here so a YouTube redesign can be
 * fixed by editing this single data file (GitHub issue #1).
 */

export const PLAYER_SELECTOR = "#movie_player";
export const VIDEO_PLAYER_SELECTOR = "video.html5-main-video";
export const BLUR_OVERLAY_ID = "autoskip-blur-overlay";
/** Assist mode: pulsing ring drawn over (never inside) the skip button. */
export const HIGHLIGHT_OVERLAY_ID = "autoskip-highlight-ring";
/** Auto mode: short confirmation toast after a trusted click. */
export const TOAST_ID = "autoskip-toast";
export const INJECTED_STYLE_ID = "autoskip-injected-style";

/** Precise selectors for buttons that skip a video ad and may update stats. */
export const AD_SKIP_SELECTORS = [
  ".ytp-skip-ad-button",
  ".ytp-ad-skip-button",
  ".ytp-ad-skip-button-modern",
  ".ytp-ad-skip-button-slot button",
  "button.ytp-ad-skip-button-modern",
  ".ytp-ad-skip-button-container button",
  ".ytp-ad-skip-button-slot .ytp-skip-ad-button",
  '[id^="skip-button"] button',
] as const;

/** Survey controls are useful to dismiss, but are not video-ad skips. */
export const SURVEY_SKIP_SELECTORS = [
  ".ytp-ad-survey-answer-selector .ytp-ad-survey-skip-button",
  ".ytp-ad-survey-skip-button",
] as const;

/** Overlay/banner close controls never count as skipped video ads. */
export const OVERLAY_CLOSE_SELECTORS = [
  ".ytp-ad-overlay-close-button",
] as const;

/**
 * Broad compatibility fallbacks. These run only while an ad signal is active
 * and never update the counter.
 */
export const FALLBACK_SKIP_SELECTORS = [
  'button[aria-label*="Skip" i]',
  'button[class*="skip-ad" i]',
  'button[class*="skip-button" i]',
] as const;

/** Indicators that an ad is currently playing (OR logic, no scoring). */
export const AD_INDICATOR_SELECTORS = [
  ".ytp-ad-player-overlay",
  ".ytp-ad-player-overlay-layout",
  ".ytp-ad-module",
  ".video-ads",
  ".ytp-ad-text",
  ".ytp-ad-badge",
  ".ytp-ad-preview-container",
  ".ytp-ad-simple-ad-badge",
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

/**
 * Labels that contain a skip keyword but are NOT ad-skip buttons
 * (chapter/intro skipping, navigation, accessibility helpers).
 */
export const SKIP_EXCLUDE_KEYWORDS = [
  "intro",
  "المقدمة",
  "chapter",
  "فصل",
  "next",
  "التالي",
  "content",
  "navigation",
  "recap",
  "credits",
] as const;
