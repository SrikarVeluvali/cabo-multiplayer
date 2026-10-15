import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const club = localFont({
  src: [
    { path: '../public/fonts/dm-sans-400.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/dm-sans-500.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/dm-sans-600.woff2', weight: '600', style: 'normal' },
    { path: '../public/fonts/dm-sans-700.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--club-font',
});
export const metadata: Metadata = {
  title: 'Cabo — Cards, memory & a little nerve',
  description:
    'A private multiplayer Cabo table by Srikar Veluvali. Remember your cards, use their powers, and know when to call Cabo.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={club.variable}>{children}</body>
    </html>
  );
}
