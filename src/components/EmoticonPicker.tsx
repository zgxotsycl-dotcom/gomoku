'use client';

import React from 'react';

interface EmoticonPickerProps {
    onSelect: (emoticon: string) => void;
}

const EmoticonPicker: React.FC<EmoticonPickerProps> = ({ onSelect }) => {
    const emoticons = ['😊', '😂', '😭', '👍', '🤔', '🔥'];
    return (
        <div className="flex gap-2 p-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-full">
            {emoticons.map(emo => (
                <button key={emo} onClick={() => onSelect(emo)} className="text-2xl hover:scale-125 transition-transform">
                    {emo}
                </button>
            ))}
        </div>
    );
};

export default EmoticonPicker;
