"use client";

import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { languages } from "@/i18n/settings";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const changeLanguage = (lng: string) => {
    try {
      const maxAge = 60 * 60 * 24 * 365; // 1 year
      document.cookie = `i18next=${lng}; Max-Age=${maxAge}; Path=/`;
      localStorage.setItem("preferredLng", lng);
      i18n.changeLanguage?.(lng);
    } catch {}
    const currentLng = pathname.split("/")[1];
    if (languages.includes(currentLng)) {
      const newPath = pathname.replace(`/${currentLng}`, `/${lng}`);
      router.push(newPath);
    } else {
      router.push(`/${lng}${pathname}`);
    }
    setIsOpen(false);
  };

  const locales: { [key: string]: string } = {
    en: "English",
    ko: "한국어",
    ja: "日本語",
  };

  useEffect(() => {
    try {
      const hasCookie = /(?:^|; )i18next=/.test(document.cookie);
      if (!hasCookie) {
        const pref = localStorage.getItem("preferredLng");
        const picked = pref && languages.includes(pref) ? pref : i18n.language;
        const maxAge = 60 * 60 * 24 * 365;
        document.cookie = `i18next=${picked}; Max-Age=${maxAge}; Path=/`;
      }
    } catch {}
  }, [i18n.language]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-700 flex items-center gap-1 text-white btn-hover-scale"
      >
        {locales[i18n.language] || "Language"}
        <span className="text-xs">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-gray-700 rounded shadow-lg z-10">
          <ul>
            {Object.keys(locales).map((lng) => (
              <li key={lng}>
                <button
                  onClick={() => changeLanguage(lng)}
                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-600 disabled:text-gray-400 btn-hover-scale"
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