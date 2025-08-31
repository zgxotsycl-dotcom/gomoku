'use client';

import i18n from 'i18next';
import { initReactI18next, useTranslation as useTranslationOrg } from 'react-i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { getOptions } from './i18n/settings';

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(resourcesToBackend((language, namespace) => import(`../public/locales/${language}/${namespace}.json`)))
  .init(getOptions());

export function useTranslation(lng, ns, options) {
  const ret = useTranslationOrg(ns, options);
  const { i18n } = ret;
  if (i18n.resolvedLanguage !== lng) {
    i18n.changeLanguage(lng);
  }
  return ret;
}

export default i18n;