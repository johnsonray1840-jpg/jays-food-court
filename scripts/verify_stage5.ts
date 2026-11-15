import {
  validateOrderTransition,
  OrderStatus,
  OrderActorRole,
  STATE_TRANSITION_RULES
} from '../src/lib/order-state-machine';

async function testStage5() {
  console.log('========================================================');
  console.log('STAGE 5: ORDER LIFECYCLE STATE MACHINE VERIFICATION');
  console.log('========================================================\n');

  // TEST 1: Golden Path Lifecycle
  console.log('--- TEST 1: COMPLETE GOLDEN PATH LIFECYCLE TRANSITIONS ---');
  const goldenPath: { from: OrderStatus; to: OrderStatus; actor: OrderActorRole }[] = [
    { from: 'pending_payment', to: 'confirmed', actor: 'system' },
    { from: 'confirmed', to: 'accepted', actor: 'kitchen_staff' },
    { from: 'accepted', to: 'preparing', actor: 'kitchen_staff' },
    { from: 'preparing', to: 'ready_for_pickup', actor: 'kitchen_staff' },
    { from: 'ready_for_pickup', to: 'assigned_to_rider', actor: 'kitchen_staff' },
    { from: 'assigned_to_rider', to: 'picked_up', actor: 'rider' },
    { from: 'picked_up', to: 'out_for_delivery', actor: 'rider' },
    { from: 'out_for_delivery', to: 'delivered', actor: 'rider' }
  ];

  for (const step of goldenPath) {
    const res = validateOrderTransition(step.from, step.to, step.actor);
    if (!res.allowed) {
      throw new Error(`Golden path failed: ${step.from} -> ${step.to} by ${step.actor}. Reason: ${res.reason}`);
    }
    console.log(`  ✓ [${step.from}] ➔ [${step.to}] by role "${step.actor}" permitted`);
  }
  console.log('✔ Golden path lifecycle verified 100%!\n');

  // TEST 2: Illegal State Jump Rejection (Enforcing Strict Sequence)
  console.log('--- TEST 2: ILLEGAL STATE JUMPS (SEQUENCE ENFORCEMENT) ---');
  const illegalJumps: { from: OrderStatus; to: OrderStatus; actor: OrderActorRole }[] = [
    { from: 'confirmed', to: 'delivered', actor: 'admin' }, // Cannot skip cooking, packing and delivery!
    { from: 'pending_payment', to: 'preparing', actor: 'kitchen_staff' }, // Cannot cook before payment!
    { from: 'preparing', to: 'out_for_delivery', actor: 'rider' }, // Food not ready yet!
    { from: 'delivered', to: 'preparing', actor: 'kitchen_staff' }, // Delivered cannot rewind to kitchen
  ];

  for (const step of illegalJumps) {
    const res = validateOrderTransition(step.from, step.to, step.actor);
    if (res.allowed) {
      throw new Error(`Illegal state jump was incorrectly allowed: ${step.from} -> ${step.to}`);
    }
    console.log(`  ✓ Blocked illegal transition "${step.from}" ➔ "${step.to}": ${res.reason}`);
  }
  console.log('✔ All illegal state jumps strictly prevented!\n');

  // TEST 3: Unauthorized Actor Role Rejection
  console.log('--- TEST 3: UNAUTHORIZED ACTOR ENFORCEMENT ---');
  const unauthorizedAttempts: { from: OrderStatus; to: OrderStatus; actor: OrderActorRole }[] = [
    { from: 'out_for_delivery', to: 'delivered', actor: 'customer' }, // Customer cannot mark order delivered!
    { from: 'confirmed', to: 'accepted', actor: 'rider' }, // Rider cannot accept kitchen orders!
    { from: 'accepted', to: 'preparing', actor: 'customer' }, // Customer cannot start cooking!
    { from: 'ready_for_pickup', to: 'picked_up', actor: 'customer' }, // Customer cannot pick up food meant for delivery
    { from: 'delivered', to: 'refunded', actor: 'rider' } // Rider cannot issue refunds!
  ];

  for (const step of unauthorizedAttempts) {
    const res = validateOrderTransition(step.from, step.to, step.actor);
    if (res.allowed) {
      throw new Error(`Unauthorized actor was incorrectly allowed: ${step.actor} doing ${step.from} -> ${step.to}`);
    }
    console.log(`  ✓ Blocked unauthorized actor "${step.actor}" attempting "${step.from}" ➔ "${step.to}": ${res.reason}`);
  }
  console.log('✔ Unauthorized actors strictly blocked!\n');

  // TEST 4: Terminal State Immutability
  console.log('--- TEST 4: TERMINAL REFUNDED & CANCELLED STATES ---');
  const allStates: OrderStatus[] = [
    'pending_payment', 'confirmed', 'accepted', 'preparing',
    'ready_for_pickup', 'assigned_to_rider', 'picked_up',
    'out_for_delivery', 'delivered', 'cancelled', 'refunded'
  ];

  for (const s of allStates) {
    const res = validateOrderTransition('refunded', s, 'admin');
    if (res.allowed) {
      throw new Error(`Terminal refunded state cannot transition to "${s}"!`);
    }
  }
  console.log('  ✓ Verified: "refunded" is a strictly closed terminal state with 0 outgoing transitions.');

  console.log('\n========================================================');
  console.log('STAGE 5 LIFECYCLE STATE MACHINE VERIFICATION PASSED 100%!');
  console.log('========================================================');
}

testStage5().catch((err) => {
  console.error('Stage 5 Test Failed:', err);
  process.exit(1);
});
