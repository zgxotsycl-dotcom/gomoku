'use client';

import React from 'react';

interface PatronBadgeProps {
    color: string | null;
    text: string;
}

const PatronBadge = ({ color, text }: PatronBadgeProps) => (
    <span 
        className="ml-2 text-sm font-bold align-middle"
        style={{ color: color || '#FFD700' }}
    >
        ⭐ {text}
    </span>
);

export default PatronBadge;