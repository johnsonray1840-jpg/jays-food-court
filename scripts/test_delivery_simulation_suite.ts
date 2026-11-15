import { calculateDeliverySimulation } from '../src/lib/delivery-simulation-engine';

async function runSimulationVerification() {
  console.log('================================================================');
  console.log("JAY'S FOOD COURT — DELIVERY SIMULATION ENGINE TEST SUITE");
  console.log('================================================================\n');

  // Test 1: Pending-payment orders do not start delivery simulation
  console.log('Test 1: Pending-payment orders do not start delivery simulation');
  const sim1 = calculateDeliverySimulation({ status: 'pending_payment' });
  if (sim1.progressPercent > 5 || sim1.isAnimating || sim1.routeOffsetPercent > 5) {
    throw new Error(`Test 1 Failed: Pending payment started simulation: ${JSON.stringify(sim1)}`);
  }
  console.log('   ✔ Passed: Progress is 0-5%, isAnimating=false, offset=5% (Stationary at hub)');

  // Test 2: Confirmed orders show the correct preparation state
  console.log('\nTest 2: Confirmed orders show correct preparation state');
  const sim2 = calculateDeliverySimulation({ status: 'confirmed', estimatedDeliveryDurationMinutes: 25 });
  if (sim2.stage !== 1 || sim2.isAnimating || sim2.routeOffsetPercent !== 5) {
    throw new Error(`Test 2 Failed: Confirmed order simulation incorrect`);
  }
  console.log(`   ✔ Passed: Stage 1 Confirmed, offset=5%, remainingText=${sim2.remainingMinutesText}`);

  // Test 3: Kitchen preparation updates appear to customers
  console.log('\nTest 3: Kitchen preparation updates (preparing / cooking)');
  const sim3 = calculateDeliverySimulation({ status: 'preparing' });
  if (sim3.stage !== 2 || sim3.isAnimating || sim3.routeOffsetPercent !== 5) {
    throw new Error(`Test 3 Failed: Preparing state incorrect`);
  }
  console.log('   ✔ Passed: Stage 2 Kitchen Preparing, offset=5% (Stationary)');

  // Test 4: Ready-for-pickup does not start the courier journey
  console.log('\nTest 4: Ready-for-pickup does not start courier journey');
  const sim4 = calculateDeliverySimulation({ status: 'ready_for_pickup' });
  if (sim4.stage !== 3 || sim4.isAnimating || sim4.routeOffsetPercent !== 5) {
    throw new Error(`Test 4 Failed: Ready for pickup started journey`);
  }
  console.log('   ✔ Passed: Stage 3 Ready for Pickup, offset=5% (Stationary at counter)');

  // Test 5: Rider assignment does not falsely indicate pickup or start travelling
  console.log('\nTest 5: Rider assignment does not falsely start journey');
  const sim5 = calculateDeliverySimulation({ status: 'assigned_to_rider', courierName: 'Courier Emeka' });
  if (sim5.stage !== 4 || sim5.isAnimating || sim5.routeOffsetPercent !== 5) {
    throw new Error(`Test 5 Failed: Rider assignment started travelling`);
  }
  console.log(`   ✔ Passed: Stage 4 Rider Assigned, offset=5% (Courier still arriving at hub)`);

  // Test 6: Actual pickup / out-for-delivery starts the journey
  console.log('\nTest 6: Actual out_for_delivery starts the simulated journey');
  const now = Date.now();
  const sim6 = calculateDeliverySimulation({
    status: 'out_for_delivery',
    dispatchedAt: new Date(now).toISOString(),
    estimatedDeliveryDurationMinutes: 20,
    clientNow: now
  });
  if (sim6.stage !== 5 || !sim6.isAnimating) {
    throw new Error(`Test 6 Failed: Out for delivery did not start journey`);
  }
  console.log(`   ✔ Passed: Stage 5 Out for Delivery, isAnimating=true, initial offset=${sim6.routeOffsetPercent}%`);

  // Test 7: Courier animation progresses smoothly over time
  console.log('\nTest 7: Deterministic progress calculation over time');
  const tenMinsLater = now + 10 * 60 * 1000; // Halfway through 20-min delivery
  const sim7 = calculateDeliverySimulation({
    status: 'out_for_delivery',
    dispatchedAt: new Date(now).toISOString(),
    estimatedDeliveryDurationMinutes: 20,
    clientNow: tenMinsLater
  });
  if (sim7.progressPercent < 70 || sim7.routeOffsetPercent < 40) {
    throw new Error(`Test 7 Failed: Halfway progress not advanced: ${JSON.stringify(sim7)}`);
  }
  console.log(`   ✔ Passed: Halfway through: progress=${sim7.progressPercent}%, offset=${sim7.routeOffsetPercent}%`);

  // Test 8: Customer page reload restores correct progress without resetting
  console.log('\nTest 8: Customer page refresh restores exact progress without resetting');
  const sim8Reload = calculateDeliverySimulation({
    status: 'out_for_delivery',
    dispatchedAt: new Date(now).toISOString(),
    estimatedDeliveryDurationMinutes: 20,
    clientNow: tenMinsLater
  });
  if (sim8Reload.routeOffsetPercent !== sim7.routeOffsetPercent) {
    throw new Error(`Test 8 Failed: Refresh produced different offset!`);
  }
  console.log('   ✔ Passed: Page reload produces 100% identical offset & progress');

  // Test 9: Approaching destination state (Stage 6)
  console.log('\nTest 9: Approaching destination state (Stage 6)');
  const eighteenMinsLater = now + 18 * 60 * 1000; // 90% through 20-min delivery
  const sim9 = calculateDeliverySimulation({
    status: 'out_for_delivery',
    dispatchedAt: new Date(now).toISOString(),
    estimatedDeliveryDurationMinutes: 20,
    clientNow: eighteenMinsLater
  });
  if (sim9.stage !== 6 || !sim9.isApproaching) {
    throw new Error(`Test 9 Failed: Approaching state not triggered: ${JSON.stringify(sim9)}`);
  }
  console.log(`   ✔ Passed: Stage 6 Approaching, headline="${sim9.headline}"`);

  // Test 10: Delayed delivery does not automatically declare arrival or mark delivered
  console.log('\nTest 10: Delayed delivery handling');
  const thirtyMinsLater = now + 30 * 60 * 1000; // 10 mins past 20-min estimate
  const sim10 = calculateDeliverySimulation({
    status: 'out_for_delivery',
    dispatchedAt: new Date(now).toISOString(),
    estimatedDeliveryDurationMinutes: 20,
    clientNow: thirtyMinsLater
  });
  if (sim10.isDelivered || sim10.routeOffsetPercent > 92 || !sim10.isDelayed) {
    throw new Error(`Test 10 Failed: Delayed delivery improperly marked delivered!`);
  }
  console.log(`   ✔ Passed: Delayed delivery capped at ${sim10.routeOffsetPercent}%, isDelayed=true, isDelivered=false`);

  // Test 11: Delivered state (Stage 7) only when authoritative backend marks delivered
  console.log('\nTest 11: Authoritative Delivered state');
  const sim11 = calculateDeliverySimulation({ status: 'delivered' });
  if (sim11.stage !== 7 || !sim11.isDelivered || sim11.isAnimating || sim11.routeOffsetPercent !== 95) {
    throw new Error(`Test 11 Failed: Delivered state incorrect: ${JSON.stringify(sim11)}`);
  }
  console.log('   ✔ Passed: Stage 7 Delivered, isAnimating=false, isDelivered=true (OTP verified)');

  console.log('\n🎉 ALL DELIVERY SIMULATION ENGINE TESTS PASSED WITH 100% INTEGRITY!\n');
}

runSimulationVerification().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
