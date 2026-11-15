import { getMenuItems } from '@/lib/menu';
import { HeaderNavbar } from '@/components/layout/HeaderNavbar';
import { Footer } from '@/components/layout/Footer';
import { ClientShell } from '@/components/layout/ClientShell';
import { MenuPageClient } from '@/components/menu/MenuPageClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Complete Menu & Pricing | Jay's Food Court Agbani",
  description: "Browse authentic firewood jollof, royal egusi, bitterleaf, oha soup, swallows, shawarma, and chilled refreshments available for delivery.",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MenuPage() {
  const menuItems = await getMenuItems();

  return (
    <ClientShell menuItems={menuItems}>
      <HeaderNavbar />
      <MenuPageClient initialMenu={menuItems} />
      <Footer />
    </ClientShell>
  );
}
