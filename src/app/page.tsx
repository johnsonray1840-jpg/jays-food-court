import { getMenuItems } from '@/lib/menu';
import { StorefrontClient } from '@/components/home/StorefrontClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server Component (fetches live menu data on every request)
export default async function HomePage() {
  const menuItems = await getMenuItems();

  return <StorefrontClient initialMenu={menuItems} />;
}
