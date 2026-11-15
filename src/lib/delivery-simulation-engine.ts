import { OrderStatus } from '@/types';

export interface DeliverySimulationConfig {
  status: OrderStatus;
  statusUpdatedAt?: string;       // Authoritative backend timestamp for current status
  dispatchedAt?: string;          // Authoritative timestamp when courier transitioned to picked_up / out_for_delivery
  estimatedDeliveryDurationMinutes?: number; // e.g. 20 - 30 mins (parsed as number, defaults to 25)
  courierName?: string;
  clientNow?: number;             // Optional override for testing
}

export interface SimulationState {
  stage: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  stageLabel: string;
  headline: string;
  subtext: string;
  progressPercent: number;        // 0 to 100
  routeOffsetPercent: number;     // 5 (hub) to 95 (dropoff)
  isAnimating: boolean;
  isDelayed: boolean;
  remainingMinutesText: string;
  isApproaching: boolean;
  isDelivered: boolean;
}

/**
 * Computes deterministic, timestamp-backed simulated delivery progress.
 *
 * Rules:
 * 1. Stages 1-4: strictly stationary at starting point (routeOffsetPercent = 5%).
 * 2. Stage 5 (picked_up / out_for_delivery): Progress advances deterministically based on
 *    (now - dispatchedAt) / (estimatedDuration * 60 * 1000).
 *    If page is reloaded halfway through, progress is reconstructed accurately without resetting.
 * 3. Stage 6 (approaching destination): When progress reaches 85%-92%, visual approaching state is shown.
 *    If delivery exceeds estimated duration, cap progress at 92% and show "delayed / updating estimate",
 *    NEVER automatically advancing to delivered.
 * 4. Stage 7 (delivered): Only triggered when backend status is 'delivered'. Animation stops.
 */
export function calculateDeliverySimulation(config: DeliverySimulationConfig): SimulationState {
  const {
    status,
    statusUpdatedAt,
    dispatchedAt,
    estimatedDeliveryDurationMinutes = 25,
    courierName = 'Jay’s Dispatch Courier',
    clientNow = Date.now()
  } = config;

  // STAGE 7: Delivered (Authoritative Backend State Only)
  if (status === 'delivered') {
    return {
      stage: 7,
      stageLabel: 'Stage 7 — Delivered',
      headline: 'Meal Successfully Delivered 🎉',
      subtext: 'Delivered and verified face-to-face via 6-digit OTP. Enjoy your meal!',
      progressPercent: 100,
      routeOffsetPercent: 95,
      isAnimating: false,
      isDelayed: false,
      remainingMinutesText: 'Completed',
      isApproaching: false,
      isDelivered: true
    };
  }

  // Pending Payment / Initial State (Before confirmed)
  if (status === 'pending_payment' || status === 'cancelled' || status === 'refunded') {
    return {
      stage: 1,
      stageLabel: status === 'pending_payment' ? 'Payment Pending' : 'Order Closed',
      headline: status === 'pending_payment' ? 'Awaiting Payment Confirmation' : 'Order Closed',
      subtext: status === 'pending_payment'
        ? 'Your order will be sent to the kitchen immediately upon payment confirmation.'
        : 'This order is closed.',
      progressPercent: 0,
      routeOffsetPercent: 5,
      isAnimating: false,
      isDelayed: false,
      remainingMinutesText: `${estimatedDeliveryDurationMinutes} mins`,
      isApproaching: false,
      isDelivered: false
    };
  }

  // STAGE 1: Order Confirmed
  if (status === 'confirmed' || status === 'accepted') {
    return {
      stage: 1,
      stageLabel: 'Stage 1 — Order Confirmed',
      headline: 'Order Confirmed by Restaurant',
      subtext: 'Chef has received your ticket and is preparing fresh ingredients.',
      progressPercent: 15,
      routeOffsetPercent: 5,
      isAnimating: false,
      isDelayed: false,
      remainingMinutesText: `${estimatedDeliveryDurationMinutes} mins`,
      isApproaching: false,
      isDelivered: false
    };
  }

  // STAGE 2: Preparing Your Food
  if (status === 'preparing' || status === 'cooking') {
    return {
      stage: 2,
      stageLabel: 'Stage 2 — Preparing Your Food',
      headline: 'Chef Cooking in Kitchen Hub',
      subtext: 'Chef is actively cooking your fresh meal in our Agbani kitchen hub.',
      progressPercent: 35,
      routeOffsetPercent: 5,
      isAnimating: false,
      isDelayed: false,
      remainingMinutesText: `${estimatedDeliveryDurationMinutes} mins`,
      isApproaching: false,
      isDelivered: false
    };
  }

  // STAGE 3: Ready for Pickup
  if (status === 'ready_for_pickup') {
    return {
      stage: 3,
      stageLabel: 'Stage 3 — Ready for Pickup',
      headline: 'Order Packaged & Awaiting Pickup',
      subtext: 'Sealed for fresh delivery and offered to our nearby courier fleet.',
      progressPercent: 50,
      routeOffsetPercent: 5,
      isAnimating: false,
      isDelayed: false,
      remainingMinutesText: `${estimatedDeliveryDurationMinutes} mins`,
      isApproaching: false,
      isDelivered: false
    };
  }

  // STAGE 4: Rider Assigned (Still at Hub)
  if (status === 'assigned_to_rider') {
    return {
      stage: 4,
      stageLabel: 'Stage 4 — Rider Assigned',
      headline: `${courierName} Assigned`,
      subtext: `${courierName} has accepted this delivery and is arriving at the kitchen counter to collect your meal.`,
      progressPercent: 60,
      routeOffsetPercent: 5,
      isAnimating: false,
      isDelayed: false,
      remainingMinutesText: `${estimatedDeliveryDurationMinutes} mins`,
      isApproaching: false,
      isDelivered: false
    };
  }

  // STAGES 5 & 6: Active Delivery Journey (picked_up / out_for_delivery / dispatched)
  // Compute deterministic progress based on authoritative timestamps
  const deliveryStartTime = dispatchedAt
    ? new Date(dispatchedAt).getTime()
    : statusUpdatedAt
    ? new Date(statusUpdatedAt).getTime()
    : clientNow;

  const totalDurationMs = Math.max(5, estimatedDeliveryDurationMinutes) * 60 * 1000;
  const elapsedMs = Math.max(0, clientNow - deliveryStartTime);
  const timeRatio = elapsedMs / totalDurationMs;

  const isDelayed = timeRatio > 1.0;

  // Dynamic route interpolation:
  // Starts at 10% (leaving hub) and smoothly travels toward 90% (destination neighborhood)
  // If delayed, capped at 92% (NEVER automatically declares arrival or delivered)
  let routeOffset = 10 + Math.min(82, timeRatio * 80);
  let progressPct = 65 + Math.min(27, timeRatio * 27);

  const remainingMinutes = Math.max(1, Math.ceil((totalDurationMs - elapsedMs) / 60000));
  const isApproaching = timeRatio >= 0.82;

  // STAGE 6: Approaching Destination (Simulated visual threshold, not physical GPS)
  if (isApproaching) {
    return {
      stage: 6,
      stageLabel: 'Stage 6 — Approaching Destination',
      headline: isDelayed
        ? 'Final Stretch • Courier Approaching'
        : 'Approaching Your Destination',
      subtext: isDelayed
        ? `${courierName} is navigating the final stretch to your address. Please have your 6-digit OTP ready.`
        : `${courierName} is on the final leg toward your compound/estate. Keep your 6-digit OTP ready.`,
      progressPercent: Math.round(progressPct),
      routeOffsetPercent: Math.min(92, Math.round(routeOffset)),
      isAnimating: true,
      isDelayed,
      remainingMinutesText: isDelayed ? 'A few minutes' : `~${remainingMinutes} min${remainingMinutes > 1 ? 's' : ''}`,
      isApproaching: true,
      isDelivered: false
    };
  }

  // STAGE 5: En Route
  return {
    stage: 5,
    stageLabel: 'Stage 5 — Out for Delivery',
    headline: 'Courier En Route to Your Address',
    subtext: `${courierName} is traveling along the delivery route with your packaged meal.`,
    progressPercent: Math.round(progressPct),
    routeOffsetPercent: Math.min(82, Math.round(routeOffset)),
    isAnimating: true,
    isDelayed: false,
    remainingMinutesText: `~${remainingMinutes} min${remainingMinutes > 1 ? 's' : ''}`,
    isApproaching: false,
    isDelivered: false
  };
}
