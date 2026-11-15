import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Courier Fleet Portal | Jay's Food Court",
  description: "Discreet delivery courier coordination interface.",
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

export default function RiderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
