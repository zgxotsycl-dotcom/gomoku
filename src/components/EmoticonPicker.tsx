'use client';

import { useState, useEffect, useRef } from 'react';

interface EmoticonPickerProps { 
    onSelect: (emoticon: string) => void;
}

const EmoticonPicker = ({ onSelect }: EmoticonPickerProps) => {
    const emoticons = ['😊', '😂', '😭', '👍', '🤔', '🔥', '🎉', '❤️'];
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    const handleSelect = (emoticon: string) => {
        onSelect(emoticon);
        setIsOpen(false);
    }

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={pickerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="p-3 bg-gray-700/80 backdrop-blur-md rounded-full text-2xl btn-hover-scale"
            >
                😊
            </button>
            
            {/* Animated Panel - now opens to the left */}
            <div className={`absolute bottom-full right-0 mb-3 p-2 bg-gray-800 border border-gray-700 rounded-lg grid grid-cols-4 gap-2 z-20 w-max transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                {emoticons.map(emo => (
                    <button 
                        key={emo} 
                        onClick={() => handleSelect(emo)} 
                        className="text-3xl p-1 rounded-md hover:bg-gray-600 transition-colors"
                    >
                        {emo}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default EmoticonPicker;
