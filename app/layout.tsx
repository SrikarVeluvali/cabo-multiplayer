import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './design.css';
import './retro.css';

const pixel = localFont({
  src: '../public/fonts/pixelify-sans.ttf',
  weight: '400 700',
  display: 'swap',
  variable: '--club-font',
});
const arcade = localFont({
  src: '../public/fonts/press-start-2p.ttf',
  weight: '400',
  display: 'swap',
  variable: '--arcade-font',
});
export const metadata: Metadata = {
  title: 'Cabo',
  description:
    'A private multiplayer Cabo table by Srikar Veluvali. Remember your cards, use their powers, and know when to call Cabo.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${pixel.variable} ${arcade.variable}`}>{children}</body>
    </html>
  );
}
