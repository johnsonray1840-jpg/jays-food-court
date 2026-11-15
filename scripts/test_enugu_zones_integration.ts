import {
  getActiveEnuguDeliveryZones,
  resolveZoneFromAddress,
  getEnuguZoneById,
  setRiderAssignedZones,
  getRiderAssignedZones,
  isRiderEligibleForZone,
  writeZoneOverrides,
  readZoneOverrides
} from '../src/lib/enugu-zones-service';
import { calculateServerAuthoritativeOrder } from '../src/lib/pricing';

async function testEnuguZonesIntegration() {
  console.log('================================================================');
  console.log('JAY\'S FOOD COURT — ENUGU DELIVERY ZONES INTEGRATION SUITE');
  console.log('================================================================\n');

  // 1. Configurable Service Zones
  console.log('TEST 1: Configurable Enugu Service Zones Verification');
  const zones = getActiveEnuguDeliveryZones();
  console.log(`Retrieved ${zones.length} active delivery zones across Enugu.`);
  if (zones.length < 10) throw new Error('Expected at least 10 canonical Enugu zones');
  zones.slice(0, 5).forEach(z => {
    console.log(`  - ${z.name} (${z.city}) | Fee: ₦${z.deliveryFee} | Min: ₦${z.minOrderAmount} | ETA: ${z.estimatedTime}`);
  });
  console.log('✔ Passed: Configurable zones verified.');

  // 2. Order-to-Zone Association
  console.log('\nTEST 2: Address Order-to-Zone Resolution');
  const sampleAddresses = [
    { addr: '12 Agbani Market Road, Agbani', expectedZone: 'zone_agbani_core' },
    { addr: 'Hostel Block B, ESUT Agbani Campus', expectedZone: 'zone_esut_campus' },
    { addr: 'Lion Building, Independence Layout, Enugu', expectedZone: 'zone_enugu_independence_layout' },
    { addr: '10 Rangers Avenue, GRA, Enugu', expectedZone: 'zone_enugu_gra' },
    { addr: 'Plot 4 Chime Avenue, New Haven, Enugu', expectedZone: 'zone_enugu_new_haven' },
    { addr: 'Caritas University Main Gate, Emene, Enugu', expectedZone: 'zone_enugu_emene' }
  ];

  for (const sample of sampleAddresses) {
    const matched = resolveZoneFromAddress(sample.addr);
    console.log(`  Address: "${sample.addr}" ➔ Zone: "${matched.name}" (ID: ${matched.id})`);
    if (matched.id !== sample.expectedZone) {
      throw new Error(`Expected zone ${sample.expectedZone}, got ${matched.id}`);
    }
  }
  console.log('✔ Passed: Address-to-zone association accurately maps locations.');

  // 3. Dynamic Fee Updates Without Code Changes
  console.log('\nTEST 3: Dynamic Admin Zone Fee Updates');
  const originalZone = getEnuguZoneById('zone_agbani_core');
  const originalFee = originalZone.deliveryFee;

  try {
    const overrides = readZoneOverrides();
    overrides['zone_agbani_core'] = { deliveryFee: 750 };
    writeZoneOverrides(overrides);

    const updatedZone = getEnuguZoneById('zone_agbani_core');
    console.log(`Zone delivery fee updated dynamically from ₦${originalFee} to ₦${updatedZone.deliveryFee}`);
    if (updatedZone.deliveryFee !== 750) {
      throw new Error('Dynamic zone delivery fee update failed');
    }

    // Verify pricing engine uses the updated fee
    const pricing = await calculateServerAuthoritativeOrder(
      [{ menuItemId: 1, quantity: 1, swallow: 'Pounded Yam' }],
      undefined,
      'zone_agbani_core'
    );
    console.log(`Pricing engine computed delivery fee: ₦${pricing.deliveryFee} (Total: ₦${pricing.totalAmount})`);
    if (pricing.deliveryFee !== 750) {
      throw new Error(`Pricing engine expected fee 750, got ${pricing.deliveryFee}`);
    }
    console.log('✔ Passed: Admin can update delivery fees dynamically without code changes.');
  } finally {
    // Restore original
    const overrides = readZoneOverrides();
    delete overrides['zone_agbani_core'];
    writeZoneOverrides(overrides);
  }

  // 4. Rider Zone Assignment & Eligibility
  console.log('\nTEST 4: Rider Zone Assignment & Dispatch Eligibility Guard');
  const testRiderId = 'test-rider-zone-uuid-1234';

  // Initially: Unrestricted courier (eligible for all zones)
  setRiderAssignedZones(testRiderId, []);
  let eligibleAgbani = isRiderEligibleForZone(testRiderId, 'zone_agbani_core');
  let eligibleGRA = isRiderEligibleForZone(testRiderId, 'zone_enugu_gra');
  console.log(`  Unrestricted courier eligibility: Agbani=${eligibleAgbani}, GRA=${eligibleGRA}`);
  if (!eligibleAgbani || !eligibleGRA) throw new Error('Unrestricted courier should be eligible for all zones');

  // Restrict to ESUT Campus and Agbani only
  setRiderAssignedZones(testRiderId, ['zone_agbani_core', 'zone_esut_campus'], 'Manager Emeka');
  eligibleAgbani = isRiderEligibleForZone(testRiderId, 'zone_agbani_core');
  eligibleGRA = isRiderEligibleForZone(testRiderId, 'zone_enugu_gra');
  console.log(`  Restricted courier eligibility: Agbani=${eligibleAgbani}, GRA=${eligibleGRA}`);
  if (!eligibleAgbani || eligibleGRA) {
    throw new Error('Restricted courier must be permitted for Agbani and blocked for GRA');
  }
  console.log('✔ Passed: Zone eligibility strictly enforces courier dispatch boundaries.');

  console.log('\n================================================================');
  console.log('ALL ENUGU DELIVERY ZONE INTEGRATION TESTS PASSED 100%!');
  console.log('================================================================');
}

testEnuguZonesIntegration().catch(err => {
  console.error('Zone test failed:', err);
  process.exit(1);
});
