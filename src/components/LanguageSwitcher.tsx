'use client';

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { languages } from '@/i18n/settings';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const changeLanguage = (lng: string) => {
    const currentLng = pathname.split('/')[1];
    if (languages.includes(currentLng)) {
      const newPath = pathname.replace(`/${currentLng}`, `/${lng}`);
      router.push(newPath);
    } else {
      router.push(`/${lng}${pathname}`);
    }
    setIsOpen(false);
  };

  const locales: { [key: string]: string } = {
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
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600 disabled:text-gray-400"
                  disabled={i18n.language === lng}
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