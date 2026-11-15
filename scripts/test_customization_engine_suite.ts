import {
  getCustomizationGroups,
  saveCustomizationGroups,
  getCustomizationsForMeal,
  setMealGroups,
  getMealGroupLinks
} from '../src/lib/customizations-service';
import { calculateServerAuthoritativeOrder } from '../src/lib/pricing';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ Assertion Failed: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ Passed: ${msg}`);
}

async function runEngineTest() {
  console.log('🧪 Starting Reusable Customization Engine Verification Suite...\n');

  // 1. Verify default groups load properly
  const groups = getCustomizationGroups();
  assert(groups.length >= 4, `Loaded at least 4 customization groups (got ${groups.length})`);

  const swallowGroup = groups.find((g) => g.id === 'grp_swallow_selection');
  assert(!!swallowGroup, 'Swallow Selection group exists');
  assert(swallowGroup!.selectionType === 'quantity', 'Swallow is configured as quantity stepper');
  assert(swallowGroup!.includedQuantity === 1, 'Swallow has 1 included wrap');
  assert(swallowGroup!.isRequired === true, 'Swallow is required for soups');

  const proteinGroup = groups.find((g) => g.id === 'grp_protein_selection');
  assert(!!proteinGroup, 'Protein Selection group exists');
  assert(proteinGroup!.options.length >= 6, 'Contains multiple protein options');

  const drinksGroup = groups.find((g) => g.id === 'grp_drinks_beverages');
  assert(!!drinksGroup, 'Drinks & Beverages group exists');
  const bottledWater = drinksGroup!.options.find((o) => o.name === 'Bottled Water');
  assert(!!bottledWater && bottledWater.additionalPrice === 250, 'Bottled Water configured at ₦250');

  // 2. Verify Meal-to-Group Attachment Rules
  // Egusi Soup (id 1) should have Swallow + Protein + Drinks
  const egusiGroups = getCustomizationsForMeal(1);
  assert(egusiGroups.some((g) => g.id === 'grp_swallow_selection'), 'Egusi Soup includes Swallow group');
  assert(egusiGroups.some((g) => g.id === 'grp_protein_selection'), 'Egusi Soup includes Protein group');
  assert(egusiGroups.some((g) => g.id === 'grp_drinks_beverages'), 'Egusi Soup includes Drinks group');

  // Jollof Rice (id 6) must NOT include Swallow group
  const jollofGroups = getCustomizationsForMeal(6);
  assert(!jollofGroups.some((g) => g.id === 'grp_swallow_selection'), 'Jollof Rice correctly does NOT include Swallow group');
  assert(jollofGroups.some((g) => g.id === 'grp_portion_size'), 'Jollof Rice includes Portion Size group');

  // 3. Test dynamic option availability toggling
  // Disable Fufu temporarily
  const originalFufu = swallowGroup!.options.find((o) => o.name === 'Fufu')!;
  originalFufu.isAvailable = false;
  saveCustomizationGroups(groups);

  // Re-read and check
  const updatedGroups = getCustomizationGroups();
  const fufuCheck = updatedGroups.find((g) => g.id === 'grp_swallow_selection')?.options.find((o) => o.name === 'Fufu');
  assert(fufuCheck?.isAvailable === false, 'Option availability can be toggled to unavailable');

  // Attempting to price an unavailable option should throw an error
  let unavailableCaught = false;
  try {
    await calculateServerAuthoritativeOrder([
      {
        menuId: 1,
        qty: 1,
        swallows: [{ name: 'Fufu', quantity: 1 }]
      }
    ]);
  } catch (err: any) {
    unavailableCaught = err.message.includes('unavailable');
  }
  assert(unavailableCaught, 'Pricing engine strictly rejects unavailable options');

  // Restore Fufu availability
  originalFufu.isAvailable = true;
  saveCustomizationGroups(groups);

  // 4. Test adding a dynamic new option and pricing it immediately
  const customExtraOption = {
    id: 'opt_fried_snail',
    groupId: 'grp_protein_selection',
    name: 'Spiced Crunchy Snail',
    additionalPrice: 1500,
    isAvailable: true,
    minQuantity: 0,
    maxQuantity: 5,
    displayOrder: 99
  };
  proteinGroup!.options.push(customExtraOption);
  saveCustomizationGroups(groups);

  // Price order with this newly added dynamic owner option
  const pricingWithNewOption = await calculateServerAuthoritativeOrder([
    {
      menuId: 1, // Egusi Soup ₦4,500
      qty: 1,
      swallows: [{ name: 'Eba', quantity: 1 }], // 1 included (₦0)
      proteins: [{ name: 'Spiced Crunchy Snail', quantity: 2 }] // 2 * ₦1,500 = ₦3,000
    }
  ]);
  assert(
    pricingWithNewOption.subtotal === 7500,
    `Dynamic owner option priced correctly: ₦4,500 + ₦3,000 = ₦7,500 (got ${pricingWithNewOption.subtotal})`
  );

  // Clean up test option
  proteinGroup!.options = proteinGroup!.options.filter((o) => o.id !== 'opt_fried_snail');
  saveCustomizationGroups(groups);

  console.log('\n🎉 ALL REUSABLE CUSTOMIZATION ENGINE TESTS PASSED!');
}

runEngineTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
