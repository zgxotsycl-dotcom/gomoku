'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { FaCopy, FaCheck } from 'react-icons/fa';

interface RoomCodeModalProps {
  roomId: string;
  onClose: () => void;
}

const RoomCodeModal: React.FC<RoomCodeModalProps> = ({ roomId, onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      toast.success(t('RoomCodeCopied'));
      setTimeout(() => setCopied(false), 2000);
    }, () => {
      toast.error(t('FailedToCopy'));
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 animate-fade-in">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-xl w-full max-w-sm text-center border border-gray-700 transform transition-all animate-pop-in">
        <h2 className="text-2xl font-bold text-white mb-4">{t('PrivateRoomCreated')}</h2>
        <p className="text-gray-400 mb-6">{t('ShareThisCode')}</p>
        <div className="flex items-center justify-center p-4 bg-gray-900 rounded-lg mb-6">
          <p className="text-3xl font-mono tracking-widest text-yellow-400">{roomId}</p>
          <button onClick={handleCopy} className="ml-4 p-2 text-gray-300 hover:text-white transition-colors">
            {copied ? <FaCheck className="text-green-500" /> : <FaCopy />}
          </button>
        </div>
        <button onClick={onClose} className="w-full px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">
          {t('OK')}
        </button>
      </div>
    </div>
  );
};

export default RoomCodeModal;
