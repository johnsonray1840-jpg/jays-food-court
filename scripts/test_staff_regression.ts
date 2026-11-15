import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { requireStaffAuthorization, signStaffSessionToken, verifyStaffSessionToken } from '../src/lib/auth';
import { checkRateLimit, resetRateLimit } from '../src/lib/rate-limiter';

async function runComprehensiveStaffAccessRegression() {
  console.log('================================================================');
  console.log("  JAY'S FOOD COURT — STAFF ACCESS & SECURITY REGRESSION SUITE  ");
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Unauthenticated visitors rejected from protected APIs
  const reqUnauth = new NextRequest('http://localhost:3000/api/orders');
  const resUnauth = await requireStaffAuthorization(reqUnauth, ['kitchen_staff', 'manager', 'owner']);
  assert(resUnauth.staff === null && resUnauth.errorResponse !== null, 'Unauthenticated visitor rejected with HTTP 401');

  // 2. Kitchen staff access rights
  const kitchenUser = {
    id: 's0000000-0000-0000-0000-000000000003',
    email: 'kitchen@jaysfoodcourt.com',
    fullName: 'Head Chef Chioma',
    role: 'kitchen_staff' as const
  };
  const kitchenToken = signStaffSessionToken(kitchenUser);
  const reqKitchen = new NextRequest('http://localhost:3000/api/orders', {
    headers: { Authorization: `Bearer ${kitchenToken}` }
  });
  const resKitchenOrders = await requireStaffAuthorization(reqKitchen, ['kitchen_staff', 'manager', 'owner']);
  assert(resKitchenOrders.staff?.role === 'kitchen_staff', 'Authorized kitchen staff granted access to kitchen orders');

  // 3. Kitchen staff cannot access Owner/Admin mutations (Role Isolation)
  const resKitchenOwnerDenial = await requireStaffAuthorization(reqKitchen, ['owner', 'admin', 'manager']);
  assert(resKitchenOwnerDenial.staff === null && resKitchenOwnerDenial.errorResponse !== null, 'Kitchen staff strictly denied (HTTP 403) from Owner/Admin actions');

  // 4. Owner access rights
  const ownerUser = {
    id: 's0000000-0000-0000-0000-000000000001',
    email: 'owner@jaysfoodcourt.com',
    fullName: "Jay (Owner)",
    role: 'owner' as const
  };
  const ownerToken = signStaffSessionToken(ownerUser);
  const reqOwner = new NextRequest('http://localhost:3000/api/menu/create', {
    headers: { Authorization: `Bearer ${ownerToken}` }
  });
  const resOwnerAdmin = await requireStaffAuthorization(reqOwner, ['owner', 'admin', 'manager']);
  assert(resOwnerAdmin.staff?.role === 'owner', 'Authorized Owner granted administrative control');

  // 5. Rider access rights
  const riderUser = {
    id: 'r0000000-0000-0000-0000-000000000001',
    email: 'rider@jaysfoodcourt.com',
    fullName: 'Courier Obinna',
    role: 'rider' as const
  };
  const riderToken = signStaffSessionToken(riderUser);
  const reqRider = new NextRequest('http://localhost:3000/api/dispatch/offers', {
    headers: { Authorization: `Bearer ${riderToken}` }
  });
  const resRider = await requireStaffAuthorization(reqRider, ['rider', 'admin', 'manager', 'owner']);
  assert(resRider.staff?.role === 'rider', 'Authorized Rider granted access to dispatch offers');

  // 6. Rider forbidden from Owner/Admin APIs
  const resRiderAdminDenial = await requireStaffAuthorization(reqRider, ['owner', 'admin', 'manager']);
  assert(resRiderAdminDenial.staff === null && resRiderAdminDenial.errorResponse !== null, 'Rider strictly denied (HTTP 403) from Owner actions');

  // 7. Rate Limiter Brute-Force Protection
  const testIp = 'test-audit-ip-123';
  resetRateLimit(`staff_login:${testIp}`);
  for (let i = 0; i < 5; i++) {
    checkRateLimit(`staff_login:${testIp}`, 5, 60000);
  }
  const blockedAttempt = checkRateLimit(`staff_login:${testIp}`, 5, 60000);
  assert(!blockedAttempt.success && blockedAttempt.remaining === 0, 'Brute-force rate limiter blocks 6th consecutive attempt');
  resetRateLimit(`staff_login:${testIp}`);

  // 8. Search Engine & Discovery Protection: robots.txt
  const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
  const robotsContent = fs.readFileSync(robotsPath, 'utf8');
  assert(
    robotsContent.includes('Disallow: /staff') &&
    robotsContent.includes('Disallow: /kitchen') &&
    robotsContent.includes('Disallow: /owner') &&
    robotsContent.includes('Disallow: /rider'),
    'robots.txt explicitly disallows /staff, /kitchen, /owner, /rider'
  );

  // 9. Search Engine & Discovery Protection: sitemap.xml
  const sitemapPath = path.join(process.cwd(), 'public', 'sitemap.xml');
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  const hasStaffInSitemap = (
    sitemapContent.includes('/staff') ||
    sitemapContent.includes('/kitchen') ||
    sitemapContent.includes('/owner') ||
    sitemapContent.includes('/rider')
  );
  assert(!hasStaffInSitemap, 'sitemap.xml has ZERO references to staff routes');

  console.log(`\nRegression Suite Complete: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runComprehensiveStaffAccessRegression();
