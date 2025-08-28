'use client';

import React from 'react';
import PayPalButton from '@/components/PayPalButton';
import { useTranslation } from 'react-i18next';

interface SupporterBenefitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGuest: boolean;
}

const SupporterBenefitsModal = ({ isOpen, onClose, isGuest }: SupporterBenefitsModalProps) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const benefits = [
    { title: t('Benefit1Title'), description: t('Benefit1Desc') },
    { title: t('Benefit2Title'), description: t('Benefit2Desc') },
    { title: t('Benefit3Title'), description: t('Benefit3Desc') },
    { title: t('Benefit4Title'), description: t('Benefit4Desc') },
  ];

  const handleLogin = () => {
    // Logic to handle login
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg border border-gray-700">
        <h2 className="text-3xl font-bold text-white mb-4 text-center text-yellow-400">{t('SupporterPerks')}</h2>
        <p className="text-center text-gray-300 mb-6">
          {isGuest ? t('LoginToSupportMessage') : t('SupportMessage')}
        </p>
        
        <div className="space-y-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="p-3 bg-gray-700 rounded-lg">
              <h3 className="font-semibold text-white">{benefit.title}</h3>
              <p className="text-sm text-gray-400">{benefit.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 w-full">
          {isGuest ? (
            <button onClick={handleLogin} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-500">
              {t('LoginToSupport')}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="w-full p-3 bg-gray-900 rounded-lg">
                <p className="text-center text-white font-bold mb-2">For International Users</p>
                <PayPalButton onPaymentSuccess={onClose} />
              </div>
              <div className="w-full p-3 bg-gray-900 rounded-lg">
                <p className="text-center text-white font-bold mb-2">국내 사용자 (For Korean Users)</p>
                <a
                  href="https://3614751670147.gumroad.com/l/tkdjxl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-6 py-3 bg-pink-500 text-white font-bold rounded-lg hover:bg-pink-600 transition-colors text-lg"
                >
                  {t('BecomeASupporter')} (Gumroad)
                </a>
              </div>
            </div>
          )}
          <button onClick={onClose} className="mt-4 text-sm text-gray-400 hover:underline">{t('MaybeLater')}</button>
        </div>
      </div>
    </div>
  );
};

export default SupporterBenefitsModal;
