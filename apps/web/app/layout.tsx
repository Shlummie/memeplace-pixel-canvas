import './globals.css';

import { type Metadata } from 'next';
import { Inter } from 'next/font/google';

import { WalletProvider } from '../components/providers/WalletProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Memeplace Pixel Canvas',
  description: 'A reference implementation for a token-gated collaborative pixel canvas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
