import { getMenuItems } from '@/lib/menu';
import { HeaderNavbar } from '@/components/layout/HeaderNavbar';
import { Footer } from '@/components/layout/Footer';
import { ClientShell } from '@/components/layout/ClientShell';
import { HeroEditorial } from '@/components/home/HeroEditorial';
import { HomeCuratedSections } from '@/components/home/HomeCuratedSections';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Jay's Food Court | Premium Nigerian Cuisine & Concierge Delivery in Agbani, Enugu",
  description: "Order authentic firewood jollof, royal egusi, bitterleaf, oha soup, swallows, and chilled refreshments delivered swiftly to your doorstep in Agbani, Enugu.",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const menuItems = await getMenuItems();
  const featured = menuItems.find((m) => m.id === 1) || menuItems[0];

  return (
    <ClientShell menuItems={menuItems}>
      <HeaderNavbar />
      <main className="min-h-screen bg-white">
        <HeroEditorial featuredDish={featured} />
        <HomeCuratedSections menuItems={menuItems} />
      </main>
      <Footer />
    </ClientShell>
  );
}
