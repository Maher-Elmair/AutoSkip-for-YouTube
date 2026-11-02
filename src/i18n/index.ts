import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { normalizeLanguage, resources, supportedLanguages } from "./languages";
import { DEBUG } from "@/extension/shared/logger";

// Initialize the i18n library
i18n
  .use(LanguageDetector) // detect user language
  .use(initReactI18next) // pass i18n instance to react-i18next
  .init({
    fallbackLng: "en",
    supportedLngs: supportedLanguages.map(({ code }) => code),
    load: "currentOnly",
    debug: DEBUG,
    resources,
    interpolation: {
      escapeValue: false, // React already protects from XSS
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      convertDetectedLanguage: normalizeLanguage,
    },
  });

export default i18n;
