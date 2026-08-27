import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../../public/locales/en/translation.json";
import ar from "../../public/locales/ar/translation.json";
import { DEBUG } from "@/extension/shared/logger";

// Initialize the i18n library
i18n
  .use(LanguageDetector) // detect user language
  .use(initReactI18next) // pass i18n instance to react-i18next
  .init({
    fallbackLng: 'en', // default language
    debug: DEBUG, 
        resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    interpolation: {
      escapeValue: false, // React already protects from XSS
    },
    // Fix for Select component showing empty on first load
    // Browser returns regional language codes (en-US) but our app expects base codes (en)
    detection: {
      // Normalize language codes by taking only the primary part
      // This converts codes like 'en-US' to 'en' and 'ar-SA' to 'ar'
      convertDetectedLanguage: (lng) => lng.split("-")[0],
    },
  });

export default i18n;
