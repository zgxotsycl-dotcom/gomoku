'use client';

import { useState } from 'react';
import { IoIosInformationCircleOutline } from 'react-icons/io';
import { useTranslation } from 'react-i18next';

const RuleInfo = () => {
    const { t } = useTranslation();
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsTooltipVisible(true)}
            onMouseLeave={() => setIsTooltipVisible(false)}
        >
            <IoIosInformationCircleOutline className="text-gray-400 text-2xl cursor-pointer" />
            {isTooltipVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-30">
                    <h4 className="font-bold text-white border-b border-gray-600 pb-1 mb-2">{t('RenjuRulesTitle', 'Renju Rules (Black Only)')}</h4>
                    <ul className="text-sm text-gray-300 list-disc list-inside space-y-1">
                        <li><strong>3-3:</strong> {t('Rule33', 'Placing a stone that simultaneously forms two or more open threes.')}</li>
                        <li><strong>4-4:</strong> {t('Rule44', 'Placing a stone that simultaneously forms two or more fours.')}</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default RuleInfo;
