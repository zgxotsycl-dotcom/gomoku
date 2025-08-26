'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [nicknameColor, setNicknameColor] = useState('#FFFFFF');
  const [badgeColor, setBadgeColor] = useState('#FFD700');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isOpen) return;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('nickname_color, badge_color')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setNicknameColor(data.nickname_color || '#FFFFFF');
        setBadgeColor(data.badge_color || '#FFD700');
      }
    };
    fetchProfile();
  }, [user, isOpen]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ nickname_color: nicknameColor, badge_color: badgeColor })
      .eq('id', user.id);

    if (error) {
      toast.error(t('FailedToSaveSettings'));
    } else {
      toast.success(t('SettingsSaved'));
      onClose();
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">{t('ColorSettings')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t('NicknameColor')}</label>
            <div className="flex items-center gap-2">
              <input type="color" value={nicknameColor} onChange={(e) => setNicknameColor(e.target.value)} className="w-10 h-10 rounded border-gray-600"/>
              <input type="text" value={nicknameColor} onChange={(e) => setNicknameColor(e.target.value)} className="w-full px-2 py-1 rounded bg-gray-700 text-white border border-gray-600"/>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t('PatronBadgeColor')}</label>
            <div className="flex items-center gap-2">
                <input type="color" value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} className="w-10 h-10 rounded border-gray-600"/>
                <input type="text" value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} className="w-full px-2 py-1 rounded bg-gray-700 text-white border border-gray-600"/>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500">{t('Cancel')}</button>
          <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:bg-gray-400">
            {loading ? t('Saving') : t('Save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
