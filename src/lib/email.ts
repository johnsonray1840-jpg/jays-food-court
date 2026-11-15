import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is missing');
  }
  return new Resend(apiKey);
}

const FROM_EMAIL = process.env.EMAIL_FROM || "Jay's Food Court <no_reply@vertexcapitals.ltd>";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html
    });

    if (error) {
      console.error('[Resend Error]', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('[Resend Exception]', err);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// BASE LUXURY SOOTHING TEMPLATE WRAPPER
// Brand palette: Obsidian #17140D, Gold #FFB800, Cream #FFFBEF
// -------------------------------------------------------------
function wrapLuxuryTemplate({
  headline,
  statusBadge,
  contentHtml,
  actionButton
}: {
  headline: string;
  statusBadge?: string;
  contentHtml: string;
  actionButton?: { text: string; url: string };
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8F6F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #17140D; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #F8F6F0; padding: 40px 0; }
    .container { max-width: 580px; margin: 0 auto; background-color: #FFFFFF; border-radius: 24px; border: 1px solid #F0E9D6; overflow: hidden; box-shadow: 0 10px 30px rgba(23, 20, 13, 0.05); }
    .header { background-color: #17140D; padding: 32px 30px; text-align: center; }
    .brand-title { color: #FFFFFF; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .brand-gold { color: #FFB800; }
    .brand-sub { color: #A8A29E; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 6px; font-weight: 600; }
    .body { padding: 36px 32px; }
    .badge { display: inline-block; background-color: #FFFBEF; border: 1px solid #FFE494; color: #92400E; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 14px; border-radius: 999px; margin-bottom: 16px; }
    .h1 { font-size: 22px; font-weight: 800; color: #17140D; margin: 0 0 14px; line-height: 1.3; }
    .text { font-size: 14px; line-height: 1.6; color: #57534E; margin: 0 0 20px; }
    .box { background-color: #FFFBEF; border-radius: 16px; border: 1px solid #F0E9D6; padding: 20px; margin: 24px 0; }
    .otp-code { font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #17140D; text-align: center; margin: 12px 0; }
    .btn { display: inline-block; background-color: #FFB800; color: #17140D; text-decoration: none; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 16px 36px; border-radius: 999px; box-shadow: 0 4px 14px rgba(255, 184, 0, 0.4); text-align: center; }
    .order-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .order-table td { padding: 10px 0; border-bottom: 1px solid #F5F0E6; font-size: 13px; }
    .order-table .qty { color: #78716C; font-weight: 700; width: 35px; }
    .order-table .name { color: #17140D; font-weight: 700; }
    .order-table .price { text-align: right; color: #92400E; font-weight: 800; }
    .total-row td { border-bottom: none; border-top: 2px solid #17140D; padding-top: 14px; font-size: 15px; font-weight: 900; }
    .safety-box { background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 14px; padding: 16px; margin: 20px 0; }
    .safety-title { color: #991B1B; font-size: 12px; font-weight: 800; text-transform: uppercase; margin: 0 0 6px; }
    .safety-text { color: #7F1D1D; font-size: 12px; margin: 0; line-height: 1.5; }
    .footer { background-color: #F8F6F0; padding: 24px 32px; text-align: center; border-top: 1px solid #F0E9D6; }
    .footer-text { font-size: 11px; color: #A8A29E; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <div class="container">
            <!-- Header -->
            <div class="header">
              <h1 class="brand-title">Jay's <span class="brand-gold">FoodCourt</span></h1>
              <div class="brand-sub">Authentic Cuisine & Fast Delivery &bull; Agbani, Enugu</div>
            </div>

            <!-- Body -->
            <div class="body">
              ${statusBadge ? `<div class="badge">${statusBadge}</div>` : ''}
              <h2 class="h1">${headline}</h2>
              ${contentHtml}

              ${actionButton ? `
              <div style="text-align: center; margin: 30px 0 10px;">
                <a href="${actionButton.url}" target="_blank" class="btn">${actionButton.text}</a>
              </div>
              ` : ''}
            </div>

            <!-- Footer -->
            <div class="footer">
              <p class="footer-text">
                Jay's Food Court &bull; Express Delivery in Agbani, Enugu<br>
                For immediate support, WhatsApp us at <strong style="color: #17140D;">+234 708 742 6626</strong>
              </p>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `;
}

// -------------------------------------------------------------
// 1. ORDER CONFIRMATION & RECEIPT EMAIL (With Secure Handover OTP)
// -------------------------------------------------------------
export async function sendOrderConfirmedEmail({
  to,
  customerName,
  orderCode,
  items,
  totalAmount,
  deliveryAddress,
  deliveryOtp,
  trackingUrl
}: {
  to: string;
  customerName: string;
  orderCode: string;
  items: Array<{ name: string; qty: number; unitPrice: number; extras?: string[] }>;
  totalAmount: number;
  deliveryAddress: string;
  deliveryOtp?: string;
  trackingUrl: string;
}) {
  const itemsHtml = items.map(item => `
    <tr>
      <td class="qty">${item.qty}x</td>
      <td class="name">
        ${item.name}
        ${item.extras && item.extras.length > 0 ? `<div style="font-size: 11px; color: #78716C; font-weight: normal;">+ ${item.extras.join(', ')}</div>` : ''}
      </td>
      <td class="price">₦${(item.unitPrice * item.qty).toLocaleString()}</td>
    </tr>
  `).join('');

  const contentHtml = `
    <p class="text">Hello <strong>${customerName}</strong>, thank you for ordering from Jay's Food Court! Your payment has been confirmed and our kitchen has received your ticket.</p>
    
    ${deliveryOtp ? `
    <div class="box" style="text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #78716C; letter-spacing: 1.5px;">Your Delivery Handover Code</div>
      <div class="otp-code">${deliveryOtp}</div>
      <div style="font-size: 12px; color: #78716C;">Provide this 6-digit code to your rider in person upon arrival.</div>
    </div>

    <div class="safety-box">
      <div class="safety-title">⚠️ Handover Safety Reminder</div>
      <p class="safety-text">
        <strong>Never send this code over phone, WhatsApp or SMS.</strong> Only share it face-to-face once the rider is physically at your doorstep. Jay's Food Court will never ask for this code before delivery.
      </p>
    </div>
    ` : ''}

    <div style="margin: 24px 0 12px;">
      <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #78716C; letter-spacing: 1px;">Order Summary &bull; #${orderCode}</div>
      <table class="order-table">
        ${itemsHtml}
        <tr class="total-row">
          <td colspan="2" style="color: #17140D;">Total Amount Paid</td>
          <td class="price" style="font-size: 16px;">₦${totalAmount.toLocaleString()}</td>
        </tr>
      </table>
    </div>

    <p class="text" style="margin-top: 20px; font-size: 13px;">
      <strong>Delivery Destination:</strong><br>
      ${deliveryAddress}
    </p>
  `;

  return sendEmail({
    to,
    subject: `Order #${orderCode} Confirmed &bull; Jay's Food Court`,
    html: wrapLuxuryTemplate({
      headline: `Order #${orderCode} Confirmed!`,
      statusBadge: 'Kitchen Confirmed',
      contentHtml,
      actionButton: {
        text: 'Track Live Progress',
        url: trackingUrl
      }
    })
  });
}

// -------------------------------------------------------------
// 2. KITCHEN PREPARING & PREP TIME ESTIMATE EMAIL
// -------------------------------------------------------------
export async function sendOrderPreparingEmail({
  to,
  customerName,
  orderCode,
  prepEstimateMinutes,
  trackingUrl
}: {
  to: string;
  customerName: string;
  orderCode: string;
  prepEstimateMinutes: number;
  trackingUrl: string;
}) {
  const contentHtml = `
    <p class="text">Hi <strong>${customerName}</strong>, the chef at Jay's Food Court has started preparing your fresh dishes!</p>
    
    <div class="box" style="text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #78716C; letter-spacing: 1.5px;">Estimated Kitchen Preparation</div>
      <div style="font-size: 28px; font-weight: 900; color: #92400E; margin: 8px 0;">~${prepEstimateMinutes} Minutes</div>
      <div style="font-size: 12px; color: #78716C;">Cooked fresh from our pots upon order.</div>
    </div>

    <p class="text">
      You can watch our live kitchen status and courier dispatch on your real-time tracking desk.
    </p>
  `;

  return sendEmail({
    to,
    subject: `Your Food Is Being Prepared &bull; Order #${orderCode}`,
    html: wrapLuxuryTemplate({
      headline: 'The Chef is Cooking!',
      statusBadge: 'In the Kitchen',
      contentHtml,
      actionButton: {
        text: 'View Live Tracker',
        url: trackingUrl
      }
    })
  });
}

// -------------------------------------------------------------
// 3. RIDER ASSIGNED & DISPATCHED EMAIL
// -------------------------------------------------------------
export async function sendOrderDispatchedEmail({
  to,
  customerName,
  orderCode,
  riderName,
  riderPhone,
  deliveryOtp,
  trackingUrl
}: {
  to: string;
  customerName: string;
  orderCode: string;
  riderName: string;
  riderPhone: string;
  deliveryOtp?: string;
  trackingUrl: string;
}) {
  const contentHtml = `
    <p class="text">Exciting news <strong>${customerName}</strong>! Your food is packed hot and fresh. Courier <strong>${riderName}</strong> has picked up your order and is heading your way.</p>

    <div class="box">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #78716C; letter-spacing: 1px;">Assigned Delivery Courier</div>
      <div style="font-size: 16px; font-weight: 800; color: #17140D; margin-top: 4px;">${riderName}</div>
      <div style="font-size: 13px; color: #78716C; margin-top: 2px;">Contact: <a href="tel:${riderPhone}" style="color: #92400E; font-weight: 700;">${riderPhone}</a></div>
    </div>

    ${deliveryOtp ? `
    <div class="box" style="text-align: center; background-color: #FFFFFF; border: 2px dashed #FFB800;">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #78716C; letter-spacing: 1.5px;">Delivery Handover Code</div>
      <div class="otp-code">${deliveryOtp}</div>
      <div style="font-size: 12px; color: #78716C;">Share with ${riderName} only face-to-face upon delivery.</div>
    </div>
    ` : ''}

    <p class="text">
      Track your rider's live GPS route on your mobile device below.
    </p>
  `;

  return sendEmail({
    to,
    subject: `Rider Dispatched! Order #${orderCode} is On Its Way`,
    html: wrapLuxuryTemplate({
      headline: 'Out for Delivery 🛵',
      statusBadge: 'Dispatched',
      contentHtml,
      actionButton: {
        text: 'Track Rider GPS',
        url: trackingUrl
      }
    })
  });
}

// -------------------------------------------------------------
// 4. ORDER DELIVERED & COMPLETED EMAIL
// -------------------------------------------------------------
export async function sendOrderDeliveredEmail({
  to,
  customerName,
  orderCode
}: {
  to: string;
  customerName: string;
  orderCode: string;
}) {
  const contentHtml = `
    <p class="text">Hello <strong>${customerName}</strong>, your delivery for Order <strong>#${orderCode}</strong> has been successfully verified and completed.</p>
    
    <div class="box" style="text-align: center;">
      <div style="font-size: 36px; margin-bottom: 8px;">🍽️</div>
      <div style="font-size: 18px; font-weight: 800; color: #17140D;">Bon Appétit!</div>
      <div style="font-size: 13px; color: #78716C; margin-top: 4px;">We hope you enjoy every bite of your delicious meal.</div>
    </div>

    <p class="text" style="text-align: center; font-size: 13px;">
      Got feedback or need assistance? Reach out to our manager anytime via WhatsApp.
    </p>
  `;

  return sendEmail({
    to,
    subject: `Delivered! Enjoy Your Meal &bull; Order #${orderCode}`,
    html: wrapLuxuryTemplate({
      headline: 'Order Successfully Handed Over 🎉',
      statusBadge: 'Delivered',
      contentHtml,
      actionButton: {
        text: 'Order Again',
        url: 'http://localhost:3000'
      }
    })
  });
}

// -------------------------------------------------------------
// 5. PASSWORDLESS LOGIN / MAGIC LINK EMAIL
// -------------------------------------------------------------
export async function sendMagicLinkEmail({
  to,
  magicLinkUrl,
  otpCode
}: {
  to: string;
  magicLinkUrl: string;
  otpCode: string;
}) {
  const codeLength = otpCode.length;
  const contentHtml = `
    <p class="text">Hello, you requested to sign in to your <strong>Jay's Food Court</strong> account.</p>

    <div class="box" style="text-align: center;">
      <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #78716C; letter-spacing: 1.5px;">Your ${codeLength}-Digit Login Code</div>
      <div class="otp-code">${otpCode}</div>
      <div style="font-size: 12px; color: #78716C;">This code expires in 15 minutes.</div>
    </div>

    <p class="text" style="text-align: center; margin: 24px 0 10px;">
      Or click the button below to sign in automatically:
    </p>
  `;

  return sendEmail({
    to,
    subject: `Your Login Code: ${otpCode} &bull; Jay's Food Court`,
    html: wrapLuxuryTemplate({
      headline: 'Sign In to Jay\'s Food Court',
      statusBadge: 'Passwordless Login',
      contentHtml,
      actionButton: {
        text: 'Sign In Instantly',
        url: magicLinkUrl
      }
    })
  });
}
