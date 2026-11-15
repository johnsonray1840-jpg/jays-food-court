'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bike,
  Navigation,
  MapPin,
  ExternalLink,
  Phone,
  CheckCircle,
  AlertCircle,
  Radio,
  RefreshCw,
  Lock,
  LogOut,
  ShieldAlert,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  Power,
  History,
  PackageCheck,
  Check,
  XCircle
} from 'lucide-react';
import { Order, OrderStatus } from '@/types';
import { formatNaira } from '@/lib/utils';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useOrderCommunication } from '@/hooks/useOrderCommunication';
import { OrderChatModal } from '@/components/communication/OrderChatModal';
import { VoiceCallModal, IncomingCallModal } from '@/components/communication/VoiceCallModal';
import { MessageSquare } from 'lucide-react';
import { notificationManager } from '@/lib/notifications';

interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'manager' | 'kitchen_staff' | 'rider';
}

export default function RiderPortalPage() {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Rider Availability & Operational State
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'offers' | 'active' | 'history'>('offers');
  const [dispatchOffers, setDispatchOffers] = useState<any[]>([]);
  const [isLoadingOffers, setIsLoadingOffers] = useState<boolean>(false);
  const [riderHistory, setRiderHistory] = useState<any>({ completed: [], cancelled: [], totalDeliveries: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Delivery OTP Modal
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);

  // In-App Rider Communication
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [commActionError, setCommActionError] = useState<string | null>(null);

  const isSelectedOrderAssigned = Boolean(
    selectedOrder?.id &&
    ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(selectedOrder.status)
  );

  const {
    messages,
    unreadCount,
    counterpartTyping,
    activeCall,
    incomingCall,
    channelConnected,
    isClosed: isCommClosed,
    error: commError,
    clearError: clearCommError,
    sendMessage,
    sendTyping,
    startCall,
    updateCallStatus,
    markAsRead,
    setActiveCall,
    setIncomingCall
  } = useOrderCommunication({
    orderCode: selectedOrder?.id || '',
    orderStatus: selectedOrder?.status || '',
    userRole: 'rider',
    enabled: isSelectedOrderAssigned
  });

  // Realtime Sync & Recovery State
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Check auth session on load
  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/staff/me', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.staff) {
          // Verify staff role
          if (['rider', 'admin', 'manager', 'owner'].includes(data.staff.role)) {
            setStaff(data.staff);
          } else {
            setStaff(null);
            setAuthError('Access Denied: Kitchen staff accounts cannot access rider dispatch.');
          }
        } else {
          setStaff(null);
        }
      } else {
        setStaff(null);
      }
    } catch {
      setStaff(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDeliveryOrders = useCallback(async () => {
    if (!staff) return;
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data: Order[] = await res.json();
        // Couriers strictly view actionable delivery orders
        const dispatchable = data.filter((o) =>
          ['ready_for_pickup', 'assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status)
        );
        const activeAssigned = dispatchable.filter((o) =>
          ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status)
        );
        setOrders(dispatchable);
        if (!selectedOrder && (activeAssigned.length > 0 || dispatchable.length > 0)) {
          setSelectedOrder(activeAssigned[0] || dispatchable[0]);
        } else if (selectedOrder) {
          const updated = dispatchable.find((o) => o.id === selectedOrder.id);
          if (updated) {
            if (updated.status === 'ready_for_pickup' && activeAssigned.length > 0) {
              setSelectedOrder(activeAssigned[0]);
            } else {
              setSelectedOrder(updated);
            }
          } else {
            setSelectedOrder(activeAssigned[0] || dispatchable[0] || null);
          }
        }
      }
    } catch {
      // Background retry
    }
  }, [staff, selectedOrder]);

  // Fetch Eligible Dispatch Offers
  const fetchDispatchOffers = useCallback(async () => {
    if (!staff) return;
    setIsLoadingOffers(true);
    try {
      const res = await fetch('/api/dispatch/offers');
      if (res.ok) {
        const data = await res.json();
        setDispatchOffers(data.offers || []);
      }
    } catch {
      // Retry
    } finally {
      setIsLoadingOffers(false);
    }
  }, [staff]);

  // Handle Offer Response (Accept / Reject)
  const handleOfferResponse = async (offerId: string, action: 'accept' | 'reject') => {
    try {
      const res = await fetch(`/api/dispatch/offers/${offerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();

      if (res.ok) {
        if (action === 'accept') {
          // Assigned successfully: switch to active delivery tab immediately
          await fetchDeliveryOrders();
          await fetchRiderProfile();
          setActiveTab('active');
        } else {
          // Reject: refresh available offers
          await fetchDispatchOffers();
        }
      } else {
        alert(data.error || 'Failed to process offer action.');
        await fetchDispatchOffers();
      }
    } catch {
      alert('Network failure handling delivery offer.');
    }
  };

  // Fetch Rider Profile & Availability
  const fetchRiderProfile = useCallback(async () => {
    if (!staff) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/riders/me');
      if (res.ok) {
        const data = await res.json();
        if (data.rider) {
          setIsAvailable(data.rider.isAvailable);
        }
        if (data.history) {
          setRiderHistory(data.history);
        }
        if (data.activeDelivery) {
          // Keep active tab synced if on delivery
          setActiveTab('active');
        }
      }
    } catch {
      // Retry
    } finally {
      setIsLoadingHistory(false);
    }
  }, [staff]);

  // Toggle Availability (Go Online / Go Offline)
  const handleToggleAvailability = async (targetState: boolean) => {
    setIsUpdatingAvailability(true);
    try {
      const res = await fetch('/api/riders/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: targetState })
      });
      const data = await res.json();
      if (res.ok) {
        setIsAvailable(targetState);
        fetchDeliveryOrders();
      } else {
        alert(data.error || 'Failed to update availability status.');
      }
    } catch {
      alert('Network failure updating availability.');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (staff) {
      // 1. Initial Authoritative State Fetch
      fetchRiderProfile();
      fetchDeliveryOrders();
      fetchDispatchOffers();

      // 2. Supabase Realtime Subscription for instantaneous delivery offer & status synchronization
      const supabase = getSupabaseBrowserClient();
      let ordersChannel: any = null;
      let ridersChannel: any = null;

      // Duplicate Event Protection (Debounce / timestamp deduplication)
      let lastEventTime = 0;
      const handleRealtimeChange = () => {
        const now = Date.now();
        if (now - lastEventTime < 400) return; // Ignore duplicate microsecond triggers
        lastEventTime = now;
        // Authoritative Database Refetch
        fetchDeliveryOrders();
        fetchDispatchOffers();
        fetchRiderProfile();
      };

      if (supabase) {
        ordersChannel = supabase
          .channel('rider-orders-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            handleRealtimeChange
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setRealtimeConnected(true);
              // Authoritative refetch after initial connect or reconnect
              fetchDeliveryOrders();
              fetchDispatchOffers();
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setRealtimeConnected(false);
            }
          });

        ridersChannel = supabase
          .channel(`rider-profile-realtime-${staff.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'riders', filter: `id=eq.${staff.id}` },
            handleRealtimeChange
          )
          .subscribe();
      }

      // 3. Controlled Fallback Polling (4-second interval) for offline recovery
      const timer = setInterval(() => {
        fetchDeliveryOrders();
        fetchDispatchOffers();
      }, 4000);

      // 4. Strict Subscription Cleanup
      return () => {
        clearInterval(timer);
        if (supabase) {
          if (ordersChannel) supabase.removeChannel(ordersChannel);
          if (ridersChannel) supabase.removeChannel(ridersChannel);
        }
      };
    }
  }, [staff, fetchDeliveryOrders, fetchRiderProfile, fetchDispatchOffers]);

  // Handle Rider Login
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
        if (['rider', 'admin', 'manager', 'owner'].includes(data.staff.role)) {
          setStaff(data.staff);
        } else {
          setAuthError('Access Denied: Role not authorized for courier operations.');
        }
      } else {
        setAuthError(data.error || 'Invalid rider login credentials.');
      }
    } catch {
      setAuthError('Connection error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/staff/me', { method: 'DELETE' });
      setStaff(null);
      setSelectedOrder(null);
    } catch {
      // Handle logout
    }
  };

  // Transition Order State (Riders are strictly restricted by state machine)
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, customOtp?: string) => {
    try {
      const payload: any = {
        status: newStatus,
        actorRole: 'rider',
        actorId: staff?.id,
        rider: {
          name: staff?.fullName || 'Dedicated Courier',
          phone: '07087426626'
        }
      };

      if (newStatus === 'delivered' && customOtp) {
        payload.deliveryOtp = customOtp;
      }

      // Try PUT first then PATCH fallback for robustness
      let res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok && res.status === 405) {
        res = await fetch(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        if (newStatus === 'delivered') {
          setOtpModalOpen(false);
          setDeliveryOtpInput('');
        }
        fetchDeliveryOrders();
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || 'Failed to update order status';
        if (newStatus === 'delivered') {
          setOtpError(errMsg);
        } else {
          alert(errMsg);
        }
        return false;
      }
    } catch {
      const netErr = 'Network failure updating status';
      if (newStatus === 'delivered') {
        setOtpError(netErr);
      } else {
        alert(netErr);
      }
      return false;
    }
  };

  const handleCompleteDeliveryClick = () => {
    setOtpError(null);
    setDeliveryOtpInput('');
    setOtpModalOpen(true);
  };

  const handleVerifyOtpAndDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (deliveryOtpInput.length < 4 || deliveryOtpInput.length > 6) {
      setOtpError('Please enter the customer verification code (4-6 digits).');
      return;
    }
    setIsSubmittingOtp(true);
    setOtpError(null);
    try {
      await handleUpdateStatus(selectedOrder.id, 'delivered', deliveryOtpInput);
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  const JFC_KITCHEN_ADDRESS = "Jay's Food Court, Ndiagu Ugwu, Agbani, Enugu State, Nigeria";

  const getCustomerNavigationUrl = (order: Order) => {
    const rawAddress = (order.address || '').trim();
    const landmark = ((order as any).landmark || (order as any).delivery_landmark || '').trim();
    const zone = ((order as any).delivery_zone_id || (order as any).deliveryZone || '').trim();

    // If completely empty address, return null so we don't generate misleading directions
    if (!rawAddress && !landmark) {
      return null;
    }

    // Build query safely using URLSearchParams without raw string concatenation
    const destinationParts = [rawAddress, landmark, zone, 'Enugu, Nigeria'].filter(Boolean);
    const destinationQuery = destinationParts.join(', ');

    const params = new URLSearchParams({
      api: '1',
      origin: JFC_KITCHEN_ADDRESS,
      destination: destinationQuery
    });

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  };

  const getKitchenNavigationUrl = () => {
    const params = new URLSearchParams({
      api: '1',
      destination: JFC_KITCHEN_ADDRESS
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  };

  // While verifying server session on mount, render authentication-loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 border border-brand-gold flex items-center justify-center text-brand-gold animate-spin mb-4">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Verifying Courier Authentication...</p>
      </div>
    );
  }

  // 1. Unauthenticated Login Screen (Mobile First)
  if (!staff) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-gold flex items-center justify-center mx-auto text-zinc-950 font-black shadow-lg">
              <Bike className="w-6 h-6" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">Courier Dispatch Portal</h2>
            <p className="text-xs text-zinc-400">Sign in with your authorized rider credentials</p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Rider Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="rider@jaysfoodcourt.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-xs sm:text-sm focus:border-brand-gold outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-xs sm:text-sm focus:border-brand-gold outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-xl bg-brand-gold hover:bg-brand-goldDark text-zinc-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In as Courier'}</span>
            </button>
          </form>

          <p className="text-[11px] text-center text-zinc-500">
            Jay&apos;s Food Court • Strict Role-Based Courier Security
          </p>
        </div>
      </div>
    );
  }

  // 2. Mobile-First Authorized Courier Dashboard
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col">
      {/* Top Mobile Bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/95 backdrop-blur px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center text-zinc-950 font-black shrink-0">
            <Bike className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-extrabold truncate">
              Jay&apos;s Dispatch <span className="text-brand-gold">Courier</span>
            </h1>
            <p className="text-[10px] text-zinc-400 truncate">
              {staff.fullName} ({staff.role})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Availability Toggle Button */}
          <button
            onClick={() => handleToggleAvailability(!isAvailable)}
            disabled={isUpdatingAvailability}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition ${
              isAvailable
                ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-500/20'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700'
            }`}
          >
            <Power className="w-3 h-3" />
            <span>{isUpdatingAvailability ? 'Updating...' : (isAvailable ? 'Online' : 'Offline')}</span>
          </button>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Rider Status Ribbon */}
      <div className={`px-4 py-2 border-b text-xs flex items-center justify-between ${
        isAvailable
          ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
          : 'bg-amber-950/40 border-amber-900/60 text-amber-300'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <span className="font-medium">
            {isAvailable
              ? 'You are Online — Ready to receive delivery offers from Jay\'s Food Court.'
              : 'You are Offline — Toggle status to Go Online and receive delivery assignments.'}
          </span>
        </div>
        <button
          onClick={() => handleToggleAvailability(!isAvailable)}
          disabled={isUpdatingAvailability}
          className="underline font-bold text-[11px]"
        >
          {isAvailable ? 'Go Offline' : 'Go Online'}
        </button>
      </div>

      {/* Main Tabs (Offers / Active Mission / Private History) */}
      <div className="bg-zinc-900/80 border-b border-zinc-800 px-4 flex gap-6">
        <button
          onClick={() => setActiveTab('offers')}
          className={`py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'offers'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Available Offers ({orders.filter(o => o.status === 'ready_for_pickup').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'active'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Bike className="w-4 h-4" />
          <span>Active Delivery {selectedOrder ? `(#${selectedOrder.id})` : ''}</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            fetchRiderProfile();
          }}
          className={`py-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'history'
              ? 'border-brand-gold text-brand-gold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>My History ({riderHistory.totalDeliveries || 0})</span>
        </button>
      </div>

      {/* Main Views Container */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6">
        
        {/* VIEW 1: AVAILABLE OFFERS (Dispatch Pool) */}
        {activeTab === 'offers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Shared Dispatch Pool</h3>
                <p className="text-xs text-zinc-400">
                  Ready meals awaiting courier pickup from Jay&apos;s Food Court Kitchen Hub.
                </p>
              </div>
              <button
                onClick={fetchDeliveryOrders}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-brand-gold hover:text-white flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Pool</span>
              </button>
            </div>

            {!isAvailable ? (
              <div className="p-8 rounded-3xl bg-zinc-900 border border-zinc-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                  <Power className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">You Are Currently Offline</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Riders must explicitly opt into receiving delivery offers. Toggle your status to Online to view and claim available orders.
                </p>
                <button
                  onClick={() => handleToggleAvailability(true)}
                  disabled={isUpdatingAvailability}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition shadow-md shadow-emerald-500/20"
                >
                  Go Online Now
                </button>
              </div>
            ) : dispatchOffers.length === 0 ? (
              <div className="p-12 rounded-3xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
                <Clock className="w-10 h-10 text-zinc-600 mx-auto" />
                <h4 className="text-sm font-bold text-zinc-300">No Eligible Offers in Dispatch Pool</h4>
                <p className="text-xs text-zinc-500">
                  You are online. Ready orders will appear here automatically with real-time countdowns.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dispatchOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition space-y-4 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-brand-gold">Order #{offer.orderCode}</span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                          Ready for Pickup
                        </span>
                      </div>
                      <span className="text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-full">
                        Expires in {Math.floor(offer.offerExpiresInSeconds / 60)}m {offer.offerExpiresInSeconds % 60}s
                      </span>
                    </div>

                    {/* Pickup Hub Details */}
                    <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        Pickup Location
                      </div>
                      <div className="text-xs font-bold text-white">{offer.pickupLocation.name}</div>
                      <div className="text-[11px] text-zinc-400">{offer.pickupLocation.address}</div>
                    </div>

                    {/* Dropoff Neighborhood Details (Customer personal phone masked prior to claim) */}
                    <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gold">
                        Delivery Destination & Zone
                      </div>
                      <div className="text-xs font-bold text-white flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5" />
                        <span>{offer.deliveryAddress}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {offer.itemCount} food item(s) • Est. Delivery: {offer.estimatedTime}
                      </div>
                    </div>

                    {/* Order Financials & Accept/Reject Buttons */}
                    <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Total Value</span>
                        <span className="text-sm font-black text-emerald-400">{formatNaira(offer.totalAmount)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOfferResponse(offer.id, 'reject')}
                          className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition"
                        >
                          Decline
                        </button>

                        <button
                          onClick={() => handleOfferResponse(offer.id, 'accept')}
                          className="px-4 py-2 rounded-xl bg-brand-gold hover:bg-brand-goldDark text-zinc-950 font-black text-xs uppercase tracking-wider shadow-md shadow-brand-gold/20 flex items-center gap-1.5 transition active:scale-95"
                        >
                          <Check className="w-4 h-4" />
                          <span>Accept Offer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: ACTIVE MISSION & IN-TRANSIT WORKFLOW */}
        {activeTab === 'active' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Queue / Assigned Orders */}
            <div className="space-y-3 lg:col-span-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400">
                  MY ACTIVE ASSIGNMENTS
                </span>
                <button
                  onClick={fetchDeliveryOrders}
                  className="text-xs text-brand-gold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {orders.filter(o => ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status)).length === 0 ? (
                <div className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
                  <PackageCheck className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400 font-bold">No active deliveries in progress.</p>
                  <button
                    onClick={() => setActiveTab('offers')}
                    className="text-xs font-bold text-brand-gold underline mt-2 block"
                  >
                    View Available Dispatch Offers
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orders
                    .filter(o => ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status))
                    .map((order) => {
                      const isSelected = selectedOrder?.id === order.id;
                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900 border-brand-gold shadow-md ring-1 ring-brand-gold'
                              : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-black text-brand-gold">#{order.id}</span>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                              {order.status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <h4 className="font-bold text-xs sm:text-sm text-white truncate">{order.customerName}</h4>
                          <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-brand-gold shrink-0" />
                            <span>{order.address}</span>
                          </p>

                          <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-400">{formatNaira(order.total)}</span>
                            <span className="text-[10px] text-zinc-500 font-medium">{order.eta}</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Right Column: Selected Mission Details & Handover OTP */}
            <div className="lg:col-span-2 space-y-4">
              {selectedOrder ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-6 space-y-5">
                  
                  {/* Mission Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold block">
                        ACTIVE COURIER MISSION
                      </span>
                      <h3 className="text-lg sm:text-xl font-black text-white">
                        Order #{selectedOrder.id}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {isSelectedOrderAssigned && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCommActionError(null);
                              clearCommError();
                              setIsChatOpen(true);
                              markAsRead();
                            }}
                            className="relative px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-brand-gold flex items-center gap-1.5 transition shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                            {unreadCount > 0 && (
                              <span className="w-4 h-4 rounded-full bg-brand-gold text-zinc-950 text-[10px] font-black flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              setCommActionError(null);
                              clearCommError();
                              const res = await startCall();
                              if (res?.error) {
                                setCommActionError(res.error);
                              }
                            }}
                            disabled={isCommClosed}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1.5 transition shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>In-App Call</span>
                          </button>
                        </>
                      )}

                      {getCustomerNavigationUrl(selectedOrder) ? (
                        <a
                          href={getCustomerNavigationUrl(selectedOrder)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 rounded-xl bg-brand-gold hover:bg-brand-goldDark text-zinc-950 text-xs font-black flex items-center gap-1.5 transition shadow-sm"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Navigate to Customer</span>
                        </a>
                      ) : (
                        <button
                          disabled
                          title="Customer address incomplete — please contact customer directly"
                          className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-500 text-xs font-bold flex items-center gap-1.5 cursor-not-allowed"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Incomplete Address</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Kitchen Pickup & Customer Destination Cards */}
                  {(commActionError || commError) && isSelectedOrderAssigned && (
                    <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{commActionError || commError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Kitchen Pickup Card */}
                    <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black text-amber-500 tracking-wider block">
                          RESTAURANT PICKUP LOCATION
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400">
                          Kitchen Hub
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                          <span>Jay&apos;s Food Court Kitchen Hub</span>
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5 pl-5">
                          Ndiagu Ugwu, Agbani, Enugu State
                        </p>
                      </div>
                      <div className="pt-1">
                        <a
                          href={getKitchenNavigationUrl()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-brand-gold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Open Kitchen in Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Customer Dropoff Card */}
                    <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black text-brand-gold tracking-wider block">
                          CUSTOMER DELIVERY DESTINATION
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand-gold/10 text-brand-gold">
                          Dropoff
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5" />
                          <span>{selectedOrder.address || 'Address unlisted'}</span>
                        </h4>
                        {((selectedOrder as any).landmark || (selectedOrder as any).delivery_landmark) && (
                          <p className="text-[11px] text-amber-400 pl-5">
                            Landmark: <b>{(selectedOrder as any).landmark || (selectedOrder as any).delivery_landmark}</b>
                          </p>
                        )}
                        {((selectedOrder as any).delivery_zone_id || (selectedOrder as any).deliveryZone) && (
                          <p className="text-[11px] text-zinc-400 pl-5">
                            Zone: <b>{(selectedOrder as any).delivery_zone_id || (selectedOrder as any).deliveryZone}</b>
                          </p>
                        )}
                        {((selectedOrder as any).deliveryDetails?.deliveryInstructions || (selectedOrder as any).special_instructions) && (
                          <p className="text-[11px] text-zinc-400 pl-5 italic">
                            Instructions: &quot;{(selectedOrder as any).deliveryDetails?.deliveryInstructions || (selectedOrder as any).special_instructions}&quot;
                          </p>
                        )}
                      </div>
                      <div className="pt-1">
                        {getCustomerNavigationUrl(selectedOrder) ? (
                          <a
                            href={getCustomerNavigationUrl(selectedOrder)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-emerald-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Open Navigation to Customer</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-amber-500 font-medium">
                            Address incomplete — call customer for precise directions.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Location & Turn-by-Turn Card */}
                  <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-black text-brand-gold tracking-wider block">
                        DESTINATION &amp; ROUTE GUIDANCE
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Agbani Hub ➔ Destination
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-white">{selectedOrder.address || 'Address unlisted'}</p>
                          {((selectedOrder as any).landmark || (selectedOrder as any).delivery_landmark || (selectedOrder as any).deliveryDetails?.landmark) && (
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Landmark: <span className="text-zinc-200 font-medium">{(selectedOrder as any).landmark || (selectedOrder as any).delivery_landmark || (selectedOrder as any).deliveryDetails?.landmark}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400">Turn-by-turn navigation:</span>
                        {getCustomerNavigationUrl(selectedOrder) ? (
                          <a
                            href={getCustomerNavigationUrl(selectedOrder)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold inline-flex items-center gap-1.5 transition"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Navigate with Google Maps</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-amber-500 font-bold">
                            Incomplete Address — Call Customer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Order Items Review */}
                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                      FOOD ITEMS TO DELIVER
                    </span>
                    <div className="divide-y divide-zinc-800/80 rounded-2xl bg-zinc-950/60 p-3">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white">{item.qty}x {item.name}</span>
                            {item.swallow && (
                              <span className="text-zinc-500 block text-[11px]">Swallow: {item.swallow}</span>
                            )}
                            {item.note && (
                              <span className="text-amber-500 block text-[10px] italic">&quot;{item.note}&quot;</span>
                            )}
                          </div>
                          <span className="text-zinc-400 font-medium">{formatNaira(item.unit * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Courier State Progression Controls */}
                  <div className="pt-2 flex flex-wrap gap-2.5">
                    {selectedOrder.status === 'ready_for_pickup' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'assigned_to_rider')}
                        className="flex-1 py-3.5 px-4 rounded-xl bg-brand-gold hover:bg-brand-goldDark text-zinc-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Accept Assignment</span>
                      </button>
                    )}

                    {selectedOrder.status === 'assigned_to_rider' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'picked_up')}
                        className="flex-1 py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95"
                      >
                        <Bike className="w-4 h-4" />
                        <span>Mark Picked Up from Kitchen</span>
                      </button>
                    )}

                    {(selectedOrder.status === 'picked_up' || selectedOrder.status === 'ready_for_pickup') && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'out_for_delivery')}
                        className="flex-1 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95"
                      >
                        <Bike className="w-4 h-4" />
                        <span>Start Delivery (En Route)</span>
                      </button>
                    )}

                    {selectedOrder.status === 'out_for_delivery' && (
                      <button
                        onClick={handleCompleteDeliveryClick}
                        className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Complete Delivery ✓</span>
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-[11px] text-zinc-500 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                    <span>Financial privilege isolation: Couriers cannot modify prices, payment records, or refunds.</span>
                  </div>

                </div>
              ) : (
                <div className="h-80 rounded-3xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                  <Navigation className="w-10 h-10 mb-3 opacity-40 text-brand-gold" />
                  <p className="text-sm font-bold text-zinc-400">Select an active mission</p>
                  <p className="text-xs">Or switch to the Offers tab to accept new deliveries.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: PRIVATE COURIER DELIVERY HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-white">My Delivery History</h3>
              <p className="text-xs text-zinc-400">
                Your private record of completed, delivered, and cancelled deliveries. Isolated to your rider account.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Delivered</span>
                <span className="text-2xl font-black text-emerald-400">{riderHistory.completed?.length || 0}</span>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">Cancelled</span>
                <span className="text-2xl font-black text-rose-400">{riderHistory.cancelled?.length || 0}</span>
              </div>
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Total Handled</span>
                <span className="text-2xl font-black text-white">{riderHistory.totalDeliveries || 0}</span>
              </div>
            </div>

            {isLoadingHistory ? (
              <div className="p-12 text-center text-xs text-zinc-500">Loading delivery history...</div>
            ) : (!riderHistory.completed || riderHistory.completed.length === 0) ? (
              <div className="p-12 rounded-3xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
                <History className="w-10 h-10 text-zinc-600 mx-auto" />
                <h4 className="text-sm font-bold text-zinc-300">No Completed Deliveries Yet</h4>
                <p className="text-xs text-zinc-500">
                  Accept and complete deliveries from the dispatch pool to view them here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {riderHistory.completed.map((order: any) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">Order #{order.order_code || order.id.slice(0, 8)}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                          Delivered
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">{order.delivery_address}</p>
                      <span className="text-[10px] text-zinc-500 mt-0.5 block">
                        Completed: {new Date(order.updated_at || order.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-sm text-emerald-400">{formatNaira(order.total_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Customer Delivery OTP Verification Modal */}
      {otpModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-gold">
                <Lock className="w-5 h-5" />
                <h3 className="font-black text-white text-base">Handoff Verification</h3>
              </div>
              <button
                type="button"
                onClick={() => setOtpModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Ask the customer for the <b>verification code</b> displayed on their live tracking screen to complete order handoff.
            </p>

            <form onSubmit={handleVerifyOtpAndDeliver} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 text-center">
                  Customer Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={deliveryOtpInput}
                  onChange={(e) => setDeliveryOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  autoFocus
                  className="w-full py-3.5 px-4 rounded-2xl bg-zinc-950 border border-zinc-750 text-center font-mono text-3xl font-black tracking-widest text-brand-gold focus:border-brand-gold outline-none"
                />
              </div>

              {otpError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOtp || deliveryOtpInput.length < 4}
                  className="flex-1 py-3 px-4 rounded-xl bg-brand-gold hover:bg-brand-goldDark text-zinc-950 font-black text-xs disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition"
                >
                  {isSubmittingOtp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>Verify & Deliver</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Customer Chat Modal */}
      {selectedOrder && isSelectedOrderAssigned && (
        <OrderChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          orderCode={selectedOrder.id}
          orderStatus={selectedOrder.status}
          userRole="rider"
          counterpartName={selectedOrder.customerName || 'Customer'}
          messages={messages}
          counterpartTyping={counterpartTyping}
          isClosed={isCommClosed}
          channelConnected={channelConnected}
          commError={commActionError || commError}
          onSendMessage={sendMessage}
          onSendTyping={sendTyping}
          onStartCall={async () => {
            setIsChatOpen(false);
            setCommActionError(null);
            const res = await startCall();
            if (res?.error) {
              setCommActionError(res.error);
            }
          }}
          onMarkRead={markAsRead}
        />
      )}

      {/* In-App Voice Call Modal */}
      {activeCall && (
        <VoiceCallModal
          call={activeCall}
          userRole="rider"
          counterpartName={selectedOrder?.customerName || 'Customer'}
          onEndCall={(callId, duration, endReason) => updateCallStatus(callId, 'ended', duration, endReason)}
          onStatusChange={(status) => {
            if (activeCall) updateCallStatus(activeCall.id, status);
          }}
        />
      )}

      {/* Incoming Call Ring Modal */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          counterpartName={incomingCall.caller_name || selectedOrder?.customerName || 'Customer'}
          onAccept={(call) => {
            notificationManager.stopIncomingRingtone();
            setActiveCall(call);
            setIncomingCall(null);
            updateCallStatus(call.id, 'accepted');
          }}
          onDecline={(callId) => {
            notificationManager.stopIncomingRingtone();
            updateCallStatus(callId, 'declined');
            setIncomingCall(null);
          }}
        />
      )}

    </div>
  );
}
