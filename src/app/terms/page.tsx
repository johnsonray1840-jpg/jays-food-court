import Link from 'next/link';
import { Metadata } from 'next';
import { FileText, Scale, Clock, ShieldAlert, KeyRound, ArrowLeft, ShieldCheck } from 'lucide-react';
import { getMenuItems } from '@/lib/menu';
import { ClientShell } from '@/components/layout/ClientShell';
import { HeaderNavbar } from '@/components/layout/HeaderNavbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: "Terms of Use | Jay's Food Court LTD",
  description:
    "Terms governing food ordering, server-authoritative pricing, Paystack payments, delivery zones, and OTP delivery verification at Jay's Food Court LTD.",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TermsOfUsePage() {
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
              <Scale className="w-3.5 h-3.5 text-brand-gold" />
              <span>Service Agreement</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-brand-ink tracking-tight">
              Terms of <span className="text-amber-600">Use</span>
            </h1>

            <p className="text-sm sm:text-base text-zinc-600 max-w-2xl leading-relaxed">
              By browsing our menu, placing an order, or tracking a delivery on Jay&apos;s Food Court LTD, you agree to the terms below governing freshly cooked meal preparation and doorstep dispatch across Agbani and Enugu State.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-zinc-500">
              <span>Effective Date: November 15, 2026</span>
              <span aria-hidden="true">&bull;</span>
              <Link href="/privacy" className="font-semibold text-amber-800 hover:text-brand-gold transition inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Read Privacy Policy</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Terms Sections */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4 text-brand-gold" />
              <span>Kitchen Operations</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              1. Service Overview &amp; Operating Hours
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Jay&apos;s Food Court LTD operates freshly cooked kitchen and courier dispatch services from our hub at <strong className="text-brand-ink">Ndiagu Ugwu, Umuezeakwunanaw, Agbani, Enugu State</strong>. Standard ordering and dispatch hours run daily from <strong className="text-brand-ink">08:00 AM to 10:00 PM</strong> (WAT). Orders submitted outside kitchen operating hours or during temporary capacity holds cannot enter preparation until active service resumes.
            </p>
          </section>

          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              2. Menu Availability, Customizations &amp; Server-Authoritative Pricing
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              All listed prices are denominated in Nigerian Naira (₦). Every meal is cooked fresh on order, and ingredient availability (including specific proteins, swallow options, and chilled drinks) is synced live with our kitchen inventory.
            </p>
            <p className="text-sm text-zinc-600 leading-relaxed">
              For financial accuracy, all order subtotals—comprising base dishes, multi-protein quantities, extra swallow portions, optional add-ons, and zone delivery fees—are strictly validated and calculated on our servers at checkout. Client-modified prices or unavailable item selections are automatically rejected.
            </p>
          </section>

          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              3. Payments &amp; Order Confirmation
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Orders enter our kitchen queue only after payment verification is confirmed through <strong className="text-brand-ink">Paystack</strong>. Initiated orders left unpaid past the payment expiration window are automatically marked as expired so active kitchen stock is released back to other customers.
            </p>
          </section>

          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              4. Delivery Zones &amp; Customer Responsibilities
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              We deliver exclusively within supported Agbani and Enugu coverage zones displayed during checkout (and listed under{' '}
              <Link href="/#delivery-zones" className="font-semibold text-amber-800 underline hover:text-brand-gold">
                Delivery Zones &amp; Fees
              </Link>
              ). By placing an order, you agree to:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-600 leading-relaxed">
              <li>Provide an accurate Nigerian phone number and clear landmark/street directions within a serviceable delivery zone.</li>
              <li>Remain reachable by phone or in-app delivery chat when the assigned rider approaches your drop-off point.</li>
              <li>Note that displayed delivery windows are operational estimates and may vary slightly based on preparation queue, weather, or campus access gates.</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-brand-line bg-brand-cream/40 p-6 sm:p-8 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <KeyRound className="w-4 h-4 text-brand-gold" />
              <span>Handover Verification</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              5. Mandatory 4-Digit Delivery Verification Code
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              To protect customers and riders against misdelivery, every active order is protected by a private <strong className="text-brand-ink">4-digit delivery verification code (OTP)</strong> visible on your authorized{' '}
              <Link href="/track" className="font-semibold text-amber-800 underline hover:text-brand-gold">
                Track Order
              </Link>{' '}
              screen. Please verify your meal package upon arrival and share this 4-digit code only with the Jay&apos;s Food Court rider physically handing over your order.
            </p>
          </section>

          <section
            id="refunds"
            className="scroll-mt-24 rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs"
          >
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-brand-gold" />
              <span>Cancellations &amp; Resolutions</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              6. Cancellations, Refunds &amp; Issue Resolution
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-zinc-600 leading-relaxed">
              <li>
                <strong className="text-brand-ink">Before Kitchen Preparation:</strong> Confirmed orders that have not yet entered active cooking may be eligible for cancellation and full refund. Contact our kitchen desk immediately at{' '}
                <a href="tel:+2347087426626" className="font-semibold text-amber-800 underline hover:text-brand-gold">
                  07087426626
                </a>{' '}
                with your order reference code.
              </li>
              <li>
                <strong className="text-brand-ink">Once Preparation Starts:</strong> Because all meals are freshly prepared on order with perishable ingredients, orders already in active cooking or out with a dispatch rider cannot be cancelled unilaterally except in cases of verified kitchen stock unavailability or failed dispatch.
              </li>
              <li>
                <strong className="text-brand-ink">Refund Processing:</strong> Approved refunds are initiated back to your original Paystack payment method and typically settle within standard Nigerian banking / Paystack settlement timelines.
              </li>
            </ul>
          </section>

          <section className="rounded-3xl border border-brand-line bg-white p-6 sm:p-8 space-y-3 shadow-xs">
            <h2 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">
              7. Acceptable Use &amp; Governing Law
            </h2>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Customers agree not to misuse the platform, attempt price manipulation, bypass authentication controls, or probe another person&apos;s order reference. Abuse, fraud, or harassment directed toward kitchen staff or dispatch riders may result in order refusal and account restriction.
            </p>
            <p className="text-sm text-zinc-600 leading-relaxed">
              These Terms of Use are governed by the laws of the <strong className="text-brand-ink">Federal Republic of Nigeria</strong>, and any disputes arising from orders fulfilled by Jay&apos;s Food Court LTD shall fall within the jurisdiction of courts in Enugu State.
            </p>
          </section>

          <div className="rounded-3xl bg-brand-ink text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-zinc-800">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">Need Immediate Help?</p>
              <p className="text-sm text-zinc-300">
                Contact Jay&apos;s Food Court Desk at{' '}
                <a href="tel:+2347087426626" className="text-white font-bold underline hover:text-brand-gold">
                  07087426626
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/privacy"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold transition"
              >
                <FileText className="w-3.5 h-3.5 text-brand-gold" />
                <span>Privacy Policy</span>
              </Link>
              <Link
                href="/menu"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink text-xs font-bold transition"
              >
                <span>Browse Menu</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </ClientShell>
  );
}
