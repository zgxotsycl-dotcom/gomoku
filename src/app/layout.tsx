import './globals.css';
import type { Metadata } from 'next';
import ClientInit from './ClientInit';

export const metadata: Metadata = {
  title: 'Gomoku App',
  description: 'Gomoku with 3D roll animations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientInit />
        {children}
      </body>
    </html>
  );
}

