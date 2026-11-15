import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Staff Access Terminal | Jay's Food Court",
  description: "Internal operations portal for authorized personnel.",
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

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
