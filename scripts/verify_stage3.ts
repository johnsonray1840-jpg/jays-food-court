import { createOrderSchema } from '../src/lib/validations/order';
import { calculateAuthoritativeTotals } from '../src/lib/menu';
import { normalizeNigerianPhone, isValidNigerianPhone } from '../src/lib/phone';
import { signSessionToken, verifySessionToken } from '../src/lib/session';

async function runTests() {
  console.log('--- TEST 1: NIGERIAN PHONE NORMALIZATION ---');
  const testPhones = [
    { in: '08012345678', expected: '+2348012345678' },
    { in: '+234 801 234 5678', expected: '+2348012345678' },
    { in: '0708-742-6626', expected: '+2347087426626' },
    { in: '09012345678', expected: '+2349012345678' },
    { in: '012345678', expected: null },
    { in: '123456', expected: null }
  ];

  for (const t of testPhones) {
    const norm = normalizeNigerianPhone(t.in);
    const valid = isValidNigerianPhone(t.in);
    console.log(`Phone "${t.in}" -> normalized: ${norm}, valid: ${valid}`);
    if (norm !== t.expected) {
      throw new Error(`Normalization failed for ${t.in}: got ${norm}, expected ${t.expected}`);
    }
  }
  console.log('✔ Phone Normalization Passed!\n');

  console.log('--- TEST 2: CRYPTOGRAPHIC SESSION TOKENS ---');
  const customerSession = {
    customerId: 'cust-uuid-1234',
    phone: '+2348012345678',
    createdAt: Date.now()
  };
  const token = signSessionToken(customerSession);
  console.log('Signed HMAC-SHA256 Token:', token);

  const decoded = verifySessionToken(token);
  if (!decoded || decoded.customerId !== customerSession.customerId || decoded.phone !== customerSession.phone) {
    throw new Error('Session token verification failed');
  }
  console.log('✔ Token Verified Successfully:', decoded);

  // Tamper test
  const tampered = token.slice(0, -3) + 'abc';
  const tamperedResult = verifySessionToken(tampered);
  if (tamperedResult !== null) {
    throw new Error('Tampered token should have been rejected!');
  }
  console.log('✔ Tampered Token Correctly Rejected!\n');

  console.log('--- TEST 3: SERVER-AUTHORITATIVE PRICING ENGINE ---');
  // 1 Royal Egusi Soup (base: 3,500) + Extra Assorted Beef (1,200) = 4,700
  // 1 Smoky Party Jollof (base: 4,200) = 4,200
  // Subtotal = 8,900
  // Discount (30%) = 2,670
  // Delivery Fee = 500
  // Total = 8,900 - 2,670 + 500 = 6,730
  const totals = await calculateAuthoritativeTotals([
    {
      menuId: 1,
      name: 'Tampered Dish Name',
      qty: 1,
      swallow: 'Pounded Yam',
      extras: ['Extra Assorted Beef'],
      note: 'Extra spicy'
    },
    {
      menuId: 5,
      name: 'Smoky Party Jollof Rice',
      qty: 1,
      swallow: null,
      extras: []
    }
  ]);

  console.log('Calculated Authoritative Totals:', {
    subtotal: totals.subtotal,
    discount: totals.discount,
    deliveryFee: totals.deliveryFee,
    total: totals.total
  });

  if (totals.subtotal !== 8900 || totals.discount !== 2670 || totals.total !== 6730) {
    throw new Error(`Pricing mismatch! Expected subtotal 8900, got ${totals.subtotal}; expected total 6730, got ${totals.total}`);
  }
  console.log('✔ Pricing Engine Strictly Verified (Untrusted client prices rejected)!\n');

  console.log('--- TEST 4: ZOD ORDER SCHEMA VALIDATION ---');
  const validOrderPayload = {
    customerName: 'Nkem Okafor',
    phone: '08012345678',
    email: 'nkem@example.com',
    address: '12 Agbani Expressway',
    landmark: 'Near ESUT Main Gate',
    deliveryInstructions: 'Call me upon arrival',
    paymentMode: 'transfer',
    items: [
      {
        menuId: 1,
        name: 'Royal Egusi Soup',
        qty: 1,
        swallow: 'Pounded Yam',
        extras: ['Extra Assorted Beef']
      }
    ]
  };

  const parsed = createOrderSchema.safeParse(validOrderPayload);
  if (!parsed.success) {
    throw new Error('Valid order failed validation: ' + JSON.stringify(parsed.error));
  }
  console.log('✔ Valid Order Schema Validation Passed!');

  // Invalid payload test (empty address, invalid phone)
  const invalidPayload = {
    ...validOrderPayload,
    phone: '012345',
    address: 'abc'
  };
  const invalidParsed = createOrderSchema.safeParse(invalidPayload);
  if (invalidParsed.success) {
    throw new Error('Invalid order should have failed validation!');
  }
  console.log('✔ Invalid Order Schema Successfully Blocked with Errors:', invalidParsed.error.issues.map(i => i.message));

  console.log('\n========================================');
  console.log('ALL PHASE 2 & STAGE 3 TESTS PASSED 100%!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
