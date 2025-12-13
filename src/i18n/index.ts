import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

// Initialize the i18n library
i18n
  .use(HttpBackend) // load translation files
  .use(LanguageDetector) // detect user language
  .use(initReactI18next) // pass i18n instance to react-i18next
  .init({
    fallbackLng: 'en', // default language
    debug: true, // enable debug mode
    interpolation: {
      escapeValue: false, // React already protects from XSS
    },
    // Fix for Select component showing empty on first load
    // Browser returns regional language codes (en-US) but our app expects base codes (en)
    detection: {
      // Normalize language codes by taking only the primary part
      // This converts codes like 'en-US' to 'en' and 'ar-SA' to 'ar'
      convertDetectedLanguage: (lng) => {
        return lng.split("-")[0];
      },
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json', // path to translation files
    },
  });

export default i18n;
