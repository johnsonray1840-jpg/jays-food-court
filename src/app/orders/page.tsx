import { Suspense } from 'react';
import { HeaderNavbar } from '@/components/layout/HeaderNavbar';
import { Footer } from '@/components/layout/Footer';
import { ClientShell } from '@/components/layout/ClientShell';
import { TrackPageClient } from '@/components/tracking/TrackPageClient';
import { BrandedLoader } from '@/components/ui/BrandedLoader';
import { getMenuItems } from '@/lib/menu';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Customer Order Tracking & History | Jay's Food Court",
  description: "Look up your active Jay's Food Court order reference, monitor kitchen preparation, and follow verified courier delivery in real time.",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrdersPage() {
  const menuItems = await getMenuItems();

  return (
    <ClientShell menuItems={menuItems}>
      <HeaderNavbar />
      <Suspense fallback={<BrandedLoader size="fullscreen" message="Retrieving order history..." />}>
        <TrackPageClient />
      </Suspense>
      <Footer />
    </ClientShell>
  );
}
