import en from "../locales/en/translation.json";
import ar from "../locales/ar/translation.json";
import de from "../locales/de/translation.json";
import es from "../locales/es/translation.json";
import fr from "../locales/fr/translation.json";
import ja from "../locales/ja/translation.json";
import ko from "../locales/ko/translation.json";
import ptBR from "../locales/pt-BR/translation.json";
import zhCN from "../locales/zh-CN/translation.json";
import zhTW from "../locales/zh-TW/translation.json";

// Keep native names visible so users can find their language from any locale.
export const supportedLanguages = [
  { code: "en", nativeName: "English", chromeLocale: "en", translation: en },
  { code: "ar", nativeName: "العربية", chromeLocale: "ar", translation: ar },
  { code: "de", nativeName: "Deutsch", chromeLocale: "de", translation: de },
  { code: "es", nativeName: "Español", chromeLocale: "es", translation: es },
  { code: "fr", nativeName: "Français", chromeLocale: "fr", translation: fr },
  { code: "ja", nativeName: "日本語", chromeLocale: "ja", translation: ja },
  { code: "ko", nativeName: "한국어", chromeLocale: "ko", translation: ko },
  { code: "pt-BR", nativeName: "Português (Brasil)", chromeLocale: "pt_BR", translation: ptBR },
  { code: "zh-CN", nativeName: "简体中文", chromeLocale: "zh_CN", translation: zhCN },
  { code: "zh-TW", nativeName: "繁體中文", chromeLocale: "zh_TW", translation: zhTW },
] as const;

export const resources = Object.fromEntries(
  supportedLanguages.map(({ code, translation }) => [code, { translation }]),
);

export function normalizeLanguage(language: string): string {
  const normalized = language.replace(/_/g, "-");
  const [base, ...subtags] = normalized.toLowerCase().split("-");

  // Honor an explicit script before the region (for example, zh-Hans-HK).
  if (base === "zh") {
    if (subtags.includes("hans")) return "zh-CN";
    if (subtags.includes("hant")) return "zh-TW";
    return subtags.some((tag) => ["tw", "hk", "mo"].includes(tag))
      ? "zh-TW"
      : "zh-CN";
  }

  // Brazilian Portuguese is currently the available Portuguese translation.
  if (base === "pt") return "pt-BR";
  if (supportedLanguages.some(({ code }) => code === base)) return base;

  // Let i18next try the remaining preferred languages before falling back.
  return normalized;
}
