import React from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabaseClient';
import { FaStar, FaPalette, FaHistory, FaBrain, FaBan, FaTrophy } from 'react-icons/fa';

interface SupporterBenefitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGuest: boolean;
}

const SupporterBenefitsModal = ({ isOpen, onClose, isGuest }: SupporterBenefitsModalProps) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const benefits = [
    { icon: <FaStar className="text-yellow-400" />, title: t('Benefit1Title', 'Supporter-only Badge'), description: t('Benefit1Desc', 'Display a special badge next to your name.') },
    { icon: <FaPalette className="text-cyan-400" />, title: t('Benefit2Title', 'Custom Colors'), description: t('Benefit2Desc_new', 'Change your name color and profile banner color.') },
    { icon: <FaHistory className="text-indigo-400" />, title: t('Benefit3Title', 'Access to Replays'), description: t('Benefit3Desc', 'Save and watch your past matches.') },
    { icon: <FaBrain className="text-green-400" />, title: t('Benefit4Title', 'AI Analysis'), description: t('Benefit4Desc', 'Get AI-powered analysis of your games.') },
    { icon: <FaBan className="text-red-500" />, title: t('AdRemovalTitle', 'Ad-Free Experience'), description: t('AdRemovalDesc', 'Enjoy the game without any advertisements.') },
    { icon: <FaTrophy className="text-yellow-500" />, title: t('TournamentHostTitle', 'Host Tournaments'), description: t('TournamentHostDesc', 'You can create and host your own tournaments.') },
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
            <button onClick={handleLogin} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-500 btn-hover-scale">
              {t('LoginToSupport')}
            </button>
          ) : (
            <div className="w-full">
              <a
                href="https://3614751670147.gumroad.com/l/tkdjxl"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full max-w-xs mx-auto px-8 py-4 bg-pink-500 text-white font-bold rounded-lg hover:bg-pink-600 transition-colors text-xl btn-hover-scale"
              >
                {t('Pay with Card (Gumroad)')}
              </a>
            </div>
          )}
          <button onClick={onClose} className="mt-4 text-sm text-gray-400 hover:underline btn-hover-scale">{t('MaybeLater')}</button>
        </div>
      </div>
    </div>
  );
};

export default SupporterBenefitsModal;