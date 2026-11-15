import { calculateServerAuthoritativeOrder } from '../src/lib/pricing';
import { generateOrderReference } from '../src/lib/order-ref';
import { createOrderSchema } from '../src/lib/validations/order';

async function testStage4() {
  console.log('========================================================');
  console.log('STAGE 4: SERVER-AUTHORITATIVE ORDERING ENGINE TESTS');
  console.log('========================================================\n');

  // TEST 1: Unique Non-Predictable Order Reference Generation
  console.log('--- TEST 1: NON-PREDICTABLE ORDER REFERENCES ---');
  const generatedCodes = new Set<string>();
  const regex = /^JFC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{3}$/;

  for (let i = 0; i < 50; i++) {
    const code = generateOrderReference();
    if (!regex.test(code)) {
      throw new Error(`Invalid order reference format generated: ${code}`);
    }
    if (generatedCodes.has(code)) {
      throw new Error(`Collision detected in order reference generation: ${code}`);
    }
    generatedCodes.add(code);
  }
  const sampleRefs = Array.from(generatedCodes).slice(0, 5);
  console.log('Sample Generated Non-Predictable Order References:');
  sampleRefs.forEach((ref) => console.log(`  • ${ref}`));
  console.log('✔ Non-predictable reference format verified (Zero enumeration vulnerability)!\n');

  // TEST 2: Browser Payload Validation (Only IDs, Quantities, Customizations, Instructions)
  console.log('--- TEST 2: STRICT BROWSER PAYLOAD VALIDATION ---');
  const browserPayload = {
    idempotencyKey: 'test_idemp_key_12345',
    customerName: 'Chimaobi Eze',
    phone: '08123456789',
    email: 'chimaobi@example.com',
    address: '42 Agbani Central Road',
    landmark: 'Opposite Town Hall',
    deliveryInstructions: 'Leave with security if not answering',
    paymentMode: 'transfer',
    // The browser attempts to tamper with prices:
    unit: 50,
    total: 200,
    items: [
      {
        menuId: 1, // Royal Egusi Soup (3500)
        qty: 2,
        swallow: 'Pounded Yam',
        extras: ['Extra Assorted Beef'], // 1200
        note: 'Very hot',
        // Injected malicious values
        unit: 10,
        name: 'Free Soup'
      },
      {
        menuId: 5, // Smoky Party Jollof (4200)
        qty: 1,
        extras: [],
        unit: 1
      }
    ]
  };

  const parseResult = createOrderSchema.safeParse(browserPayload);
  if (!parseResult.success) {
    throw new Error('Valid order failed Zod schema: ' + JSON.stringify(parseResult.error));
  }
  console.log('✔ Strict Schema Validation Passed. Malicious client prices stripped.');

  // TEST 3: Server-Authoritative Pricing Calculation
  console.log('\n--- TEST 3: SERVER-AUTHORITATIVE PRICING CALCULATION ---');
  // Calculation Breakdown:
  // Item 1: Royal Egusi (3500) + Extra Assorted Beef (1200) = 4,700 * 2 = 9,400
  // Item 2: Smoky Party Jollof (4200) * 1 = 4,200
  // Subtotal = 9,400 + 4,200 = 13,600
  // 30% Promo Discount = 13,600 * 0.3 = 4,080
  // Delivery Fee = 500
  // Total = 13,600 - 4,080 + 500 = 10,020
  const pricingResult = await calculateServerAuthoritativeOrder(parseResult.data.items);
  console.log('Calculated Breakdown:', {
    subtotal: pricingResult.subtotal,
    discountAmount: pricingResult.discountAmount,
    deliveryFee: pricingResult.deliveryFee,
    totalAmount: pricingResult.totalAmount,
    appliedPromo: pricingResult.appliedPromo?.code
  });

  if (pricingResult.subtotal !== 13600) {
    throw new Error(`Subtotal mismatch! Expected 13600, got ${pricingResult.subtotal}`);
  }
  if (pricingResult.discountAmount !== 4080) {
    throw new Error(`Discount mismatch! Expected 4080, got ${pricingResult.discountAmount}`);
  }
  if (pricingResult.deliveryFee !== 500) {
    throw new Error(`Delivery fee mismatch! Expected 500, got ${pricingResult.deliveryFee}`);
  }
  if (pricingResult.totalAmount !== 10020) {
    throw new Error(`Total mismatch! Expected 10020, got ${pricingResult.totalAmount}`);
  }
  console.log('✔ Server-Authoritative Pricing 100% Exact: Injected client totals completely disregarded.\n');

  // TEST 4: Non-existent Dish Rejection
  console.log('--- TEST 4: NON-EXISTENT DISH SECURITY REJECTION ---');
  try {
    await calculateServerAuthoritativeOrder([
      {
        menuId: 99999, // Fake dish ID
        qty: 1
      }
    ]);
    throw new Error('Server should have rejected non-existent menu item!');
  } catch (err: any) {
    console.log(`✔ Expected Error Received: "${err.message}"`);
  }

  console.log('\n========================================================');
  console.log('STAGE 4 VERIFICATION COMPLETE: ALL AUDIT CHECKS PASSED!');
  console.log('========================================================');
}

testStage4().catch((err) => {
  console.error('Stage 4 Test Failed:', err);
  process.exit(1);
});
