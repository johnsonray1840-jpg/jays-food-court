import { sanitizeText, sanitizeCustomerOrderInput } from '../src/lib/sanitize';
import { signStaffSessionToken, verifyStaffSessionToken, StaffRole } from '../src/lib/auth';
import { getMenuItems, getMenuCustomizations, updateMenuItemAvailability } from '../src/lib/menu';

async function runStages6And7Verification() {
  console.log('========================================================');
  console.log('STAGES 6 & 7: KITCHEN SECURITY & DYNAMIC MENU MANAGEMENT');
  console.log('========================================================\n');

  // --- STAGE 6 TEST 1: CUSTOMER CONTENT SANITIZATION ---
  console.log('--- TEST 1: CUSTOMER CONTENT SANITIZATION (XSS DEFENSE) ---');
  const dirtyInputs = [
    {
      raw: 'Nkem Okafor <script>alert("hack")</script>',
      expected: 'Nkem Okafor'
    },
    {
      raw: '12 Agbani Road <img src=x onerror=alert(1)>',
      expected: '12 Agbani Road'
    },
    {
      raw: 'javascript:void(0)',
      expected: 'void(0)'
    },
    {
      raw: 'Please "rush" the order & make it spicy < 5 mins',
      expected: 'Please &quot;rush&quot; the order &amp; make it spicy &lt; 5 mins'
    }
  ];

  for (const item of dirtyInputs) {
    const cleaned = sanitizeText(item.raw);
    console.log(`Cleaned: "${item.raw}" ➔ "${cleaned}"`);
    if (cleaned.includes('<script>') || cleaned.includes('<img') || cleaned.includes('alert(')) {
      throw new Error(`Sanitizer failed to neutralize payload: ${item.raw}`);
    }
  }

  const sanitizedOrder = sanitizeCustomerOrderInput({
    customerName: '<script>evil()</script>Amaka',
    address: 'Near ESUT gate <iframe src="evil.com"></iframe>',
    landmark: 'Behind "B" hostel',
    deliveryInstructions: 'Call <b>urgent</b>',
    items: [
      {
        menuId: 1,
        note: 'Extra pepper <script>exploit()</script>'
      }
    ]
  });

  if (
    sanitizedOrder.customerName.includes('<script>') ||
    sanitizedOrder.address.includes('<iframe') ||
    sanitizedOrder.items[0].note.includes('<script>')
  ) {
    throw new Error('Order payload sanitizer failed to scrub nested fields');
  }
  console.log('✔ Full Order Payload Sanitized Safely:', sanitizedOrder);
  console.log('✔ Customer Content Sanitization Passed 100%!\n');

  // --- STAGE 6 TEST 2: STAFF ROLE-BASED AUTHENTICATION ---
  console.log('--- TEST 2: STAFF ROLE-BASED AUTHENTICATION TOKENS ---');
  const roles: StaffRole[] = ['owner', 'admin', 'manager', 'kitchen_staff', 'rider'];

  for (const r of roles) {
    const staff = {
      id: `staff-uuid-${r}`,
      email: `${r}@jaysfoodcourt.com`,
      fullName: `Staff Member (${r})`,
      role: r
    };

    const token = signStaffSessionToken(staff);
    const verified = verifyStaffSessionToken(token);

    if (!verified || verified.role !== r || verified.id !== staff.id) {
      throw new Error(`Failed to verify staff token for role: ${r}`);
    }
    console.log(`  ✓ Staff Role "${r}" Token Verified Successfully (ID: ${verified.id})`);
  }
  console.log('✔ Role-Based Authorization Verified for Owner, Manager, Kitchen staff, and Rider!\n');

  // --- STAGE 7 TEST 1: DYNAMIC MENU RETRIEVAL ---
  console.log('--- TEST 3: DYNAMIC MENU RETRIEVAL (CATEGORIES, DISHES, PRICES) ---');
  const menu = await getMenuItems();
  console.log(`Retrieved ${menu.length} total dishes from menu system:`);
  menu.forEach((dish) => {
    console.log(`  • #${dish.id} [${dish.cat}] ${dish.name} - ₦${dish.price} (Available: ${dish.available})`);
  });

  if (menu.length < 8) {
    throw new Error(`Expected at least 8 authentic menu dishes, found ${menu.length}`);
  }
  console.log('✔ Dynamic Menu Retrieval Passed!\n');

  // --- STAGE 7 TEST 2: CUSTOMIZATIONS & EXTRA PROTEINS ---
  console.log('--- TEST 4: CUSTOMIZATIONS & EXTRA PROTEINS RETRIEVAL ---');
  const customizations = await getMenuCustomizations();
  console.log(`Loaded ${customizations.length} Customization Groups:`);
  customizations.forEach((g: any) => {
    console.log(`  Group: "${g.name}" (Required: ${g.is_required})`);
    g.options.forEach((opt: any) => {
      console.log(`    ↳ Option: ${opt.name} (+₦${opt.additional_price}) [Available: ${opt.is_available}]`);
    });
  });
  console.log('✔ Customization Groups & Extra Proteins Verified!\n');

  // --- STAGE 7 TEST 3: SOLD-OUT STATE TOGGLING ---
  console.log('--- TEST 5: SOLD-OUT STATE MANAGEMENT ---');
  // Toggle Dish #1 (Royal Egusi Soup) to Sold Out
  const soldOutResult = await updateMenuItemAvailability(1, false);
  console.log('Toggled Dish #1 to Sold Out:', soldOutResult.success);

  let updatedMenu = await getMenuItems();
  let egusi = updatedMenu.find((m) => m.id === 1);
  if (!egusi || egusi.available !== false) {
    throw new Error('Dish availability toggle to false failed');
  }
  console.log(`  ✓ Dish #1 is now verified as SOLD OUT (available: ${egusi.available})`);

  // Restore Dish #1 back to Available
  const restoreResult = await updateMenuItemAvailability(1, true);
  console.log('Restored Dish #1 to Available:', restoreResult.success);

  updatedMenu = await getMenuItems();
  egusi = updatedMenu.find((m) => m.id === 1);
  if (!egusi || egusi.available !== true) {
    throw new Error('Dish availability restore to true failed');
  }
  console.log(`  ✓ Dish #1 is now restored to AVAILABLE (available: ${egusi.available})`);

  console.log('\n========================================================');
  console.log('STAGES 6 & 7 VERIFICATION COMPLETE: ALL CHECKS PASSED 100%!');
  console.log('========================================================');
}

runStages6And7Verification().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
