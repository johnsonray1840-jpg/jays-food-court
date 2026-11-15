'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { CartLineItem } from '@/types';
import { formatNaira } from '@/lib/utils';
import {
  X,
  ArrowRight,
  User,
  Phone,
  MapPin,
  Building2,
  ShieldCheck,
  Compass,
  Navigation
} from 'lucide-react';
import { Coordinates, computeEnuguDeliveryQuote, ENUGU_LOCATION_ZONES, isCoordinateWithinEnugu } from '@/lib/enugu-geocoding';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartLineItem[];
  menuItems?: { id: number; available: boolean; name: string }[];
  onRemoveUnavailableItems?: () => void;
  onUpdateQty: (index: number, delta: number) => void;
  onPlaceOrder: (details: {
    customerName: string;
    email?: string;
    phone: string;
    address: string;
    landmark?: string;
    deliveryInstructions?: string;
    paymentMode: 'online';
    promoCode?: string;
    deliveryCoordinates?: Coordinates;
    deliveryZoneId?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function CartDrawer({
  isOpen,
  onClose,
  items,
  menuItems = [],
  onRemoveUnavailableItems,
  onUpdateQty,
  onPlaceOrder,
  isLoading = false
}: CartDrawerProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [paymentMode] = useState<'online'>('online');
  const [errors, setErrors] = useState<{ name?: boolean; phone?: boolean; address?: boolean; location?: string }>({});

  const [deliveryCoords, setDeliveryCoords] = useState<Coordinates | null>(null);
  const [deliveryZoneId, setDeliveryZoneId] = useState<string>('zone_agbani_core');
  const [deliveryZoneName, setDeliveryZoneName] = useState<string>('Agbani (Town & Ndiagu Ugwu)');
  const [deliveryFee, setDeliveryFee] = useState<number>(500);
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState<string>('15 - 25 Mins');

  // Load saved guest details
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jfc_guest');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name) setName(parsed.name);
        if (parsed.email) setEmail(parsed.email);
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.addr) setAddress(parsed.addr);
        if (parsed.landmark) setLandmark(parsed.landmark);
        if (parsed.coords) {
          setDeliveryCoords(parsed.coords);
          const quote = computeEnuguDeliveryQuote(parsed.coords);
          setDeliveryFee(quote.fee);
          setEstimatedDeliveryTime(quote.estimatedTime);
          setDeliveryZoneId(quote.matchedZone.id);
          setDeliveryZoneName(quote.matchedZone.name);
        }
      }
    } catch {
      // LocalStorage fallback
    }
  }, []);

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unit * item.qty, 0);
  const total = subtotal > 0 ? subtotal + deliveryFee : 0;
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  const isValidNigerianPhone = (p: string) => {
    return /^(\+?234|0)[789][01]\d{8}$/.test(p.replace(/[\s\-\(\)]/g, ''));
  };

  // Availability Checking: Check if any items in cart are out of stock
  const unavailableCartItems = items.filter((item) => {
    const menuItem = menuItems.find((m) => m.id === item.id);
    return menuItem && !menuItem.available;
  });

  const hasUnavailableItems = unavailableCartItems.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasUnavailableItems) {
      alert(
        `Some items in your cart are currently sold out: ${unavailableCartItems
          .map((i) => i.name)
          .join(', ')}. Please remove them before proceeding.`
      );
      return;
    }

    const newErrors: { name?: boolean; phone?: boolean; address?: boolean; location?: string } = {};
    if (!name.trim() || name.trim().length < 2) newErrors.name = true;
    if (!isValidNigerianPhone(phone)) newErrors.phone = true;
    if (!address.trim() || address.trim().length < 4) newErrors.address = true;

    // Strict Enugu boundary guard
    if (deliveryCoords && !isCoordinateWithinEnugu(deliveryCoords)) {
      newErrors.location = 'We currently deliver strictly within and around Enugu State.';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    // Persist guest credentials & coordinates
    try {
      localStorage.setItem(
        'jfc_guest',
        JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim(),
          addr: address.trim(),
          landmark: landmark.trim() || undefined,
          coords: deliveryCoords
        })
      );
    } catch {
      // Ignore storage errors
    }

    await onPlaceOrder({
      customerName: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim(),
      address: address.trim(),
      landmark: landmark.trim() || undefined,
      deliveryInstructions: deliveryInstructions.trim() || undefined,
      paymentMode,
      promoCode: promoCode.trim() || undefined,
      deliveryCoordinates: deliveryCoords || undefined,
      deliveryZoneId
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity" />

        {/* Drawer Panel */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
          <aside className="w-screen max-w-full sm:max-w-md bg-white shadow-2xl flex flex-col justify-between h-full">
            
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-brand-line flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-brand-ink">Your Order Bag</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-brand-goldLight text-amber-800 text-xs font-black">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="Close cart drawer"
                className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center text-brand-ink hover:bg-zinc-200 transition active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Itemized List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 divide-y divide-brand-line hide-scrollbar">
              {hasUnavailableItems && (
                <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                    <span>Some items in your cart became unavailable:</span>
                  </div>
                  <p className="text-[11px] text-red-600">
                    {unavailableCartItems.map((i) => i.name).join(', ')} sold out recently. Please remove them to proceed with checkout.
                  </p>
                  {onRemoveUnavailableItems && (
                    <button
                      type="button"
                      onClick={onRemoveUnavailableItems}
                      className="self-start px-3 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shadow-xs transition"
                    >
                      Remove Sold Out Items
                    </button>
                  )}
                </div>
              )}

              {items.length > 0 ? (
                items.map((line, idx) => {
                  const menuItem = menuItems.find((m) => m.id === line.id);
                  const isSoldOut = menuItem && !menuItem.available;

                  return (
                    <div
                      key={line.key + idx}
                      className={`py-4 first:pt-0 last:pb-0 flex items-center gap-3 ${
                        isSoldOut ? 'bg-red-50/50 -mx-2 px-2 rounded-xl border border-red-200' : ''
                      }`}
                    >
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-brand-cream shrink-0">
                        <Image
                          src={line.img}
                          alt={line.name}
                          fill
                          sizes="64px"
                          className={`object-cover ${isSoldOut ? 'grayscale-[60%]' : ''}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-bold text-xs sm:text-sm text-brand-ink truncate">{line.name}</h5>
                          {isSoldOut && (
                            <span className="px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-black uppercase">
                              Sold Out
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-brand-muted line-clamp-1 mt-0.5">
                          {[
                            ...(line.swallows && line.swallows.length > 0
                              ? line.swallows.map((s) => `${s.quantity}x ${s.name}`)
                              : [line.swallow]),
                            ...(line.proteins && line.proteins.length > 0
                              ? line.proteins.map((p) => `${p.quantity}x ${p.name}`)
                              : []),
                            ...(line.addons && line.addons.length > 0
                              ? line.addons.map((a) => `${a.quantity}x ${a.name}`)
                              : []),
                            ...(line.extras || [])
                          ].filter(Boolean).join(' • ')}
                        </p>
                        {line.note && <span className="text-[10px] text-amber-700 italic block truncate">&quot;{line.note}&quot;</span>}
                        <span className="font-extrabold text-xs sm:text-sm text-brand-ink block mt-1">
                          {formatNaira(line.unit * line.qty)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 bg-brand-cream px-2 py-1 rounded-full border border-brand-line shrink-0">
                        <button
                          onClick={() => onUpdateQty(idx, -1)}
                          aria-label="Decrease item quantity"
                          className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-black shadow-xs active:scale-90"
                        >
                          -
                        </button>
                        <span className="text-xs font-black min-w-[16px] text-center">{line.qty}</span>
                        <button
                          onClick={() => !isSoldOut && onUpdateQty(idx, 1)}
                          disabled={isSoldOut}
                          aria-label="Increase item quantity"
                          className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-black shadow-xs active:scale-90 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-20 text-brand-muted text-sm space-y-2">
                  <p>Your bag is currently empty.</p>
                  <p className="text-xs text-zinc-400">Add delicious freshly cooked meals to begin.</p>
                </div>
              )}
            </div>

            {/* Checkout & Guest Details Section */}
            {items.length > 0 && (
              <div className="p-4 sm:p-6 border-t border-brand-line bg-zinc-50/80 space-y-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] sm:pb-6 max-h-[62vh] overflow-y-auto">
                
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-brand-ink uppercase tracking-wider">
                      <User className="w-4 h-4 text-brand-gold" />
                      <span>Delivery Information</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      All Enugu Covered
                    </span>
                  </div>

                  <div>
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your Full Name (e.g. Nkem Okafor) *"
                      className={`w-full px-4 py-3 rounded-2xl bg-white border text-xs sm:text-sm outline-none transition min-h-[46px] ${
                        errors.name ? 'border-red-500' : 'border-brand-line focus:border-brand-gold'
                      }`}
                    />
                    {errors.name && <p className="text-[10px] text-red-500 mt-1 pl-2">Please enter your name</p>}
                  </div>

                  <div>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="WhatsApp / Phone (e.g. 08012345678) *"
                      className={`w-full px-4 py-3 rounded-2xl bg-white border text-xs sm:text-sm outline-none transition min-h-[46px] ${
                        errors.phone ? 'border-red-500' : 'border-brand-line focus:border-brand-gold'
                      }`}
                    />
                    {errors.phone && <p className="text-[10px] text-red-500 mt-1 pl-2">Enter a valid 11-digit Nigerian phone number</p>}
                  </div>

                  {/* Delivery Area & Service-Zone Selection (No GPS Required) */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
                          <span className="text-xs font-black text-brand-ink truncate">{deliveryZoneName}</span>
                        </div>
                        <p className="text-[10px] text-zinc-600 truncate mt-0.5">
                          Standard Enugu delivery corridor ({estimatedDeliveryTime})
                        </p>
                      </div>
                      <span className="text-[11px] font-extrabold text-amber-900 bg-amber-100/80 px-2 py-1 rounded-lg shrink-0">
                        ₦{deliveryFee.toLocaleString()}
                      </span>
                    </div>

                    {/* Quick Enugu Zone Selector */}
                    <div>
                      <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider block mb-1">
                        Select Delivery Area / Zone *
                      </label>
                      <select
                        value={deliveryZoneId}
                        onChange={(e) => {
                          const selected = ENUGU_LOCATION_ZONES.find((z) => z.id === e.target.value) || ENUGU_LOCATION_ZONES[0];
                          setDeliveryZoneId(selected.id);
                          setDeliveryZoneName(selected.name);
                          setDeliveryFee(selected.deliveryFee);
                          setEstimatedDeliveryTime(selected.estimatedTime);
                          setDeliveryCoords(selected.center);
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-brand-line text-xs font-bold text-zinc-900 focus:border-brand-gold outline-none transition"
                      >
                        {ENUGU_LOCATION_ZONES.map((zone) => (
                          <option key={zone.id} value={zone.id}>
                            {zone.name} — ₦{zone.deliveryFee.toLocaleString()} ({zone.estimatedTime})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {errors.location && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                      {errors.location}
                    </div>
                  )}

                  <div>
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="street-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Delivery Address (Street / House / Hostel) *"
                      className={`w-full px-4 py-3 rounded-2xl bg-white border text-xs sm:text-sm outline-none transition min-h-[46px] ${
                        errors.address ? 'border-red-500' : 'border-brand-line focus:border-brand-gold'
                      }`}
                    />
                    {errors.address && <p className="text-[10px] text-red-500 mt-1 pl-2">Please enter your delivery address</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="Landmark (e.g. Near ESUT Gate)"
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-brand-line focus:border-brand-gold text-xs outline-none transition min-h-[42px]"
                    />
                    <input
                      type="text"
                      value={deliveryInstructions}
                      onChange={(e) => setDeliveryInstructions(e.target.value)}
                      placeholder="Note for Rider (e.g. Call at gate)"
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-brand-line focus:border-brand-gold text-xs outline-none transition min-h-[42px]"
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address (for receipts, optional)"
                      className="w-full px-4 py-2.5 rounded-2xl bg-white border border-brand-line focus:border-brand-gold text-xs outline-none transition min-h-[42px]"
                    />
                  </div>

                  {/* Payment Option: Secured by Paystack */}
                  <div className="pt-1">
                    <div className="p-3.5 rounded-2xl border border-brand-gold bg-amber-50/70 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-600/10 flex items-center justify-center text-amber-700">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-brand-ink flex items-center gap-1.5">
                            <span>Pay with Paystack</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 uppercase tracking-wider">Instant</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-medium">Card, Direct Bank Transfer &amp; USSD</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Secured</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Lines */}
                  <div className="space-y-1.5 pt-3 border-t border-brand-line text-xs">
                    <div className="flex justify-between text-brand-muted">
                      <span>Subtotal</span>
                      <span className="font-bold text-brand-ink">{formatNaira(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-brand-muted">
                      <span>Delivery ({deliveryZoneName})</span>
                      <span className="font-bold text-brand-ink">{formatNaira(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-brand-line text-sm font-black text-brand-ink">
                      <span>Total Amount</span>
                      <span className="text-lg text-amber-700">{formatNaira(total)}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || hasUnavailableItems}
                    className="w-full min-h-[50px] py-3.5 sm:py-4 px-6 rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-sm shadow-goldGlow flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
                  >
                    <span>{isLoading ? 'Placing Order...' : hasUnavailableItems ? 'Remove Sold Out Items to Proceed' : 'Place Order Now'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-brand-muted font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Enugu Metropolis Delivery • Verified Dispatch</span>
                </div>

              </div>
            )}

          </aside>
        </div>
      </div>
    </>
  );
}
