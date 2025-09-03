'use client';

import { useEffect, useState, useId, useRef } from 'react';

const keyframes = `
@keyframes arc-and-fall {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  40% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--x), calc(var(--y) + 80px)) scale(0.2);
    opacity: 0;
  }
}
`;

const particleStyle = `
.firework-particle-final {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--color);
  transform-origin: 50% 50%;
  animation-name: arc-and-fall;
  animation-timing-function: cubic-bezier(0.15, 0.8, 0.5, 1);
  animation-fill-mode: forwards;
  will-change: transform, opacity;
}
`;

interface SingleExplosionProps {
    particleCount: number;
    color: string;
    radius: number;
    type: 'peony' | 'crackle';
}

interface Particle {
    id: number;
    style: React.CSSProperties & {
        '--x': string;
        '--y': string;
        '--color': string;
    };
}

const SingleExplosion = ({ particleCount, color, radius, type }: SingleExplosionProps) => {
    const [particles, setParticles] = useState<Particle[]>([]);

    useEffect(() => {
        const newParticles = Array.from({ length: particleCount }).map((_, i) => {
            const angle = Math.random() * Math.PI * 2;
            const r = type === 'crackle' ? Math.random() * radius : Math.pow(Math.random(), 2) * radius;
            const duration = 1.5 + Math.random() * 0.5;

            return {
                id: i,
                style: {
                    '--x': `${Math.cos(angle) * r}px`,
                    '--y': `${Math.sin(angle) * r}px`,
                    '--color': color,
                    animationDuration: `${duration}s`,
                },
            };
        });
        setParticles(newParticles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            {particles.map(p => (
                <div key={p.id} className="firework-particle-final" style={p.style as React.CSSProperties}></div>
            ))}
        </>
    );
};

interface Firework {
    id: number;
    x: number;
    y: number;
    type: 'peony' | 'crackle';
    color: string;
    particleCount: number;
    radius: number;
}

const Fireworks = () => {
    const [fireworks, setFireworks] = useState<Firework[]>([]);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef(null);
    const styleId = useId();
    const nextId = useRef(0);

    useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.innerHTML = keyframes + particleStyle;
        document.head.appendChild(styleElement);

        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            setDimensions({ width: clientWidth, height: clientHeight });
        }

        return () => {
            const styleTag = document.getElementById(styleId);
            if (styleTag) {
                document.head.removeChild(styleTag);
            }
        };
    }, [styleId]);

    useEffect(() => {
        if (dimensions.width === 0 || dimensions.height === 0) return;

        const launch = () => {
            const { width, height } = dimensions;
            const x = width * 0.2 + Math.random() * (width * 0.6);
            const y = height * 0.2 + Math.random() * (height * 0.6);

            const fireworkTypes = ['peony', 'peony', 'crackle'];
            const type = fireworkTypes[Math.floor(Math.random() * fireworkTypes.length)];

            const newFirework = {
                id: nextId.current++,
                x,
                y,
                type,
                color: `hsl(${Math.random() * 360}, 100%, 75%)`,
                particleCount: type === 'crackle' ? 60 : 40,
                radius: type === 'crackle' ? 60 + Math.random() * 20 : 80 + Math.random() * 30,
            };
            setFireworks(current => [...current, newFirework]);

            setTimeout(() => {
                setFireworks(current => current.filter(f => f.id !== newFirework.id));
            }, 2200);
        };

        const interval = setInterval(launch, 700);

        return () => clearInterval(interval);
    }, [dimensions]);

    return (
        <div ref={containerRef} className="absolute inset-0">
            {fireworks.map(fw => (
                <div key={fw.id} className="absolute" style={{ left: fw.x, top: fw.y }}>
                    <SingleExplosion {...fw} />
                </div>
            ))}
        </div>
    );
};

export default Fireworks;
