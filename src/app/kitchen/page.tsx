'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Order, OrderStatus, MenuItem } from '@/types';
import { formatNaira } from '@/lib/utils';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
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
  AlertCircle,
  Volume2,
  VolumeX,
  Radio
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

  // Prep Time Adjustment State
  const [prepModalOrder, setPrepModalOrder] = useState<Order | null>(null);
  const [adjustedPrepMins, setAdjustedPrepMins] = useState<number>(15);
  const [prepDelayReason, setPrepDelayReason] = useState<string>('');
  const [isUpdatingPrep, setIsUpdatingPrep] = useState(false);
  
  // Realtime & Audio Chime Tracking
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  // High-clarity pleasant kitchen alert chime using Web Audio API (no external mp3 asset required)
  const playKitchenChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Two-tone bell: C6 (1046.5Hz) then G6 (1567.98Hz)
      playTone(1046.5, 0, 0.4);
      playTone(1567.98, 0.25, 0.6);
    } catch (e) {
      // Audio autoplay policy handled silently
    }
  }, [soundEnabled]);

  // Check existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/staff/me', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.staff) {
          if (['kitchen_staff', 'manager', 'admin', 'owner'].includes(data.staff.role)) {
            setStaff(data.staff);
            setAuthError(null);
          } else {
            setStaff(null);
            setAuthError('Access Denied: Your staff account does not have Kitchen Desk privileges.');
          }
        } else {
          setStaff(null);
        }
      } else {
        setStaff(null);
      }
    } catch (e) {
      setStaff(null);
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
        if (['kitchen_staff', 'manager', 'admin', 'owner'].includes(data.staff.role)) {
          setStaff(data.staff);
          setAuthError(null);
        } else {
          setStaff(null);
          setAuthError('Access Denied: Your staff account does not have Kitchen Desk privileges.');
        }
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
  const fetchOrders = useCallback(async (isInitial = false) => {
    if (!staff) return;
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data: Order[] = await res.json();
        
        // Detect genuinely new orders that arrived after initial load
        if (initialLoadDoneRef.current) {
          let hasNewEligibleOrder = false;
          data.forEach(order => {
            if (!knownOrderIdsRef.current.has(order.id)) {
              hasNewEligibleOrder = true;
              knownOrderIdsRef.current.add(order.id);
            }
          });
          if (hasNewEligibleOrder) {
            playKitchenChime();
          }
        } else {
          // Initialize known orders on first load without chiming for historical backlog
          data.forEach(order => knownOrderIdsRef.current.add(order.id));
          initialLoadDoneRef.current = true;
        }

        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    }
  }, [staff, playKitchenChime]);

  // Fetch menu for availability controls
  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data.items || []);
      }
    } catch (err) {
      console.error('Failed to load menu', err);
    }
  }, []);

  // Supabase Realtime synchronization with fallback polling
  useEffect(() => {
    if (!staff) return;

    fetchOrders(true);
    fetchMenu();

    // 1. Establish Supabase Realtime Subscription for instantaneous kitchen order sync
    const supabase = getSupabaseBrowserClient();
    let channel: any = null;

    if (supabase) {
      channel = supabase
        .channel('kitchen-orders-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            // Re-fetch authoritative sanitized data when database orders change
            fetchOrders();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setRealtimeConnected(false);
          }
        });
    }

    // 2. Reliable Polling Fallback (4s interval) to guarantee resilience against disconnects
    const timer = setInterval(() => {
      fetchOrders();
    }, 4000);

    return () => {
      clearInterval(timer);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [staff, fetchOrders, fetchMenu]);

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

  const handleAdjustKitchenPrep = async (
    orderId: string,
    action: 'adjust_minutes' | 'start_prep' | 'mark_ready' | 'add_delay',
    mins?: number,
    reason?: string
  ) => {
    setIsUpdatingPrep(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/prep-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          estimatedPrepMinutes: mins,
          delayReason: reason
        })
      });

      if (res.ok) {
        setPrepModalOrder(null);
        setPrepDelayReason('');
        fetchOrders();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to update kitchen preparation time');
      }
    } catch {
      alert('Network failure updating kitchen preparation time');
    } finally {
      setIsUpdatingPrep(false);
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

  // While verifying server session on mount, render authentication-loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 border border-brand-gold flex items-center justify-center text-brand-gold animate-spin mb-4">
          <RotateCcw className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Verifying Staff Authentication...</p>
      </div>
    );
  }

  // If unauthenticated, show protected staff access login screen
  if (!staff) {
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

            {/* Credentials must never be exposed or prefilled in frontend buttons (Phase 5.1 Hardening) */}

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
            <Link href="/" className="text-xs text-brand-gold hover:underline">
              ← Return to Customer Storefront
            </Link>
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

            {/* Realtime Status Indicator */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              realtimeConnected
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                : 'bg-amber-950/60 border-amber-800 text-amber-400'
            }`}>
              <Radio className={`w-3.5 h-3.5 ${realtimeConnected ? 'animate-pulse' : ''}`} />
              <span className="hidden md:inline">{realtimeConnected ? 'Realtime Connected' : 'Polling Sync (4s)'}</span>
            </div>

            {/* Kitchen Chime Audio Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) {
                  // Test sound on user enable
                  playKitchenChime();
                }
              }}
              title={soundEnabled ? 'Mute Order Alerts' : 'Unmute Order Alerts'}
              className={`p-2.5 rounded-full transition border ${
                soundEnabled
                  ? 'bg-brand-gold/20 border-brand-gold text-brand-gold hover:bg-brand-gold/30'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

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

            {/* Dynamic Cooking Queue & Preparation Estimate Indicator */}
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
                <div>
                  <span className="font-bold text-white block">
                    Dynamic Kitchen Queue Load: {counts.kitchen} Active Dish{counts.kitchen === 1 ? '' : 'es'} Cooking
                  </span>
                  <span className="text-zinc-400 text-[11px]">
                    Current Smart Customer Prep Buffer: +{Math.min(25, counts.kitchen * 3)} Mins (Base 15 Mins)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-750 font-mono text-brand-gold font-bold">
                  Target Customer ETA: {15 + Math.min(25, counts.kitchen * 3)} - {25 + Math.min(25, counts.kitchen * 3)} Mins
                </span>
                {(staff?.role === 'owner' || staff?.role === 'admin' || staff?.role === 'manager') && (
                  <Link
                    href="/owner"
                    className="px-3 py-1 rounded-full bg-brand-gold text-zinc-950 font-bold hover:bg-brand-goldDark transition"
                  >
                    Owner Pricing Portal →
                  </Link>
                )}
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
                          <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60 max-h-48 overflow-y-auto divide-y divide-zinc-800/60">
                            {o.items.map((it, idx) => (
                              <div key={idx} className="py-2 first:pt-0 last:pb-0 text-xs flex justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <span className="font-extrabold text-white text-xs block">{it.qty}x {it.name}</span>
                                  {/* Exact Swallow breakdown */}
                                  {it.swallows && it.swallows.length > 0 ? (
                                    <div className="text-[11px] text-amber-300 font-semibold space-y-0.5">
                                      {it.swallows.map((sw, sIdx) => (
                                        <div key={sIdx}>• {sw.name}: {sw.quantity} {sw.quantity === 1 ? 'portion' : 'portions'}</div>
                                      ))}
                                    </div>
                                  ) : it.swallow ? (
                                    <div className="text-[11px] text-amber-300 font-semibold">• {it.swallow}</div>
                                  ) : null}

                                  {/* Exact Protein breakdown */}
                                  {it.proteins && it.proteins.length > 0 && (
                                    <div className="text-[11px] text-emerald-400 font-semibold space-y-0.5">
                                      {it.proteins.map((pr, pIdx) => (
                                        <div key={pIdx}>• {pr.name}: {pr.quantity} {pr.quantity === 1 ? 'piece' : 'pieces'}</div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Exact Add-ons breakdown (e.g. Bottled Water) */}
                                  {it.addons && it.addons.length > 0 && (
                                    <div className="text-[11px] text-blue-300 font-semibold space-y-0.5">
                                      {it.addons.map((ad, aIdx) => (
                                        <div key={aIdx}>• {ad.name}: {ad.quantity} {ad.name.toLowerCase().includes('water') ? (ad.quantity === 1 ? 'bottle' : 'bottles') : 'units'}</div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Extras / Options */}
                                  {(!it.swallows || it.swallows.length === 0) &&
                                   (!it.proteins || it.proteins.length === 0) &&
                                   (!it.addons || it.addons.length === 0) &&
                                   it.extras && it.extras.length > 0 && (
                                    <div className="text-[10px] text-zinc-400">↳ +{it.extras.join(', ')}</div>
                                  )}

                                  {it.note && <div className="text-[10px] text-amber-500 italic mt-0.5">&quot;{it.note}&quot;</div>}
                                </div>
                                <span className="text-zinc-400 font-mono text-[11px] shrink-0">{formatNaira(it.unit * it.qty)}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-between items-baseline pt-2 border-t border-zinc-800 text-xs">
                          <span className="text-zinc-400">Total ({o.paymentMode.toUpperCase()}):</span>
                          <span className="font-black text-base text-white">{formatNaira(o.total)}</span>
                        </div>

                        {/* Kitchen Preparation Time & ETA Tracking Display */}
                        <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                              Kitchen Prep Estimate
                            </span>
                            <span className="font-bold text-amber-400">
                              {o.status === 'ready_for_pickup' || o.status === 'delivered'
                                ? 'Food Cooked & Packed ✓'
                                : o.estimatedPrepMinutes
                                ? `${o.estimatedPrepMinutes} Mins Ready Target`
                                : '15 - 20 Mins Standard'}
                            </span>
                            {o.prepDelayReason && (
                              <span className="text-[10px] text-red-400 block italic">
                                Delay: {o.prepDelayReason}
                              </span>
                            )}
                          </div>
                          {['confirmed', 'accepted', 'preparing', 'cooking'].includes(o.status) && (
                            <button
                              onClick={() => {
                                setPrepModalOrder(o);
                                setAdjustedPrepMins(o.estimatedPrepMinutes || 15);
                                setPrepDelayReason(o.prepDelayReason || '');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-brand-gold text-[11px] font-bold transition border border-zinc-700"
                            >
                              Adjust Prep
                            </button>
                          )}
                        </div>
                      </div>

                      {/* State Machine Transition Controls (Eligible Paid Orders Only) */}
                      <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-2">
                        {o.status === 'confirmed' && (
                          <button
                            onClick={() => updateStatus(o.id, 'accepted')}
                            className="flex-1 py-2.5 rounded-xl bg-brand-gold text-brand-ink font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-brand-goldDark transition shadow-sm"
                          >
                            <Flame className="w-3.5 h-3.5" />
                            <span>Accept Order</span>
                          </button>
                        )}
                        {o.status === 'accepted' && (
                          <button
                            onClick={() => updateStatus(o.id, 'preparing')}
                            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-orange-600 transition shadow-sm"
                          >
                            <Flame className="w-3.5 h-3.5" />
                            <span>Start Preparing</span>
                          </button>
                        )}
                        {(o.status === 'preparing' || o.status === 'cooking') && (
                          <button
                            onClick={() => updateStatus(o.id, 'ready_for_pickup')}
                            className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-600 transition shadow-sm"
                          >
                            <span>Mark Ready for Pickup</span>
                          </button>
                        )}
                        {o.status === 'ready_for_pickup' && (
                          <div className="w-full text-center py-2 px-3 text-xs font-bold text-amber-300 bg-amber-950/40 border border-amber-500/20 rounded-xl flex items-center justify-center gap-2">
                            <Bike className="w-4 h-4 text-brand-gold animate-bounce" />
                            <span>Awaiting Rider Pickup</span>
                          </div>
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

      {/* Kitchen Prep Time Adjustment Modal */}
      {prepModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-gold">
                <Flame className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-white text-base">Adjust Kitchen Prep Time</h3>
              </div>
              <button
                type="button"
                onClick={() => setPrepModalOrder(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-400">Order:</span>
                <span className="font-bold text-white">#{prepModalOrder.id} ({prepModalOrder.customerName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Status:</span>
                <span className="text-amber-400 font-bold uppercase">{prepModalOrder.status}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Kitchen Target Prep Time (Minutes)
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 20, 25, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setAdjustedPrepMins(mins)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                        adjustedPrepMins === mins
                          ? 'bg-brand-gold text-zinc-950 font-black'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-750'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Delay Reason / Note for Customer (Optional)
                </label>
                <input
                  type="text"
                  value={prepDelayReason}
                  onChange={(e) => setPrepDelayReason(e.target.value)}
                  placeholder="e.g. Fresh stockfish pot stewing, firewood embers reheating..."
                  className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:border-brand-gold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  disabled={isUpdatingPrep}
                  onClick={() =>
                    handleAdjustKitchenPrep(
                      prepModalOrder.id,
                      'adjust_minutes',
                      adjustedPrepMins,
                      prepDelayReason
                    )
                  }
                  className="py-3 px-4 rounded-xl bg-brand-gold hover:bg-brand-goldDark text-zinc-950 font-black text-xs shadow-md transition disabled:opacity-50"
                >
                  Save New Prep Time
                </button>
                <button
                  type="button"
                  disabled={isUpdatingPrep}
                  onClick={() =>
                    handleAdjustKitchenPrep(
                      prepModalOrder.id,
                      'add_delay',
                      10,
                      prepDelayReason || 'Kitchen experiencing high volume'
                    )
                  }
                  className="py-3 px-4 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 font-bold text-xs transition disabled:opacity-50"
                >
                  Add +10m Rush Delay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
