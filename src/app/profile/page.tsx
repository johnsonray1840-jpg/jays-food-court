'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  MapPin,
  Clock,
  Sparkles,
  ChevronRight,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle,
  Trash2,
  ArrowLeft,
  Loader2,
  Calendar,
  Gift,
  AlertCircle,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  Receipt,
  UtensilsCrossed,
  Bike
} from 'lucide-react';
import { formatNaira } from '@/lib/utils';
import { OrderStatus } from '@/types';

interface CustomerProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  createdAt: string;
  orderCount: number;
}

interface AddressRecord {
  id: string;
  street_address: string;
  landmark: string | null;
  city: string;
  state: string;
  is_default: boolean;
}

interface OrderHistoryItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  totalPrice: number;
  customizations?: any[];
}

interface CustomerOrder {
  id: string;
  orderCode: string;
  customerName: string;
  phone: string;
  deliveryAddress: string;
  status: OrderStatus;
  paymentStatus: string;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  paymentMethod: string;
  estimatedDeliveryTime?: string;
  createdAt: string;
  items: OrderHistoryItem[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'main' | 'details' | 'addresses' | 'orders'>('main');

  // Magic Link Login State
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Edit details state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/customer/me');
      const data = await res.json();
      if (data.authenticated && data.customer) {
        setProfile(data.customer);
        setAddresses(data.addresses || []);
        setEditName(data.customer.fullName);
        setEditPhone(data.customer.phone);
        // Also fetch customer order history
        fetchCustomerOrders();
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCustomerOrders() {
    setIsLoadingOrders(true);
    try {
      const res = await fetch('/api/customer/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Failed to load order history', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function handleSendMagicLink(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) return;
    if (resendCooldown > 0) return;

    setIsSendingMagicLink(true);
    setLoginError(null);
    setLoginMessage(null);

    try {
      const res = await fetch('/api/auth/customer/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput })
      });
      const data = await res.json();
      if (res.ok) {
        setMagicLinkSent(true);
        setLoginMessage(data.message || 'Magic link and 8-digit code sent to your inbox!');
        setResendCooldown(30);
      } else {
        setLoginError(data.error || 'Failed to send login email. Please try again.');
      }
    } catch (err) {
      setLoginError('Network error. Please try again.');
    } finally {
      setIsSendingMagicLink(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otpInput || otpInput.trim().length < 6) return;

    setIsVerifyingOtp(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/customer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          token: otpInput.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMagicLinkSent(false);
        fetchProfile();
      } else {
        setLoginError(data.error || 'Invalid code. Please check your email.');
      }
    } catch (err) {
      setLoginError('Verification failed. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function handleSignOut() {
    try {
      await fetch('/api/auth/customer/signout', { method: 'POST' });
      setProfile(null);
      setAddresses([]);
      setOrders([]);
      setView('main');
    } catch (err) {
      console.error('Sign out error', err);
    }
  }

  async function handleDeleteAddress(addressId: string) {
    try {
      const res = await fetch(`/api/customer/addresses/${addressId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      }
    } catch (err) {
      console.error('Delete address error', err);
    }
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingDetails(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editName,
          phone: editPhone
        })
      });
      if (res.ok) {
        setSaveSuccess(true);
        if (profile) {
          setProfile({ ...profile, fullName: editName, phone: editPhone });
        }
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Update profile error', err);
    } finally {
      setIsSavingDetails(false);
    }
  }

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'delivered':
        return { label: 'Delivered', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'out_for_delivery':
      case 'dispatched':
      case 'picked_up':
        return { label: 'On The Way', color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'ready_for_pickup':
      case 'assigned_to_rider':
        return { label: 'Ready for Rider', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'preparing':
      case 'cooking':
      case 'accepted':
        return { label: 'Cooking in Kitchen', color: 'bg-amber-50 text-amber-800 border-amber-300' };
      case 'confirmed':
        return { label: 'Order Confirmed', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'cancelled':
        return { label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200' };
      case 'refunded':
        return { label: 'Refunded', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
      case 'pending_payment':
      default:
        return { label: 'Awaiting Payment', color: 'bg-yellow-50 text-yellow-800 border-yellow-200' };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  // 1. GUEST / SIGN-IN VIEW (If customer signed out or visiting on new device)
  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20 pt-6 px-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </Link>
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            Jay&apos;s Food Court Profile
          </span>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-zinc-100 text-center">
          {/* Animated Avatar Icon */}
          <div className="w-20 h-20 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border-2 border-amber-200 shadow-sm text-3xl font-black">
            🍲
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
            Instant Passwordless Login
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-2 leading-relaxed">
            Enter your email to receive a secure login link and 8-digit code. All your past orders and delivery addresses will be restored.
          </p>

          {!magicLinkSent ? (
            <form onSubmit={handleSendMagicLink} className="mt-6 text-left space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Your Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="johndoe@gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {loginMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingMagicLink}
                className="w-full py-3.5 rounded-full bg-zinc-900 hover:bg-amber-500 hover:text-zinc-950 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2"
              >
                {isSendingMagicLink ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Account...</span>
                  </>
                ) : (
                  <span>Send Login Link</span>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-6 text-left space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Enter 8-Digit Email Code
                </label>
                <input
                  type="text"
                  maxLength={8}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="12345678"
                  className="w-full px-4 py-3 text-center tracking-[0.35em] font-mono font-bold text-xl rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <p className="text-[11px] text-zinc-500 mt-1 text-center">
                  Sent to <strong className="text-zinc-800">{emailInput}</strong>
                </p>
              </div>

              {loginError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingOtp}
                className="w-full py-3.5 rounded-full bg-zinc-900 hover:bg-amber-500 hover:text-zinc-950 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2"
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify & Log In</span>
                )}
              </button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleSendMagicLink()}
                  disabled={resendCooldown > 0 || isSendingMagicLink}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 disabled:text-zinc-400 disabled:cursor-not-allowed transition"
                >
                  {isSendingMagicLink
                    ? 'Resending...'
                    : resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend link & code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMagicLinkSent(false);
                    setOtpInput('');
                    setLoginError(null);
                  }}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-900 transition"
                >
                  Use different email
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center justify-center gap-2 text-[11px] text-zinc-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted Passwordless Customer Authentication</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. ORDER HISTORY SUB-VIEW
  if (view === 'orders') {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20 pt-6 px-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              setView('main');
              setSelectedOrder(null);
            }}
            className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shadow-xs active:scale-95 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-zinc-900">Food Order History</h1>
          <span className="w-9" />
        </div>

        {/* Selected Order Detail Drawer / Modal View */}
        {selectedOrder ? (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-zinc-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold block">Order Reference</span>
                  <span className="text-base font-black text-zinc-900 font-mono">#{selectedOrder.orderCode}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(selectedOrder.status).color}`}>
                  {getStatusBadge(selectedOrder.status).label}
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Ordered Food</span>
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between text-xs py-1.5 border-b border-zinc-50 last:border-none">
                    <div className="flex-1 pr-2">
                      <span className="font-bold text-zinc-900 block">
                        {item.quantity}x {item.name}
                      </span>
                      {item.customizations && item.customizations.length > 0 && (
                        <span className="text-[11px] text-zinc-500 block">
                          + {item.customizations.map((c: any) => c.name || c).join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-zinc-800">{formatNaira(item.totalPrice || item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown */}
              <div className="bg-zinc-50 rounded-2xl p-3.5 space-y-2 text-xs border border-zinc-100">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span>{formatNaira(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount</span>
                    <span>-{formatNaira(selectedOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-600">
                  <span>Delivery Fee</span>
                  <span>{formatNaira(selectedOrder.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-zinc-900 pt-2 border-t border-zinc-200">
                  <span>Total Paid</span>
                  <span className="text-amber-800">{formatNaira(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              {/* Delivery Details */}
              <div className="space-y-1.5 text-xs text-zinc-600 bg-amber-50/50 p-3 rounded-2xl border border-amber-100">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-zinc-800 block">Delivery Destination</span>
                    <span className="text-[11px] text-zinc-600">{selectedOrder.deliveryAddress}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-500">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Placed on {new Date(selectedOrder.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pt-2 flex gap-2">
                <Link
                  href={`/#track?order=${selectedOrder.orderCode}`}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-amber-500 hover:text-zinc-950 text-white font-bold text-xs text-center transition flex items-center justify-center gap-1.5"
                >
                  <Bike className="w-4 h-4" />
                  <span>Live Track Order</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="py-3 px-4 rounded-xl border border-zinc-200 text-zinc-700 font-bold text-xs hover:bg-zinc-50 transition"
                >
                  Back to List
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isLoadingOrders ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-zinc-100">
                <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-zinc-500">Loading your food orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-zinc-100">
                <ShoppingBag className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
                <h3 className="font-bold text-sm text-zinc-800">No food orders yet</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Once you order your favorite soup or rice specialties, you will see your order history and live statuses here.
                </p>
                <Link
                  href="/#menu"
                  className="inline-block mt-4 px-5 py-2.5 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs shadow-sm hover:bg-amber-400 transition"
                >
                  Explore Menu
                </Link>
              </div>
            ) : (
              orders.map((ord) => {
                const statusMeta = getStatusBadge(ord.status);
                const itemsSummary = ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');

                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrder(ord)}
                    className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-xs hover:border-amber-200 hover:shadow-sm transition cursor-pointer space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-zinc-900">
                          #{ord.orderCode}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          • {new Date(ord.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="text-xs">
                      <p className="font-medium text-zinc-800 line-clamp-1">{itemsSummary}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{ord.deliveryAddress}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-50 text-xs">
                      <span className="font-bold text-zinc-900">{formatNaira(ord.totalAmount)}</span>
                      <span className="text-amber-700 font-bold flex items-center gap-1 text-[11px]">
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. PROFILE DETAILS SUB-VIEW
  if (view === 'details') {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20 pt-6 px-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setView('main')}
            className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shadow-xs active:scale-95 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-zinc-900">Profile Details</h1>
        </div>

        <form onSubmit={handleSaveDetails} className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-xs">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Account name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full font-bold text-sm text-zinc-900 focus:outline-none"
            />
          </div>

          <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-xs">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Phone number
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" />
                Verified
              </span>
            </div>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full font-bold text-sm text-zinc-900 focus:outline-none"
            />
          </div>

          <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-xs">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
              Email
            </label>
            <input
              type="email"
              disabled
              value={profile.email || ''}
              className="w-full font-bold text-sm text-zinc-400 focus:outline-none cursor-not-allowed"
            />
          </div>

          <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-xs flex items-center justify-between">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                Member Since
              </label>
              <span className="text-xs font-bold text-zinc-700">
                {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'November 2026'}
              </span>
            </div>
            <Calendar className="w-5 h-5 text-zinc-300" />
          </div>

          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-bold text-center">
              Profile updated successfully!
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingDetails}
            className="w-full py-3.5 rounded-full bg-zinc-900 hover:bg-amber-500 hover:text-zinc-950 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 mt-6"
          >
            {isSavingDetails ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Changes</span>}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-200 space-y-3">
          <button
            onClick={handleSignOut}
            className="w-full py-3 px-4 rounded-2xl bg-white border border-zinc-200 flex items-center justify-between text-xs font-bold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition"
          >
            <div className="flex items-center gap-2.5">
              <LogOut className="w-4 h-4 text-zinc-500" />
              <span>Sign out</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>
    );
  }

  // 4. SAVED ADDRESSES SUB-VIEW
  if (view === 'addresses') {
    return (
      <div className="min-h-screen bg-zinc-50 pb-20 pt-6 px-4 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setView('main')}
            className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shadow-xs active:scale-95 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl font-black text-zinc-900">Delivery Addresses</h1>
        </div>

        <div className="space-y-3">
          {addresses.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-zinc-100">
              <MapPin className="w-10 h-10 text-zinc-300 mx-auto mb-2" />
              <h3 className="font-bold text-sm text-zinc-800">No saved addresses yet</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Addresses used during checkout will automatically save here for 1-click reorders.
              </p>
            </div>
          ) : (
            addresses.map((addr) => (
              <div
                key={addr.id}
                className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-xs flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs sm:text-sm text-zinc-900 leading-snug line-clamp-2">
                      {addr.street_address}
                    </p>
                    {addr.landmark && (
                      <p className="text-[11px] text-zinc-400 mt-0.5 truncate">
                        Near: {addr.landmark}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteAddress(addr.id)}
                  aria-label="Delete address"
                  className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center shrink-0 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 5. MAIN CUSTOMER PROFILE VIEW
  return (
    <div className="min-h-screen bg-zinc-50 pb-28 pt-6 px-4 max-w-md mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900">
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="text-xs font-bold text-zinc-500 hover:text-red-600 transition"
        >
          Sign out
        </button>
      </div>

      {/* Profile Card Header (Avatar + Name + Jay Coins) */}
      <div className="text-center mb-6">
        <div className="relative w-24 h-24 mx-auto mb-3">
          <div className="w-24 h-24 rounded-full bg-amber-400 flex items-center justify-center text-4xl shadow-md border-4 border-white">
            😋
          </div>
          <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs border border-zinc-100 text-xs">
            ✨
          </span>
        </div>

        <h1 className="text-2xl font-black text-zinc-900 tracking-tight">
          {profile.fullName}
        </h1>

        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-3 py-0.5 rounded-full shadow-xs">
            🪙 {orders.length * 10 || profile.orderCount * 10 || 40} Jay Coins
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-black bg-amber-500 text-zinc-950 px-3 py-0.5 rounded-full shadow-xs">
            ★ 5.0
          </span>
        </div>

        {/* Customer Phone Verification Tag */}
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] font-mono font-bold">
          <span>{profile.phone.replace(/[^0-9]/g, '').slice(-10)} | Verified Customer</span>
        </div>
      </div>

      {/* FOOD ORDERS & ACTIVITY (Primary Focus) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Food Orders &amp; Activity
          </h2>
          {orders.length > 0 && (
            <button
              onClick={() => setView('orders')}
              className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1"
            >
              <span>View All ({orders.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-zinc-100 shadow-xs divide-y divide-zinc-100 overflow-hidden">
          {/* Order History Direct Row */}
          <button
            onClick={() => setView('orders')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm text-zinc-900 block">Food Order History</span>
                <span className="text-[11px] text-zinc-400 block">
                  {orders.length > 0 ? `${orders.length} past order${orders.length === 1 ? '' : 's'} recorded` : 'View ordered meals & status'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-black">
                {orders.length}
              </span>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </div>
          </button>

          {/* Quick Track Order Link */}
          <Link
            href="/#track"
            className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-700">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm text-zinc-900 block">Track Live Orders</span>
                <span className="text-[11px] text-zinc-400 block">Check delivery progress &amp; handover code</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </Link>
        </div>
      </div>

      {/* Account Settings Section */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 px-1">
          Account Settings
        </h2>

        <div className="bg-white rounded-3xl border border-zinc-100 shadow-xs divide-y divide-zinc-100 overflow-hidden">
          {/* Profile Details */}
          <button
            onClick={() => setView('details')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-700">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm text-zinc-900 block">Profile Details</span>
                <span className="text-[11px] text-zinc-400 block">{profile.phone}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Addresses */}
          <button
            onClick={() => setView('addresses')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50 transition active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-700">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm text-zinc-900 block">Delivery Addresses</span>
                <span className="text-[11px] text-zinc-400 block">Saved locations for fast checkout</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full border border-zinc-200 bg-zinc-50 text-zinc-700 text-[11px] font-bold">
                {addresses.length}
              </span>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </div>
          </button>

          {/* Agbani Fast-Track Perk */}
          <div className="p-4 flex items-center justify-between text-left">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm text-zinc-900 block">Fast-Track Delivery</span>
                <span className="text-[11px] text-zinc-400 block">Active Agbani priority dispatch</span>
              </div>
            </div>
            <span className="text-[10px] uppercase font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
