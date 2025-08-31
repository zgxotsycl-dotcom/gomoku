import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { FaStar, FaPalette, FaHistory, FaBrain } from 'react-icons/fa';

interface SupporterBenefitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGuest: boolean;
}

const SupporterBenefitsModal = ({ isOpen, onClose, isGuest }: SupporterBenefitsModalProps) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const benefits = [
    { icon: <FaStar className="text-yellow-400" />, title: t('Benefit1Title'), description: t('Benefit1Desc') },
    { icon: <FaPalette className="text-cyan-400" />, title: t('Benefit2Title'), description: t('Benefit2Desc') },
    { icon: <FaHistory className="text-indigo-400" />, title: t('Benefit3Title'), description: t('Benefit3Desc') },
    { icon: <FaBrain className="text-green-400" />, title: t('Benefit4Title'), description: t('Benefit4Desc') },
  ];

  const handleLogin = () => {
    supabase.auth.signOut();
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
            <div key={index} className="p-3 bg-gray-700 rounded-lg flex items-center gap-4">
              <div className="text-2xl">{benefit.icon}</div>
              <div>
                <h3 className="font-semibold text-white">{benefit.title}</h3>
                <p className="text-sm text-gray-400">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 w-full">
          {isGuest ? (
            <button onClick={handleLogin} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-500">
              {t('LoginToSupport')}
            </button>
          ) : (
            <div className="w-full">
              <a
                href="https://3614751670147.gumroad.com/l/tkdjxl"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full max-w-xs mx-auto px-8 py-4 bg-pink-500 text-white font-bold rounded-lg hover:bg-pink-600 transition-colors text-xl"
              >
                {t('Pay with Card (Gumroad)')}
              </a>
            </div>
          )}
          <button onClick={onClose} className="mt-4 text-sm text-gray-400 hover:underline">{t('MaybeLater')}</button>
        </div>
      </div>
    </div>
  );
};

export default SupporterBenefitsModal;