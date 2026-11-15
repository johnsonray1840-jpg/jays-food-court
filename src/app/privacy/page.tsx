import Link from 'next/link';
import { Metadata } from 'next';
import { ShieldCheck, Lock, Cookie, MapPin, Phone, ArrowLeft, FileText } from 'lucide-react';
import { getMenuItems } from '@/lib/menu';
import { ClientShell } from '@/components/layout/ClientShell';
import { HeaderNavbar } from '@/components/layout/HeaderNavbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: "Privacy Policy | Jay's Food Court LTD",
  description:
    "How Jay's Food Court LTD collects, protects, and processes customer order, location, communication, and payment information in Agbani, Enugu State.",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PrivacyPolicyPage() {
  const menuItems = await getMenuItems();

  return (
    <ClientShell menuItems={menuItems}>
      <HeaderNavbar />
      <main className="min-h-screen bg-white">
        {/* Editorial Header */}
        <section className="bg-brand-cream/70 border-b border-brand-line py-12 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-brand-gold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Storefront</span>
            </Link>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-brand-line text-[11px] font-bold uppercase tracking-wider text-amber-800 ml-3">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-gold" />
              <span>Legal &amp; Data Protection</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-brand-ink tracking-tight">
              Privacy <span className="text-amber-600">Policy</span>
            </h1>

            <p className="text-sm sm:text-base text-zinc-600 max-w-2xl leading-relaxed">
              Jay&apos;s Food Court LTD (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) respects your privacy and safeguards every piece of personal information shared when ordering, paying, or tracking meals across Agbani and Enugu State.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-zinc-500">
              <span>Last Updated: November 15, 2026</span>
              <span aria-hidden="true">&bull;</span>
              <Link href="/terms" className="font-semibold text-amber-800 hover:text-brand-gold transition inline-flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span>Read Terms of Use</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Policy Sections */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              1. Information We Collect
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              To prepare your meals accurately and dispatch riders to your doorstep, we collect only the information needed to fulfill your order and maintain your customer session:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-600 leading-relaxed">
              <li>
                <strong className="text-brand-ink">Contact Identity:</strong> Your full name, normalized Nigerian mobile phone number (for delivery coordination and rider contact), and an optional email address if you choose passwordless sign-in.
              </li>
              <li>
                <strong className="text-brand-ink">Delivery Location Details:</strong> Selected Agbani or Enugu delivery zone, written street/hostel/landmark directions, and optional delivery coordinates used strictly to assign dispatch coverage and calculate delivery fees.
              </li>
              <li>
                <strong className="text-brand-ink">Order &amp; Customization Records:</strong> Selected meals, proteins, swallow portions, add-ons, special preparation instructions, server-verified totals, and order timestamps.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              2. How We Use Your Information
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              We use your personal data exclusively to operate Jay&apos;s Food Court culinary and delivery services:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-600 leading-relaxed">
              <li>Preparing your customized meal tickets accurately in our Agbani kitchen.</li>
              <li>Dispatching assigned riders and communicating arrival or drop-off updates.</li>
              <li>Enabling authorized customer&ndash;rider messaging and in-app voice calls during active deliveries.</li>
              <li>Sending order confirmation receipts, live status updates, and delivery verification prompts.</li>
              <li>Preventing fraudulent orders, unauthorized tampering, and duplicate charges.</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-brand-line bg-brand-cream/40 p-6 sm:p-8 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <Lock className="w-4 h-4 text-brand-gold" />
              <span>Financial Safeguards</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              3. Payment Security &amp; Paystack Processing
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              All electronic card, bank transfer, and USSD payments are processed directly through <strong className="text-brand-ink">Paystack</strong>, a PCI-DSS Level 1 certified payment processor. Jay&apos;s Food Court LTD never sees, collects, or stores your raw debit/credit card numbers, CVV codes, or banking PINs on our servers. We store only transaction reference identifiers, payment verification statuses, and server-verified totals for order reconciliation and refund handling.
            </p>
          </section>

          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              4. Order Lookup Privacy &amp; 4-Digit Delivery Code Protection
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Knowing an order reference code alone does not expose full personal details to unauthorized visitors. Public or unauthenticated order lookups mask sensitive customer personally identifiable information (PII) such as phone numbers and full street addresses.
            </p>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Every completed order generates a private <strong className="text-brand-ink">4-digit delivery verification code (OTP)</strong> stored using cryptographic protection. Only the authorized customer session has access to view the code, and riders must enter your matching 4-digit code to finalize delivery handover.
            </p>
          </section>

          <section
            id="cookies"
            className="scroll-mt-24 rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs"
          >
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <Cookie className="w-4 h-4 text-brand-gold" />
              <span>Browser State &amp; Sessions</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              5. Cookies &amp; Local Storage
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              We use essential browser storage and HTTP cookies strictly required for the storefront to function smoothly:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-600 leading-relaxed">
              <li>
                <strong className="text-brand-ink">Cart Tray &amp; Zone Persistence:</strong> Browser local storage preserves your selected dishes, customizations, and delivery zone when navigating across the homepage, menu, and tracking pages.
              </li>
              <li>
                <strong className="text-brand-ink">Customer Session Cookies:</strong> HTTP-only authentication cookies keep you signed in securely so you can inspect your full order history, saved addresses, and active delivery codes across page reloads.
              </li>
            </ul>
            <p className="text-sm text-zinc-600 leading-relaxed">
              We do not sell personal profiles or deploy third-party advertising trackers.
            </p>
          </section>

          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              6. Data Protection Rights (NDPA 2023)
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              In accordance with the <strong className="text-brand-ink">Nigeria Data Protection Act (NDPA) 2023</strong>, you retain the right to request access to the personal information we hold about your account, ask for inaccurate phone numbers or saved addresses to be corrected, or request deletion of optional profile records (excluding financial transaction records we are legally required to retain for audit compliance). You can manage saved addresses and profile information directly on your{' '}
              <Link href="/profile" className="font-semibold text-amber-800 underline hover:text-brand-gold">
                Customer Account
              </Link>{' '}
              page or contact our kitchen desk directly.
            </p>
          </section>

          <section className="rounded-3xl bg-brand-ink text-white p-6 sm:p-8 space-y-4 border border-zinc-800">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-white">
              7. Contact Information
            </h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              For privacy questions, order data requests, or account assistance, reach Jay&apos;s Food Court LTD directly:
            </p>
            <div className="space-y-2.5 text-sm text-zinc-200">
              <p className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                <span>Ndiagu Ugwu, Umuezeakwunanaw, Agbani, Enugu State</span>
              </p>
              <p className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-brand-gold shrink-0" />
                <a href="tel:+2347087426626" className="hover:text-brand-gold transition font-semibold">
                  07087426626
                </a>
              </p>
            </div>
            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href="https://wa.me/2347087426626"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#25D366] text-white text-xs font-bold shadow hover:opacity-95 transition"
              >
                Message Us on WhatsApp
              </a>
              <Link
                href="/terms"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold transition"
              >
                View Terms of Use
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </ClientShell>
  );
}
