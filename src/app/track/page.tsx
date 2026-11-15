import { Suspense } from 'react';
import { HeaderNavbar } from '@/components/layout/HeaderNavbar';
import { Footer } from '@/components/layout/Footer';
import { ClientShell } from '@/components/layout/ClientShell';
import { TrackPageClient } from '@/components/tracking/TrackPageClient';
import { BrandedLoader } from '@/components/ui/BrandedLoader';
import { getMenuItems } from '@/lib/menu';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Live Order Tracking | Jay's Food Court",
  description: "Track your active meal preparation, dispatch courier progress, and OTP delivery verification.",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TrackPage() {
  const menuItems = await getMenuItems();

  return (
    <ClientShell menuItems={menuItems}>
      <HeaderNavbar />
      <Suspense fallback={<BrandedLoader size="fullscreen" message="Accessing delivery mission intelligence..." />}>
        <TrackPageClient />
      </Suspense>
      <Footer />
    </ClientShell>
  );
}
