import { calculateServerAuthoritativeOrder } from '../src/lib/pricing';

async function runCustomizationSuite() {
  console.log('========================================================================');
  console.log("  JAY'S FOOD COURT — ADVANCED MEAL CUSTOMIZATION & PROTEIN PORTIONS TEST ");
  console.log('========================================================================\n');

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

  try {
    // TEST 1: Flexible Protein Selection on Egusi Soup (Dish ID 1)
    // Example: 2 pieces of Beef (₦500 each = ₦1,000) + 1 piece of Stockfish (₦700 each = ₦700)
    // Base Egusi Soup: ₦4,500
    // Total Expected Unit Price: ₦4,500 + ₦1,000 + ₦700 = ₦6,200
    // Quantity: 1 meal -> Subtotal: ₦6,200
    const res1 = await calculateServerAuthoritativeOrder([
      {
        menuId: 1,
        qty: 1,
        swallow: 'Pounded Yam',
        proteins: [
          { name: 'Beef', quantity: 2 },
          { name: 'Stockfish', quantity: 1 }
        ]
      }
    ]);

    assert(res1.items.length === 1, 'Item resolved correctly');
    const item1 = res1.items[0];
    assert(item1.basePrice === 4500, `Base price is ₦4,500 (received: ₦${item1.basePrice})`);
    assert(item1.unitPrice === 6200, `Unit price is ₦6,200 (received: ₦${item1.unitPrice})`);
    assert(item1.lineTotal === 6200, `Line total is ₦6,200 (received: ₦${item1.lineTotal})`);
    assert(item1.customizations.proteins?.length === 2, '2 protein records captured in snapshot');

    const beefRecord = item1.customizations.proteins?.find((p) => p.name === 'Beef');
    assert(beefRecord?.quantity === 2 && beefRecord?.subtotal === 1000, 'Beef: 2 pcs @ ₦500 = ₦1,000');

    const stockfishRecord = item1.customizations.proteins?.find((p) => p.name === 'Stockfish');
    assert(stockfishRecord?.quantity === 1 && stockfishRecord?.subtotal === 700, 'Stockfish: 1 pc @ ₦700 = ₦700');

    // TEST 2: Multi-meal quantity calculation
    // 2 x (Egusi Soup with 1 Goat Meat @ ₦900 + 2 Beef @ ₦500)
    // Unit price = ₦4,500 + ₦900 + ₦1,000 = ₦6,400
    // Line total = 2 * ₦6,400 = ₦12,800
    const res2 = await calculateServerAuthoritativeOrder([
      {
        menuId: 1,
        qty: 2,
        swallow: 'Semovita',
        proteins: [
          { name: 'Goat Meat', quantity: 1 },
          { name: 'Beef', quantity: 2 }
        ]
      }
    ]);

    const item2 = res2.items[0];
    assert(item2.unitPrice === 6400, `Unit price with Goat Meat & Beef is ₦6,400 (received: ₦${item2.unitPrice})`);
    assert(item2.lineTotal === 12800, `Line total for 2 meals is ₦12,800 (received: ₦${item2.lineTotal})`);

    // TEST 3: Backward compatibility with legacy string extras
    const res3 = await calculateServerAuthoritativeOrder([
      {
        menuId: 1,
        qty: 1,
        swallow: 'Yellow Garri (Eba)',
        extras: ['Beef', 'Chicken'] // ₦500 + ₦800 = ₦1,300
      }
    ]);
    const item3 = res3.items[0];
    assert(item3.unitPrice === 4500 + 500 + 800, `Legacy extras format works seamlessly: ₦${item3.unitPrice}`);

    // TEST 4: Zero quantity or invalid proteins handled gracefully
    const res4 = await calculateServerAuthoritativeOrder([
      {
        menuId: 1,
        qty: 1,
        swallow: 'Pounded Yam',
        proteins: [
          { name: 'Beef', quantity: 0 },
          { name: 'Chicken', quantity: 1 }
        ]
      }
    ]);
    const item4 = res4.items[0];
    assert(item4.unitPrice === 4500 + 800, `0 quantity beef omitted, Chicken (₦800) included: ₦${item4.unitPrice}`);

  } catch (err: any) {
    console.error('Unexpected error in suite:', err);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runCustomizationSuite();
