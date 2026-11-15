import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number; // in kobo (e.g. 400000 = ₦4000.00)
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string; // card, bank_transfer, ussd, etc.
    currency: 'NGN';
    ip_address: string;
    metadata?: {
      orderId?: string;
      orderCode?: string;
      customerId?: string;
      custom_fields?: Array<{ display_name: string; variable_name: string; value: string }>;
    };
    customer: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
      phone: string | null;
      customer_code: string;
    };
  };
}

/**
 * Initialize a Paystack transaction.
 * Amount must be supplied in Naira and is converted to kobo (amount * 100).
 */
export async function initializePaystackTransaction(params: {
  email: string;
  amountInNaira: number;
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}): Promise<PaystackInitializeResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured in environment variables.');
  }

  // Paystack expects amount in Kobo (1 Naira = 100 Kobo)
  const amountInKobo = Math.round(params.amountInNaira * 100);

  const payload: Record<string, any> = {
    email: params.email,
    amount: amountInKobo,
    reference: params.reference,
    channels: ['card', 'bank_transfer', 'ussd', 'qr'],
    metadata: params.metadata || {}
  };

  if (params.callbackUrl) {
    payload.callback_url = params.callbackUrl;
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resData = await response.json();

  if (!response.ok || !resData.status) {
    throw new Error(resData.message || 'Paystack transaction initialization failed.');
  }

  return resData;
}

/**
 * Verify a Paystack transaction directly by reference.
 */
export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured in environment variables.');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    }
  });

  const resData = await response.json();

  if (!response.ok || !resData.status) {
    throw new Error(resData.message || 'Paystack transaction verification failed.');
  }

  return resData;
}

/**
 * Verify Paystack webhook cryptographic signature (HMAC SHA-512).
 */
export function verifyPaystackWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY;
  if (!secretKey || !signatureHeader) return false;

  const expectedSignature = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to defeat timing attacks
  const sigBuffer = Buffer.from(signatureHeader, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

export interface PaystackRefundParams {
  transaction: string | number; // Transaction reference or ID
  amountInNaira?: number;      // Optional partial refund amount in NGN
  merchantNote?: string;       // Reason / note for the refund
}

export interface PaystackRefundResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    transaction: {
      id: number;
      reference: string;
      amount: number;
      currency: string;
    };
    amount: number;
    currency: string;
    status: string; // e.g. 'pending', 'processed', 'failed'
    refunded_by?: string;
    refunded_at?: string;
  };
}

/**
 * Initiate an official refund on Paystack.
 * Server-side only; never trust client parameters.
 */
export async function createPaystackRefund(params: PaystackRefundParams): Promise<PaystackRefundResponse> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured in environment variables.');
  }

  const payload: any = {
    transaction: params.transaction
  };

  if (params.amountInNaira && params.amountInNaira > 0) {
    payload.amount = Math.round(params.amountInNaira * 100);
  }

  if (params.merchantNote) {
    payload.merchant_note = params.merchantNote;
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const resData = await response.json();

  if (!response.ok || !resData.status) {
    throw new Error(resData.message || 'Paystack refund initiation failed.');
  }

  return resData;
}

/**
 * Fetch status of an existing Paystack refund by refund ID or reference.
 */
export async function getPaystackRefund(refundIdOrReference: string | number): Promise<any> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured in environment variables.');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/refund/${encodeURIComponent(refundIdOrReference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json'
    }
  });

  const resData = await response.json();
  if (!response.ok || !resData.status) {
    throw new Error(resData.message || 'Failed to fetch Paystack refund status.');
  }

  return resData;
}
