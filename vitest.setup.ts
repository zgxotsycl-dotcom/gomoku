import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Return defaultValue or second positional arg if provided; otherwise key
    t: (key: string, defaultOrOptions?: any) => {
      if (typeof defaultOrOptions === 'string') return defaultOrOptions;
      if (defaultOrOptions && typeof defaultOrOptions === 'object' && typeof defaultOrOptions.defaultValue === 'string') {
        return defaultOrOptions.defaultValue;
      }
      return key;
    },
  }),
  Trans: ({ children }: { children: any }) => children,
}));

// Suppress styled-jsx attribute warning in tests
const origError = console.error;
console.error = (...args: any[]) => {
  const msg = args?.[0];
  if (typeof msg === 'string' && msg.includes('Received `true` for a non-boolean attribute `jsx`')) return;
  origError(...args);
};
