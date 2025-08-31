'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { FaPaintBrush, FaStar, FaUser, FaLock } from 'react-icons/fa'; // Import FaUser

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const { t } = useTranslation();
  const { user, profile } = useAuth(); // Get profile from auth context
  const [username, setUsername] = useState(''); // State for username
  const [nicknameColor, setNicknameColor] = useState('#FFFFFF');
  const [badgeColor, setBadgeColor] = useState('#FFD700');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isOpen) return;
    // Use profile from context if available, otherwise fetch
    if (profile) {
        setUsername(profile.username || '');
        setNicknameColor(profile.nickname_color || '#FFFFFF');
        setBadgeColor(profile.badge_color || '#FFD700');
    } else {
        const fetchProfile = async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('username, nickname_color, badge_color, is_supporter')
            .eq('id', user.id)
            .single();
          
          if (data) {
            setUsername(data.username || '');
            setNicknameColor(data.nickname_color || '#FFFFFF');
            setBadgeColor(data.badge_color || '#FFD700');
          }
        };
        fetchProfile();
    }
  }, [user, isOpen, profile]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    
    const updateData: {
        username: string;
        nickname_color?: string;
        badge_color?: string;
    } = {
        username: username,
    };

    if (profile?.is_supporter) {
        updateData.nickname_color = nicknameColor;
        updateData.badge_color = badgeColor;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    setLoading(false);

    if (error) {
      toast.error(t('FailedToSaveSettings') + ': ' + error.message);
    } else {
      toast.success(t('SettingsSaved'));
      onClose();
      // Reload the page to reflect the updated profile information
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">{t('Settings')}</h2>
        <div className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <FaUser /> {t('Nickname')}
            </label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              className="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your nickname"
            />
          </div>
          {/* Nickname Color Picker */}
          <div className={!profile?.is_supporter ? 'locked-feature' : ''}>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <FaPaintBrush /> {t('NicknameColor')}
              {!profile?.is_supporter && <FaLock className="lock-icon" />}
            </label>
            <div className="flex items-center gap-2">
              <input type="color" value={nicknameColor} onChange={(e) => setNicknameColor(e.target.value)} className="w-10 h-10 rounded border-gray-600" disabled={!profile?.is_supporter}/>
              <input type="text" value={nicknameColor} onChange={(e) => setNicknameColor(e.target.value)} className="w-full px-2 py-1 rounded bg-gray-700 text-white border border-gray-600" disabled={!profile?.is_supporter}/>
            </div>
          </div>
          {/* Badge Color Picker */}
          <div className={!profile?.is_supporter ? 'locked-feature' : ''}>
            <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <FaStar /> {t('PatronBadgeColor')}
              {!profile?.is_supporter && <FaLock className="lock-icon" />}
            </label>
            <div className="flex items-center gap-2">
                <input type="color" value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} className="w-10 h-10 rounded border-gray-600" disabled={!profile?.is_supporter}/>
                <input type="text" value={badgeColor} onChange={(e) => setBadgeColor(e.target.value)} className="w-full px-2 py-1 rounded bg-gray-700 text-white border border-gray-600" disabled={!profile?.is_supporter}/>
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