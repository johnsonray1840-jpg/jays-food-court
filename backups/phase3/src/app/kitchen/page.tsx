'use client';

import React, { useState, useEffect } from 'react';
import { Order, OrderStatus, MenuItem } from '@/types';
import { formatNaira } from '@/lib/utils';
import {
  Utensils,
  RotateCcw,
  Store,
  Flame,
  Bike,
  CheckCircle2,
  Phone,
  MapPin,
  Lock,
  ShieldCheck,
  LogOut,
  SlidersHorizontal,
  ToggleLeft,
  ToggleRight,
  AlertCircle
} from 'lucide-react';

interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'manager' | 'kitchen_staff' | 'rider';
}

export default function KitchenPage() {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/staff/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.staff) {
          setStaff(data.staff);
        }
      }
    } catch (e) {
      // Unauthenticated
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();
      if (res.ok && data.staff) {
        setStaff(data.staff);
      } else {
        setAuthError(data.error || 'Authentication failed. Please check credentials.');
      }
    } catch (err) {
      setAuthError('Connection failed. Please verify network.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/staff/login', { method: 'DELETE' });
    setStaff(null);
    setOrders([]);
  };

  // Fetch orders when staff authenticated
  const fetchOrders = async () => {
    if (!staff) return;
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    }
  };

  // Fetch menu for availability controls
  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load menu', err);
    }
  };

  useEffect(() => {
    if (staff) {
      fetchOrders();
      fetchMenu();
      const timer = setInterval(() => {
        fetchOrders();
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [staff]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        fetchOrders();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to transition order status');
      }
    } catch (e) {
      alert('Failed to update order status');
    }
  };

  const toggleAvailability = async (menuId: number, currentAvailable: boolean) => {
    const newStatus = !currentAvailable;
    try {
      const res = await fetch(`/api/menu/${menuId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: newStatus })
      });

      if (res.ok) {
        setMenuItems((prev) =>
          prev.map((item) => (item.id === menuId ? { ...item, available: newStatus } : item))
        );
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to update dish availability');
      }
    } catch (e) {
      alert('Network error while toggling dish availability');
    }
  };

  // If unauthenticated, show protected staff access login screen
  if (!staff && !isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-brand-gold text-brand-ink flex items-center justify-center mx-auto mb-3 shadow-goldGlow">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white">Staff Terminal Login</h1>
            <p className="text-xs text-zinc-400">
              Restricted to authorized kitchen staff, managers, riders and owners.
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-2xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Staff Email Address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="staff@jaysfoodcourt.com"
                className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-brand-gold outline-none transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-brand-gold outline-none transition"
              />
            </div>

            {process.env.NODE_ENV !== 'production' && (
              <div className="pt-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">
                  Dev Role Shortcuts:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('kitchen@jaysfoodcourt.com');
                      setLoginPassword('kitchen2026');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-left truncate"
                  >
                    👨🏾‍🍳 Kitchen Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('manager@jaysfoodcourt.com');
                      setLoginPassword('manager2026');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-left truncate"
                  >
                    👔 Manager
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('owner@jaysfoodcourt.com');
                      setLoginPassword('jay2026foodcourt');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-left truncate"
                  >
                    👑 Restaurant Owner
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-2xl bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-sm shadow-goldGlow transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In to Terminal'}</span>
            </button>
          </form>

          <div className="text-center pt-2">
            <a href="/" className="text-xs text-brand-gold hover:underline">
              ← Return to Customer Storefront
            </a>
          </div>
        </div>
      </div>
    );
  }

  const counts = {
    incoming: orders.filter((o) => o.status === 'confirmed' || o.status === 'pending_payment').length,
    kitchen: orders.filter((o) => o.status === 'accepted' || o.status === 'preparing' || o.status === 'cooking').length,
    dispatch: orders.filter(
      (o) =>
        o.status === 'ready_for_pickup' ||
        o.status === 'assigned_to_rider' ||
        o.status === 'picked_up' ||
        o.status === 'out_for_delivery' ||
        o.status === 'dispatched'
    ).length,
    completed: orders.filter((o) => o.status === 'delivered').length
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-zinc-900 border border-zinc-800 p-6 rounded-3xl gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-gold text-brand-ink flex items-center justify-center text-xl font-black">
              <Utensils className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  Jay&apos;s Food Court <span className="text-brand-gold font-serif italic">Kitchen Desk</span>
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-brand-goldLight text-amber-900 text-[10px] font-black uppercase tracking-wider">
                  {staff?.role}
                </span>
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Signed in as {staff?.fullName} ({staff?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Switcher Tabs */}
            <div className="bg-zinc-950 p-1 rounded-full border border-zinc-800 flex">
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                  activeTab === 'orders' ? 'bg-brand-gold text-brand-ink' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Live Orders ({orders.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('menu');
                  fetchMenu();
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'menu' ? 'bg-brand-gold text-brand-ink' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Menu Controls</span>
              </button>
            </div>

            <button
              onClick={() => {
                fetchOrders();
                fetchMenu();
              }}
              aria-label="Refresh"
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <a
              href="/"
              target="_blank"
              className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-full transition flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Storefront</span>
            </a>

            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="p-2.5 bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-300 rounded-full transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* TAB 1: LIVE ORDERS VIEW */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Live Metrics Counter */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Incoming New</span>
                <h3 className="text-2xl font-black text-brand-gold mt-1">{counts.incoming}</h3>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Kitchen Active</span>
                <h3 className="text-2xl font-black text-blue-400 mt-1">{counts.kitchen}</h3>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Courier Dispatch</span>
                <h3 className="text-2xl font-black text-purple-400 mt-1">{counts.dispatch}</h3>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Delivered Orders</span>
                <h3 className="text-2xl font-black text-emerald-400 mt-1">{counts.completed}</h3>
              </div>
            </div>

            {/* Orders Feed */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Active Customer Orders</h2>

              {orders.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-12 text-center text-zinc-400 space-y-2">
                  <p className="text-sm">No incoming orders yet.</p>
                  <p className="text-xs text-zinc-500">Orders placed by customers will appear here in real time.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-zinc-700 transition"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-black text-brand-gold text-sm tracking-wider">#{o.id}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-zinc-800 text-zinc-300">
                            {o.status}
                          </span>
                        </div>

                        <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800/80 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-white">{o.customerName}</span>
                            <a href={`tel:${o.phone}`} className="text-brand-gold flex items-center gap-1 hover:underline">
                              <Phone className="w-3 h-3" /> {o.phone}
                            </a>
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-start gap-1">
                            <MapPin className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5" />
                            <span>{o.address}</span>
                          </div>
                        </div>

                        <div className="space-y-1 pt-1">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Food Items</span>
                          <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60 max-h-40 overflow-y-auto divide-y divide-zinc-800/60">
                            {o.items.map((it, idx) => (
                              <div key={idx} className="py-1.5 first:pt-0 last:pb-0 text-xs flex justify-between">
                                <div>
                                  <span className="font-bold text-white">{it.qty}x {it.name}</span>
                                  {it.swallow && <div className="text-[10px] text-amber-300">↳ {it.swallow}</div>}
                                  {it.extras && it.extras.length > 0 && (
                                    <div className="text-[10px] text-zinc-400">↳ +{it.extras.join(', ')}</div>
                                  )}
                                  {it.note && <div className="text-[10px] text-zinc-500 italic">&quot;{it.note}&quot;</div>}
                                </div>
                                <span className="text-zinc-400 font-mono">{formatNaira(it.unit * it.qty)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between items-baseline pt-2 border-t border-zinc-800 text-xs">
                          <span className="text-zinc-400">Total ({o.paymentMode.toUpperCase()}):</span>
                          <span className="font-black text-base text-white">{formatNaira(o.total)}</span>
                        </div>
                      </div>

                      {/* State Machine Transition Controls */}
                      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-2">
                        {o.status === 'pending_payment' && (
                          <button
                            onClick={() => updateStatus(o.id, 'confirmed')}
                            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-400 transition"
                          >
                            Confirm Payment
                          </button>
                        )}
                        {o.status === 'confirmed' && (
                          <button
                            onClick={() => updateStatus(o.id, 'accepted')}
                            className="flex-1 py-2.5 rounded-xl bg-brand-gold text-brand-ink font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-brand-goldDark transition"
                          >
                            Accept Order
                          </button>
                        )}
                        {o.status === 'accepted' && (
                          <button
                            onClick={() => updateStatus(o.id, 'preparing')}
                            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-orange-600 transition"
                          >
                            <Flame className="w-4 h-4" /> Start Preparing
                          </button>
                        )}
                        {(o.status === 'preparing' || o.status === 'cooking') && (
                          <button
                            onClick={() => updateStatus(o.id, 'ready_for_pickup')}
                            className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-600 transition"
                          >
                            Mark Ready for Pickup
                          </button>
                        )}
                        {o.status === 'ready_for_pickup' && (
                          <button
                            onClick={() => updateStatus(o.id, 'assigned_to_rider')}
                            className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-indigo-600 transition"
                          >
                            <Bike className="w-4 h-4" /> Assign Rider
                          </button>
                        )}
                        {o.status === 'assigned_to_rider' && (
                          <button
                            onClick={() => updateStatus(o.id, 'picked_up')}
                            className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-purple-600 transition"
                          >
                            Hand to Rider (Picked Up)
                          </button>
                        )}
                        {o.status === 'picked_up' && (
                          <button
                            onClick={() => updateStatus(o.id, 'out_for_delivery')}
                            className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-purple-700 transition"
                          >
                            <Bike className="w-4 h-4" /> Out for Delivery
                          </button>
                        )}
                        {(o.status === 'out_for_delivery' || o.status === 'dispatched') && (
                          <button
                            onClick={() => updateStatus(o.id, 'delivered')}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-600 transition"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Mark Delivered
                          </button>
                        )}
                        {o.status === 'delivered' && (
                          <div className="w-full text-center py-2 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 rounded-xl">
                            ✓ Order Completed
                          </div>
                        )}
                        {o.status === 'cancelled' && (
                          <div className="w-full text-center py-2 text-xs font-bold text-red-400 bg-red-950/40 border border-red-500/20 rounded-xl">
                            ✕ Order Cancelled
                          </div>
                        )}
                        {o.status === 'refunded' && (
                          <div className="w-full text-center py-2 text-xs font-bold text-blue-400 bg-blue-950/40 border border-blue-500/20 rounded-xl">
                            💳 Order Refunded
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MENU MANAGEMENT & SOLD-OUT CONTROLS */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-2">
              <h2 className="text-xl font-black text-white">Live Menu Availability Controls</h2>
              <p className="text-xs text-zinc-400">
                Authorized staff can toggle sold-out states in real time. Changes are instantly reflected across the storefront.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {menuItems.map((dish) => (
                <div
                  key={dish.id}
                  className={`bg-zinc-900 border rounded-3xl p-5 flex flex-col justify-between space-y-4 transition ${
                    dish.available ? 'border-zinc-800' : 'border-red-900/40 bg-zinc-900/60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-sm text-white line-clamp-1">{dish.name}</h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          dish.available
                            ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                            : 'bg-red-950 border border-red-800 text-red-300'
                        }`}
                      >
                        {dish.available ? 'Available' : 'Sold Out'}
                      </span>
                    </div>

                    <p className="text-xs text-brand-gold font-bold font-mono">{formatNaira(dish.price)}</p>
                    <p className="text-[11px] text-zinc-400 line-clamp-2">{dish.desc}</p>
                    <span className="text-[10px] text-zinc-500 block">Category: {dish.cat}</span>
                  </div>

                  <button
                    onClick={() => toggleAvailability(dish.id, dish.available)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      dish.available
                        ? 'bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200'
                        : 'bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-200'
                    }`}
                  >
                    {dish.available ? (
                      <>
                        <ToggleRight className="w-4 h-4 text-red-400" />
                        <span>Mark as Sold Out</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4 text-emerald-400" />
                        <span>Mark as Available</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
