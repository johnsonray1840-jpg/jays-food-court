import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Jay's Food Court - Ultra-Premium Cuisine & Fast Delivery",
  description: "Authentic Nigerian soups, rice specialties, yam & egg delivered hot and fresh in Agbani, Enugu.",
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFB800',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-white text-brand-ink antialiased">
        {children}
      </body>
    </html>
  );
}
