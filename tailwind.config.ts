import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        'chroma-shine': {
          '0%, 100%': { boxShadow: '0 0 10px #ff00ff, 0 0 20px #ff00ff' },
          '25%': { boxShadow: '0 0 10px #00ffff, 0 0 20px #00ffff' },
          '50%': { boxShadow: '0 0 10px #ffff00, 0 0 20px #ffff00' },
          '75%': { boxShadow: '0 0 10px #00ff00, 0 0 20px #00ff00' },
        },
        'pulse-throb': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
        },
        'slime-in': {
          '0%': { opacity: '0', transform: 'scale(0.3) skew(15deg, 15deg)' },
          '40%': { opacity: '1', transform: 'scale(1.05) skew(-10deg, -10deg)' },
          '60%': { transform: 'scale(0.95) skew(5deg, 5deg)' },
          '80%': { transform: 'scale(1.02) skew(-2deg, -2deg)' },
          '100%': { opacity: '1', transform: 'scale(1) skew(0, 0)' },
        },
        'scale-in': {
          from: { transform: 'scale(0)' },
          to: { transform: 'scale(1)' },
        },
        'emoticon-animation': {
          '0%': { opacity: '0', transform: 'translateY(0) scale(0.5)' },
          '20%': { opacity: '1', transform: 'translateY(-20px) scale(1.2)' },
          '80%': { opacity: '1', transform: 'translateY(-20px) scale(1.2) rotate(15deg)' },
          '100%': { opacity: '0', transform: 'translateY(20px) scale(0.5)' },
        },
        'firework-explode': {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
      animation: {
        'chroma-shine': 'chroma-shine 2s linear infinite',
        'pulse-throb': 'pulse-throb 1.5s ease-in-out infinite',
        'slime-in': 'slime-in 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        'scale-in': 'scale-in 1s ease-out forwards',
        'emoticon-animation': 'emoticon-animation 3s ease-in-out forwards',
        'firework-explode': 'firework-explode 1.2s ease-out forwards',
      },
    },
  },
  plugins: [],
}
export default config