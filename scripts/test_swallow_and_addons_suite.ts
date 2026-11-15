import { calculateServerAuthoritativeOrder } from '../src/lib/pricing';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${msg}`);
}

async function runTests() {
  console.log('🧪 Starting Swallow and Addon Verification Suite...\n');

  // 1. Egusi Soup with 1 wrap Pounded Yam (Default allowance, no extra charge)
  // Base price: ₦4,500. Expected subtotal: ₦4,500.
  const r1 = await calculateServerAuthoritativeOrder([
    {
      menuId: 1, // Egusi Soup
      qty: 1,
      swallows: [{ name: 'Pounded Yam', quantity: 1 }],
      proteins: [],
      addons: []
    }
  ]);
  assert(r1.subtotal === 4500, `Egusi Soup with 1 included wrap is ₦4,500 (got ${r1.subtotal})`);
  assert(r1.items[0].customizations?.swallows?.[0]?.name === 'Pounded Yam', 'Includes 1 wrap Pounded Yam');

  // 2. Egusi Soup with 3 wraps of Eba
  // 1st wrap included. 2 extra wraps @ ₦300 = ₦600.
  // Base ₦4,500 + ₦600 = ₦5,100.
  const r2 = await calculateServerAuthoritativeOrder([
    {
      menuId: 1, // Egusi Soup
      qty: 1,
      swallows: [{ name: 'Eba', quantity: 3 }],
      proteins: [],
      addons: []
    }
  ]);
  assert(r2.subtotal === 5100, `Egusi Soup with 3 wraps Eba (1 free + 2 extra @ ₦300) = ₦5,100 (got ${r2.subtotal})`);

  // 3. User request example:
  // Egusi Soup with:
  // - Swallow: 3 wraps Eba (1 included + 2 extra @ ₦300 = ₦600)
  // - Proteins: Beef 2 pieces (@ ₦500 = ₦1,000), Stockfish 1 piece (@ ₦700 = ₦700)
  // - Addon: Bottled Water 2 bottles (@ ₦250 = ₦500)
  // Calculation: 4500 (Base + 1 Eba) + 600 (2 extra Eba) + 1000 (2 Beef) + 700 (1 Stockfish) + 500 (2 Water) = ₦7,300.
  const r3 = await calculateServerAuthoritativeOrder([
    {
      menuId: 1,
      qty: 1,
      swallows: [{ name: 'Eba', quantity: 3 }],
      proteins: [
        { name: 'Beef', quantity: 2 },
        { name: 'Stockfish', quantity: 1 }
      ],
      addons: [
        { name: 'Bottled Water', quantity: 2 }
      ]
    }
  ]);
  assert(r3.subtotal === 7300, `Egusi Soup combo with 3 Eba + 2 Beef + 1 Stockfish + 2 Water = ₦7,300 (got ${r3.subtotal})`);

  // 4. Bottled Water with Non-Soup Item (e.g. Jollof Rice, id 6 @ ₦3,000)
  // 1 Jollof Rice + 1 Bottled Water (@ ₦250) = ₦3,250.
  const r4 = await calculateServerAuthoritativeOrder([
    {
      menuId: 6, // Jollof Rice
      qty: 1,
      addons: [{ name: 'Bottled Water', quantity: 1 }]
    }
  ]);
  assert(r4.subtotal === 3250, `Jollof Rice + 1 Bottled Water = ₦3,250 (got ${r4.subtotal})`);

  // 5. Category restriction: Non-soup dish attempting to select swallow must throw or reject
  let swallowRejected = false;
  try {
    await calculateServerAuthoritativeOrder([
      {
        menuId: 6, // Jollof Rice does NOT allow swallow
        qty: 1,
        swallows: [{ name: 'Eba', quantity: 1 }]
      }
    ]);
  } catch (err: any) {
    swallowRejected = err.message.includes('does not accept swallow');
  }
  assert(swallowRejected, 'Jollof Rice correctly rejects swallow selection');

  // 6. Multiple wraps of different swallow types (e.g. 1 Pounded Yam + 1 Semovita)
  // Total 2 wraps. 1 free wrap applied to Pounded Yam (₦500), 1 Semovita @ ₦400 charged.
  // Base ₦4,500 + ₦400 = ₦4,900.
  const r6 = await calculateServerAuthoritativeOrder([
    {
      menuId: 1,
      qty: 1,
      swallows: [
        { name: 'Pounded Yam', quantity: 1 },
        { name: 'Semovita', quantity: 1 }
      ]
    }
  ]);
  assert(r6.subtotal === 4900, `Egusi with 1 Pounded Yam (free) + 1 Semovita (₦400) = ₦4,900 (got ${r6.subtotal})`);

  console.log('\n🎉 ALL PORTION & ADDON TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
