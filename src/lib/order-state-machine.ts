/**
 * JAY'S FOOD COURT (JFC) - STAGE 5: VALIDATED ORDER STATE MACHINE
 * 
 * Defines the complete formal order lifecycle:
 * pending_payment -> confirmed -> accepted -> preparing -> ready_for_pickup ->
 * assigned_to_rider -> picked_up -> out_for_delivery -> delivered
 * Plus terminal exception states: cancelled, refunded.
 */

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'assigned_to_rider'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type OrderActorRole =
  | 'owner'
  | 'customer'
  | 'kitchen_staff'
  | 'rider'
  | 'manager'
  | 'admin'
  | 'system';

export interface TransitionRule {
  allowedTo: OrderStatus[];
  authorizedActors: {
    [targetState in OrderStatus]?: OrderActorRole[];
  };
}

/**
 * FORMAL TRANSITION PERMISSION MATRIX
 * Strictly defines which target states are valid from each source state,
 * and which actor roles are authorized to execute them.
 */
export const STATE_TRANSITION_RULES: Record<OrderStatus, TransitionRule> = {
  pending_payment: {
    allowedTo: ['confirmed', 'cancelled'],
    authorizedActors: {
      confirmed: ['system', 'admin', 'owner', 'manager'],
      cancelled: ['customer', 'system', 'admin', 'owner', 'manager']
    }
  },
  confirmed: {
    allowedTo: ['accepted', 'cancelled'],
    authorizedActors: {
      accepted: ['kitchen_staff', 'manager', 'owner', 'admin'],
      cancelled: ['customer', 'manager', 'owner', 'admin']
    }
  },
  accepted: {
    allowedTo: ['preparing', 'cancelled'],
    authorizedActors: {
      preparing: ['kitchen_staff', 'manager', 'owner', 'admin'],
      cancelled: ['manager', 'owner', 'admin']
    }
  },
  preparing: {
    allowedTo: ['ready_for_pickup', 'cancelled'],
    authorizedActors: {
      ready_for_pickup: ['kitchen_staff', 'manager', 'owner', 'admin'],
      cancelled: ['manager', 'owner', 'admin']
    }
  },
  ready_for_pickup: {
    allowedTo: ['assigned_to_rider', 'picked_up', 'cancelled'],
    authorizedActors: {
      assigned_to_rider: ['rider', 'kitchen_staff', 'manager', 'owner', 'admin', 'system'],
      picked_up: ['rider', 'manager', 'owner', 'admin'],
      cancelled: ['manager', 'owner', 'admin']
    }
  },
  assigned_to_rider: {
    allowedTo: ['picked_up', 'ready_for_pickup', 'cancelled'],
    authorizedActors: {
      picked_up: ['rider', 'manager', 'owner', 'admin'],
      ready_for_pickup: ['manager', 'owner', 'admin'],
      cancelled: ['manager', 'owner', 'admin']
    }
  },
  picked_up: {
    allowedTo: ['out_for_delivery', 'cancelled'],
    authorizedActors: {
      out_for_delivery: ['rider', 'manager', 'owner', 'admin'],
      cancelled: ['manager', 'owner', 'admin']
    }
  },
  out_for_delivery: {
    allowedTo: ['delivered', 'cancelled'],
    authorizedActors: {
      delivered: ['rider', 'manager', 'owner', 'admin'],
      cancelled: ['manager', 'owner', 'admin']
    }
  },
  delivered: {
    allowedTo: ['refunded'],
    authorizedActors: {
      refunded: ['manager', 'owner', 'admin']
    }
  },
  cancelled: {
    allowedTo: ['refunded'],
    authorizedActors: {
      refunded: ['manager', 'owner', 'admin', 'system']
    }
  },
  refunded: {
    allowedTo: [],
    authorizedActors: {}
  }
};

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates whether a state transition is legal according to state machine rules and actor permissions.
 */
export function validateOrderTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  actorRole: OrderActorRole
): TransitionValidationResult {
  if (fromStatus === toStatus) {
    return {
      allowed: false,
      reason: `Order is already in state "${fromStatus}".`
    };
  }

  const rule = STATE_TRANSITION_RULES[fromStatus];
  if (!rule) {
    return {
      allowed: false,
      reason: `Unknown starting state "${fromStatus}".`
    };
  }

  // 1. Check if target state is permitted from current state
  if (!rule.allowedTo.includes(toStatus)) {
    return {
      allowed: false,
      reason: `Illegal state transition: Cannot move order directly from "${fromStatus}" to "${toStatus}". Permitted next states: [${rule.allowedTo.join(', ')}].`
    };
  }

  // 2. Check if actor is authorized to perform this specific transition
  const authorizedActors = rule.authorizedActors[toStatus] || [];
  if (!authorizedActors.includes(actorRole)) {
    return {
      allowed: false,
      reason: `Permission denied: Actor role "${actorRole}" is not authorized to transition order from "${fromStatus}" to "${toStatus}". Authorized roles: [${authorizedActors.join(', ')}].`
    };
  }

  return { allowed: true };
}

/**
 * Calculates dynamic kitchen preparation and delivery ETA based on active order load.
 * Adds intelligent queue buffering (+2 to 3 mins per concurrent active cooking order)
 * to deliver honest, accurate delivery estimates without fabricating times.
 */
export function calculateDynamicKitchenEstimate(activeKitchenOrdersCount: number = 0): {
  prepMins: number;
  etaString: string;
} {
  const queueLoad = Math.max(0, activeKitchenOrdersCount);
  const basePrep = 15;
  const queueBuffer = Math.min(25, queueLoad * 3); // Max 25 mins extra buffer
  const minPrep = basePrep + queueBuffer;
  const maxPrep = minPrep + 10;

  return {
    prepMins: minPrep,
    etaString: `${minPrep} - ${maxPrep} Mins`
  };
}

/**
 * Returns human-readable delivery ETA for a given order lifecycle status,
 * optionally weighted by active kitchen queue concurrency.
 */
export function getEstimatedDeliveryTimeForStatus(
  status: OrderStatus,
  activeQueueCount: number = 0
): string {
  const dynamicBuffer = Math.min(15, Math.max(0, activeQueueCount) * 2);

  switch (status) {
    case 'pending_payment':
      return 'Awaiting Payment';
    case 'confirmed':
      return `${20 + dynamicBuffer} - ${30 + dynamicBuffer} Mins`;
    case 'accepted':
      return `${18 + dynamicBuffer} - ${25 + dynamicBuffer} Mins`;
    case 'preparing':
      return `${15 + Math.floor(dynamicBuffer / 2)} - ${20 + Math.floor(dynamicBuffer / 2)} Mins`;
    case 'ready_for_pickup':
      return '10 - 15 Mins';
    case 'assigned_to_rider':
      return '8 - 12 Mins';
    case 'picked_up':
    case 'out_for_delivery':
      return '3 - 8 Mins';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    case 'refunded':
      return 'Refunded';
    default:
      return '18 - 25 Mins';
  }
}
