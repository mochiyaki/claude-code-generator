import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import sp from "./locales/sp.json";
import jp from "./locales/jp.json";

const resources = {
  en: {
    translation: en,
  },
  zh: {
    translation: zh,
  },
  sp: {
    translation: sp,
  },
  jp: {
    translation: jp,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
