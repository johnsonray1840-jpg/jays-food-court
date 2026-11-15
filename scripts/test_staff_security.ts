import { NextRequest } from 'next/server';
import { requireStaffAuthorization, signStaffSessionToken, verifyStaffSessionToken } from '../src/lib/auth';

async function runStaffAccessHardeningTests() {
  console.log('====================================================');
  console.log("  JAY'S FOOD COURT — STAFF ACCESS & SECURITY AUDIT  ");
  console.log('====================================================\n');

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

  // TEST 1: Unauthenticated request to staff authorization
  const reqUnauth = new NextRequest('http://localhost:3000/api/orders');
  const resUnauth = await requireStaffAuthorization(reqUnauth, ['kitchen_staff', 'manager', 'owner']);
  assert(resUnauth.staff === null && resUnauth.errorResponse !== null, 'Unauthenticated request correctly rejected with 401');

  // TEST 2: Valid kitchen staff token
  const kitchenUser = {
    id: 's0000000-0000-0000-0000-000000000003',
    email: 'kitchen@jaysfoodcourt.com',
    fullName: 'Head Chef Chioma',
    role: 'kitchen_staff' as const
  };
  const kitchenToken = signStaffSessionToken(kitchenUser);
  const verifiedKitchen = verifyStaffSessionToken(kitchenToken);
  assert(verifiedKitchen?.email === 'kitchen@jaysfoodcourt.com' && verifiedKitchen?.role === 'kitchen_staff', 'Cryptographic HMAC-SHA256 kitchen token verified');

  // TEST 3: Kitchen staff permitted on kitchen-allowed endpoint
  const reqKitchenAllowed = new NextRequest('http://localhost:3000/api/orders', {
    headers: { Authorization: `Bearer ${kitchenToken}` }
  });
  const resKitchenAllowed = await requireStaffAuthorization(reqKitchenAllowed, ['kitchen_staff', 'manager', 'owner']);
  assert(resKitchenAllowed.staff?.role === 'kitchen_staff' && resKitchenAllowed.errorResponse === null, 'Kitchen staff authorized for kitchen order stream');

  // TEST 4: Kitchen staff strictly FORBIDDEN from owner pricing / fleet endpoints
  const resKitchenForbidden = await requireStaffAuthorization(reqKitchenAllowed, ['owner', 'admin', 'manager']);
  assert(resKitchenForbidden.staff === null && resKitchenForbidden.errorResponse !== null, 'Kitchen staff strictly forbidden (403) from owner administrative actions');

  // TEST 5: Rider permitted on dispatch offers
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
  assert(resRider.staff?.role === 'rider' && resRider.errorResponse === null, 'Rider authorized for courier dispatch');

  // TEST 6: Rider strictly forbidden from owner endpoints
  const resRiderForbidden = await requireStaffAuthorization(reqRider, ['owner', 'admin', 'manager']);
  assert(resRiderForbidden.staff === null && resRiderForbidden.errorResponse !== null, 'Rider strictly forbidden (403) from owner administrative actions');

  // TEST 7: Expired or tampered tokens rejected
  const tamperedToken = kitchenToken.slice(0, -4) + 'abcd';
  const verifiedTampered = verifyStaffSessionToken(tamperedToken);
  assert(verifiedTampered === null, 'Tampered token signature verification fails');

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runStaffAccessHardeningTests();
