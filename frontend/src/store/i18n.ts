import { create } from "zustand";
import { SupportedLang, translate, LANGUAGES, LanguageInfo, setActiveLang } from "../lib/i18n";

interface I18nState {
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  availableLanguages: LanguageInfo[];
}

const getInitialLang = (): SupportedLang => {
  const saved = localStorage.getItem("ch_lang");
  if (saved === "am" || saved === "om" || saved === "ti" || saved === "en") return saved;
  return "en";
};

// The build-time translator resolves copy through lib/i18n at render time, so
// the store has to publish the chosen language before anything paints.
const initialLang = getInitialLang();
setActiveLang(initialLang);
document.documentElement.lang = initialLang;

export const useI18n = create<I18nState>((set) => ({
  lang: initialLang,
  availableLanguages: LANGUAGES,
  setLang: (lang: SupportedLang) => {
    localStorage.setItem("ch_lang", lang);
    document.documentElement.lang = lang;
    setActiveLang(lang);
    set({ lang });
  },
}));

export function useTranslation() {
  const lang = useI18n((state) => state.lang);
  const setLang = useI18n((state) => state.setLang);
  const availableLanguages = useI18n((state) => state.availableLanguages);

  const t = (key: string, fallback?: string): string => {
    return translate(key, lang, fallback);
  };

  const currentLanguage =
    availableLanguages.find((l) => l.code === lang) ?? availableLanguages[0];

  return { lang, setLang, t, availableLanguages, currentLanguage };
}
