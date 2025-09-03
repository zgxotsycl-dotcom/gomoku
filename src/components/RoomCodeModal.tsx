'use client';

import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

interface RoomCodeModalProps {
    roomId: string;
    onClose: () => void;
}

const RoomCodeModal = ({ roomId, onClose }: RoomCodeModalProps) => {
    const { t } = useTranslation();

    const handleCopy = () => {
        navigator.clipboard.writeText(roomId);
        toast.success(t('RoomCodeCopied'));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl relative">
                <h2 className="text-2xl text-white mb-4">{t('PrivateRoomCreated')}</h2>
                <p className="text-white mb-4">{t('ShareThisCode')}</p>
                <div className="flex items-center gap-4">
                    <input type="text" value={roomId} readOnly className="px-4 py-2 rounded text-black bg-gray-200 w-full" />
                    <button onClick={handleCopy} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 btn-hover-scale">{t('Copy')}</button>
                </div>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 btn-hover-scale">{t('Close')}</button>
            </div>
        </div>
    );
};

export default RoomCodeModal;