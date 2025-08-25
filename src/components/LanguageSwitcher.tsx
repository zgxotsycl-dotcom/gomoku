'use client';

import { useTranslation } from 'react-i18next';
import { useState } from 'react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  const locales = {
    en: 'English',
    ko: '한국어',
    ja: '日本語',
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-700 flex items-center gap-1 text-white"
      >
        {locales[i18n.language] || 'Language'}
        <span className="text-xs">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-gray-700 rounded shadow-lg z-10">
          <ul>
            {Object.keys(locales).map((lng) => (
              <li key={lng}>
                <button 
                  onClick={() => changeLanguage(lng)}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600"
                >
                  {locales[lng]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}