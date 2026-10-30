import type { Metadata, Viewport } from 'next';
import './globals.css';
import './clean-ui.css';
import './profitability.css';
export const metadata: Metadata = {
  title: 'Underchargers | Fund Management',
  description: 'Underchargers and Mastermind Cashier, Revolving Fund and Parts Fund Management',
  applicationName: 'UC Fund Management',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'UC Funds' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' }
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
