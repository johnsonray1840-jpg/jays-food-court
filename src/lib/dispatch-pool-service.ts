export interface OfferRecord {
  orderId: string;
  orderCode: string;
  enteredPoolAt: number;
  expiresAt: number;
  rejectedByRiderIds: Set<string>;
}

// Global in-memory offer registry with 5-minute auto-expiry window per offer
const globalOffers = new Map<string, OfferRecord>();
const OFFER_LIFESPAN_MS = 5 * 60 * 1000; // 5 minutes

export function getOfferRecord(orderId: string, orderCode: string): OfferRecord {
  let record = globalOffers.get(orderId);
  const now = Date.now();
  if (!record || now > record.expiresAt) {
    record = {
      orderId,
      orderCode,
      enteredPoolAt: now,
      expiresAt: now + OFFER_LIFESPAN_MS,
      rejectedByRiderIds: record ? record.rejectedByRiderIds : new Set<string>()
    };
    globalOffers.set(orderId, record);
  }
  return record;
}

export function recordOfferRejection(orderId: string, riderId: string) {
  const record = globalOffers.get(orderId);
  if (record) {
    record.rejectedByRiderIds.add(riderId);
  }
}

export function getOfferStats() {
  const now = Date.now();
  let activeOfferCount = 0;
  let expiredOfferCount = 0;
  let rejectedOfferCount = 0;

  for (const [, record] of globalOffers.entries()) {
    if (now > record.expiresAt) {
      expiredOfferCount++;
    } else {
      activeOfferCount++;
    }
    if (record.rejectedByRiderIds && record.rejectedByRiderIds.size > 0) {
      rejectedOfferCount += record.rejectedByRiderIds.size;
    }
  }

  return {
    activeOfferCount,
    expiredOfferCount,
    rejectedOfferCount,
    totalTracked: globalOffers.size
  };
}
