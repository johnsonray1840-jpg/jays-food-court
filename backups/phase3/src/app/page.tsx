import { getMenuItems } from '@/lib/menu';
import { StorefrontClient } from '@/components/home/StorefrontClient';

// Server Component (fetches menu data on the server)
export default async function HomePage() {
  const menuItems = await getMenuItems();

  return <StorefrontClient initialMenu={menuItems} />;
}
