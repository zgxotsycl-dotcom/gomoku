"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';

interface Swap2OptionsModalProps {
  visible: boolean;
  loading?: boolean;
  onStayWhite: () => void;
  onSwapToBlack: () => void;
  onForceFirstChoice: () => void;
  onCancel?: () => void;
}

export function Swap2OptionsModal({ visible, loading = false, onStayWhite, onSwapToBlack, onForceFirstChoice, onCancel }: Swap2OptionsModalProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-slime-in bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl w-[720px] max-w-[96%] relative">
        <h3 className="text-center text-white text-2xl font-bold mb-3">{t('swap2.options.title', 'Swap2 옵션')}</h3>
        <p className="text-center text-gray-300 mb-6 text-sm">{t('swap2.options.subtitle', '아래에서 한 가지를 선택하세요.')}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button type="button"
            disabled={loading}
            onClick={onStayWhite}
            className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale disabled:opacity-60"
          >
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_55%)]" />
            <div className="flex flex-col items-start gap-2 text-left">
              <span className="text-white font-bold text-lg">{t('swap2.options.opt1', '옵션 1 – 백 유지')}</span>
              <span className="text-gray-300 text-sm">{t('swap2.options.opt1.desc', '색상을 바꾸지 않고 백으로 진행합니다.')}</span>
            </div>
          </button>

          <button type="button"
            disabled={loading}
            onClick={onSwapToBlack}
            className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale disabled:opacity-60"
          >
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.2),transparent_55%)]" />
            <div className="flex flex-col items-start gap-2 text-left">
              <span className="text-white font-bold text-lg">{t('swap2.options.opt2', '옵션 2 – 흑으로 교환')}</span>
              <span className="text-gray-300 text-sm">{t('swap2.options.opt2.desc', '흑으로 바꾸고 다음 수를 진행합니다. (교환)')}</span>
            </div>
          </button>

          <button type="button"
            disabled={loading}
            onClick={onForceFirstChoice}
            className="group relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 hover:from-gray-700 hover:to-gray-600 transition-all duration-200 btn-hover-scale disabled:opacity-60"
          >
            <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.2),transparent_55%)]" />
            <div className="flex flex-col items-start gap-2 text-left">
              <span className="text-white font-bold text-lg">{t('swap2.options.opt3', '옵션 3 – 추가 두 수 배치')}</span>
              <span className="text-gray-300 text-sm">{t('swap2.options.opt3.desc', '백 1수, 흑 1수를 추가로 두고 두 번째 결정을 진행합니다.')}</span>
            </div>
          </button>
        </div>

        {onCancel && (
          <button type="button"
            disabled={loading}
            onClick={onCancel}
            className="mt-6 w-full py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition disabled:opacity-50"
          >
            {t('Cancel', '취소')}
          </button>
        )}
      </div>
    </div>
  );
}

export default Swap2OptionsModal;

