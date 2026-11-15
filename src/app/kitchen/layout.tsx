import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Kitchen Desk | Jay's Food Court",
  description: "Internal kitchen dispatch and operations console.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
};

export default function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
