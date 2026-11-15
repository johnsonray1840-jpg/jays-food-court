'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Lock,
  LogOut,
  Sliders,
  DollarSign,
  MapPin,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Store,
  Truck,
  Edit2,
  Save,
  Clock,
  Sparkles,
  Bike,
  Activity,
  UserCheck,
  UserX,
  PackageCheck,
  ChevronRight,
  Radio,
  History,
  Search,
  ExternalLink,
  Ban,
  RotateCcw,
  Coffee,
  AlertTriangle,
  Receipt,
  Trash2
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { MenuItem } from '@/types';
import { formatNaira } from '@/lib/utils';
import { EnuguLocationZone } from '@/lib/enugu-geocoding';
import { OrderHistoryManager } from '@/components/admin/OrderHistoryManager';
import { MealManager } from '@/components/admin/MealManager';
import { RiderManager } from '@/components/admin/RiderManager';
import { CustomizationManager } from '@/components/admin/CustomizationManager';

interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'manager' | 'kitchen_staff' | 'rider';
}

export default function OwnerManagementPage() {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'pricing' | 'customizations' | 'zones' | 'fleet' | 'history'>('pricing');

  // Fleet State
  const [fleetRiders, setFleetRiders] = useState<any[]>([]);
  const [fleetOrders, setFleetOrders] = useState<any[]>([]);
  const [fleetMetrics, setFleetMetrics] = useState<any>(null);
  const [awaitingOrders, setAwaitingOrders] = useState<any[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Privileged Intervention Modal State
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: 'suspend_rider' | 'reactivate_rider' | 'mark_unavailable' | 'reassign_order' | 'investigate_failed_assignment' | null;
    targetId: string;
    targetName: string;
    targetType: 'rider' | 'order';
    orderData?: any;
  }>({
    isOpen: false,
    action: null,
    targetId: '',
    targetName: '',
    targetType: 'rider'
  });
  const [actionReason, setActionReason] = useState('');
  const [actionReplacementRiderId, setActionReplacementRiderId] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [investigationData, setInvestigationData] = useState<any | null>(null);

  // Rider Management Modal & Operations State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteVehicleType, setInviteVehicleType] = useState('Motorcycle');
  const [inviteZoneId, setInviteZoneId] = useState<string>('');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Rider Profile Detail Modal
  const [selectedRiderDetail, setSelectedRiderDetail] = useState<any | null>(null);
  const [isLoadingRiderDetail, setIsLoadingRiderDetail] = useState(false);
  const [isUpdatingRiderStatus, setIsUpdatingRiderStatus] = useState(false);
  const [isTriggeringReset, setIsTriggeringReset] = useState(false);

  // Menu State
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editingMenuId, setEditingMenuId] = useState<number | null>(null);
  const [editedPrice, setEditedPrice] = useState<number>(0);
  const [isSavingMenu, setIsSavingMenu] = useState(false);

  // Delivery Zones State
  const [zones, setZones] = useState<EnuguLocationZone[]>([]);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editedFee, setEditedFee] = useState<number>(0);
  const [editedMinOrder, setEditedMinOrder] = useState<number>(0);
  const [editedTime, setEditedTime] = useState<string>('');
  const [editedActive, setEditedActive] = useState<boolean>(true);
  const [isSavingZone, setIsSavingZone] = useState(false);

  // Feedback banner
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Rider Account Deletion State
  const [deletingRiderAccount, setDeletingRiderAccount] = useState<{ id: string; name: string } | null>(null);
  const [deleteRiderReason, setDeleteRiderReason] = useState('');
  const [isDeletingRider, setIsDeletingRider] = useState(false);

  const checkSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/staff/me', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.staff) {
          if (['owner', 'admin', 'manager'].includes(data.staff.role)) {
            setStaff(data.staff);
          } else {
            setStaff(null);
            setAuthError('Access Denied: Owner Portal requires Owner or Manager privileges.');
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

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data.items || []);
      }
    } catch {
      // Retry
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/delivery');
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
      }
    } catch {
      // Retry
    }
  }, []);

  const fetchFleet = useCallback(async () => {
    setIsLoadingFleet(true);
    try {
      const [fleetRes, ridersRes, ordersRes] = await Promise.all([
        fetch('/api/admin/fleet'),
        fetch('/api/riders'),
        fetch('/api/orders')
      ]);

      if (fleetRes.ok) {
        const fData = await fleetRes.json();
        setFleetMetrics(fData.metrics);
        setAwaitingOrders(fData.ordersAwaitingAssignment || []);
        setActiveAssignments(fData.activeDeliveryAssignments || []);
        setAuditLogs(fData.auditLogs || []);
        if (fData.riders && fData.riders.length > 0) {
          setFleetRiders(fData.riders);
        }
      }

      if (ridersRes.ok && (!fleetRes.ok || !fleetRiders.length)) {
        const rData = await ridersRes.json();
        setFleetRiders(rData.riders || []);
      }
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setFleetOrders(oData || []);
      }
    } catch {
      // Retry
    } finally {
      setIsLoadingFleet(false);
    }
  }, [fleetRiders.length]);

  const fetchRiderDetail = async (riderId: string) => {
    setIsLoadingRiderDetail(true);
    try {
      const res = await fetch(`/api/riders/${riderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedRiderDetail(data);
      } else {
        const err = await res.json();
        setStatusMessage({ text: err.error || 'Failed to fetch courier details', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Error connecting to courier fleet database', isError: true });
    } finally {
      setIsLoadingRiderDetail(false);
    }
  };

  const handleUpdateRiderStatus = async (riderId: string, newStatus: 'active' | 'suspended' | 'deactivated', isAvailable?: boolean) => {
    setIsUpdatingRiderStatus(true);
    try {
      const res = await fetch(`/api/riders/${riderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          isAvailable: isAvailable ?? (newStatus === 'active')
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: data.message || `Courier status updated to ${newStatus}.` });
        fetchFleet();
        if (selectedRiderDetail?.rider?.id === riderId) {
          fetchRiderDetail(riderId);
        }
      } else {
        setStatusMessage({ text: data.error || 'Failed to update courier status', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Failed to update courier status', isError: true });
    } finally {
      setIsUpdatingRiderStatus(false);
    }
  };

  const handleTriggerPasswordReset = async (riderId: string) => {
    if (!confirm('Send a secure password reset link to this courier\'s verified email?')) return;
    setIsTriggeringReset(true);
    try {
      const res = await fetch(`/api/riders/${riderId}/reset-password`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: data.message || 'Password reset link sent to courier email.' });
      } else {
        setStatusMessage({ text: data.error || 'Failed to trigger password reset', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Error sending password reset link', isError: true });
    } finally {
      setIsTriggeringReset(false);
    }
  };

  const handleConfirmDeleteRiderAccount = async () => {
    if (!deletingRiderAccount) return;
    if (!deleteRiderReason.trim() || deleteRiderReason.trim().length < 3) {
      setStatusMessage({ text: 'An audit reason (min 3 characters) is required to remove courier account', isError: true });
      return;
    }

    setIsDeletingRider(true);
    try {
      const res = await fetch(`/api/riders/${deletingRiderAccount.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: deleteRiderReason.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: data.message || `Courier account "${deletingRiderAccount.name}" successfully removed/archived.` });
        setDeletingRiderAccount(null);
        setDeleteRiderReason('');
        if (selectedRiderDetail?.rider?.id === deletingRiderAccount.id) {
          setSelectedRiderDetail(null);
        }
        fetchFleet();
      } else {
        setStatusMessage({ text: data.error || 'Failed to delete courier account', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Network error deleting courier account', isError: true });
    } finally {
      setIsDeletingRider(false);
    }
  };

  const handleInviteRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFullName.trim() || !inviteEmail.trim() || !invitePhone.trim()) {
      setStatusMessage({ text: 'Full name, email and phone number are required', isError: true });
      return;
    }

    setIsSubmittingInvite(true);
    try {
      const res = await fetch('/api/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: inviteFullName.trim(),
          email: inviteEmail.trim(),
          phone: invitePhone.trim(),
          vehicleType: inviteVehicleType,
          operationalZoneId: inviteZoneId || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: data.message || `Onboarding invitation dispatched to ${inviteEmail}.` });
        setIsInviteModalOpen(false);
        setInviteFullName('');
        setInviteEmail('');
        setInvitePhone('');
        fetchFleet();
      } else {
        setStatusMessage({ text: data.error || 'Failed to send onboarding invitation', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Error dispatching onboarding invitation', isError: true });
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Privileged Intervention Submission Handler
  const handleExecuteFleetAction = async () => {
    if (!actionReason.trim()) {
      setStatusMessage({ text: 'An operational audit reason must be provided for all administrative interventions.', isError: true });
      return;
    }

    setIsSubmittingAction(true);
    try {
      const res = await fetch('/api/admin/fleet/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionModal.action,
          targetId: actionModal.targetId,
          reason: actionReason.trim(),
          newRiderId: actionReplacementRiderId || undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: data.message || 'Administrative intervention executed and recorded in audit log.' });
        if (actionModal.action === 'investigate_failed_assignment') {
          setInvestigationData(data);
        } else {
          setActionModal({ isOpen: false, action: null, targetId: '', targetName: '', targetType: 'rider' });
          setActionReason('');
          setActionReplacementRiderId('');
        }
        fetchFleet();
      } else {
        setStatusMessage({ text: data.error || 'Failed to execute privileged fleet action', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Error communicating with fleet administration API', isError: true });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (staff) {
      fetchMenu();
      fetchZones();
      fetchFleet();

      // Establish Supabase Realtime Subscription for Fleet Updates
      const supabase = getSupabaseBrowserClient();
      let ordersChannel: any = null;
      let ridersChannel: any = null;

      if (supabase) {
        ordersChannel = supabase
          .channel('fleet-orders-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'orders' },
            () => {
              fetchFleet();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setRealtimeConnected(true);
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setRealtimeConnected(false);
            }
          });

        ridersChannel = supabase
          .channel('fleet-riders-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'riders' },
            () => {
              fetchFleet();
            }
          )
          .subscribe();
      }

      // Safe fallback polling interval (4s)
      const interval = setInterval(fetchFleet, 4000);
      return () => {
        clearInterval(interval);
        if (supabase) {
          if (ordersChannel) supabase.removeChannel(ordersChannel);
          if (ridersChannel) supabase.removeChannel(ridersChannel);
        }
      };
    }
  }, [staff, fetchMenu, fetchZones, fetchFleet]);

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
        if (['owner', 'admin', 'manager'].includes(data.staff.role)) {
          setStaff(data.staff);
        } else {
          setAuthError('Access Denied: Your account role does not possess owner administration rights.');
        }
      } else {
        setAuthError(data.error || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      setAuthError('Connection failed. Please verify network connectivity.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/staff/login', { method: 'DELETE' });
    setStaff(null);
  };

  const handleSaveMenuPrice = async (itemId: number) => {
    setIsSavingMenu(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: editedPrice })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: `Updated price for dish to ${formatNaira(editedPrice)}` });
        setEditingMenuId(null);
        fetchMenu();
      } else {
        setStatusMessage({ text: data.error || 'Failed to update dish price', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Network failure updating price', isError: true });
    } finally {
      setIsSavingMenu(false);
    }
  };

  const handleSaveZone = async (zoneId: string) => {
    setIsSavingZone(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/settings/delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoneId,
          deliveryFee: editedFee,
          minOrderAmount: editedMinOrder,
          estimatedTime: editedTime,
          isActive: editedActive
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: `Delivery settings updated for zone successfully` });
        setEditingZoneId(null);
        fetchZones();
      } else {
        setStatusMessage({ text: data.error || 'Failed to update zone settings', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Network error updating zone settings', isError: true });
    } finally {
      setIsSavingZone(false);
    }
  };

  // While verifying server session on mount, render authentication-loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-gold/20 border border-brand-gold flex items-center justify-center text-brand-gold animate-spin mb-4">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Verifying Owner Authentication...</p>
      </div>
    );
  }

  // 1. Unauthenticated Login Screen
  if (!staff) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-brand-gold flex items-center justify-center mx-auto text-zinc-950 font-black shadow-lg">
              <Store className="w-6 h-6" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">Owner & Executive Portal</h2>
            <p className="text-xs text-zinc-400">Manage authoritative dish pricing & delivery fees</p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Owner Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="owner@jaysfoodcourt.ng"
                className="w-full py-2.5 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:border-brand-gold outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2.5 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:border-brand-gold outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 rounded-xl bg-brand-gold hover:bg-brand-goldDark text-zinc-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoggingIn ? 'Authenticating...' : 'Sign In as Owner'}</span>
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition">
              ← Return to Main Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Authenticated Owner Management Dashboard
  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-gold flex items-center justify-center text-zinc-950 font-black">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-white">Jay&apos;s Owner Portal</h1>
              <p className="text-[11px] text-zinc-400">
                {staff.fullName} • <span className="text-amber-400 capitalize">{staff.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/kitchen"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition"
            >
              Kitchen Screen
            </Link>
            <Link
              href="/rider"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition"
            >
              Rider Dispatch
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        
        {/* Banner Notice */}
        {statusMessage && (
          <div
            className={`p-3 sm:p-4 rounded-2xl border text-xs sm:text-sm flex items-center gap-2 animate-in fade-in duration-200 ${
              statusMessage.isError
                ? 'bg-red-950/80 border-red-800 text-red-300'
                : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
            }`}
          >
            {statusMessage.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 gap-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('pricing')}
            className={`pb-3 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition shrink-0 ${
              activeTab === 'pricing'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Food Pricing & Menu</span>
          </button>
          <button
            onClick={() => setActiveTab('customizations')}
            className={`pb-3 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition shrink-0 ${
              activeTab === 'customizations'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Customization Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('zones')}
            className={`pb-3 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition shrink-0 ${
              activeTab === 'zones'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Delivery Zones</span>
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`pb-3 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition shrink-0 ${
              activeTab === 'fleet'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Courier Fleet ({fleetRiders.filter(r => r.is_active).length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition shrink-0 ${
              activeTab === 'history'
                ? 'border-brand-gold text-brand-gold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Order History</span>
          </button>
        </div>

        {/* TAB 1: MEAL MANAGEMENT (FULL CRUD) */}
        {activeTab === 'pricing' && (
          <MealManager
            menuItems={menuItems}
            onRefresh={fetchMenu}
            staffRole={staff.role}
            staffName={staff.fullName}
          />
        )}

        {/* TAB 2: REUSABLE CUSTOMIZATION ENGINE */}
        {activeTab === 'customizations' && (
          <CustomizationManager
            menuItems={menuItems}
            onRefresh={fetchMenu}
          />
        )}

        {/* TAB 2: ENUGU DELIVERY ZONE CONTROLS */}
        {activeTab === 'zones' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Enugu Delivery Zones & Fees</h3>
                <p className="text-xs text-zinc-400">
                  Configure delivery tariffs and minimum checkout thresholds across Enugu State territory.
                </p>
              </div>
              <button
                onClick={fetchZones}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                title="Refresh Zones"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        {zone.city}
                      </span>
                      <h4 className="font-bold text-sm text-white">{zone.name}</h4>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      {zone.estimatedTime}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-1">
                    <p className="line-clamp-1">
                      Landmarks: <span className="text-zinc-300">{zone.popularLandmarks?.slice(0, 3).join(', ')}</span>
                    </p>
                  </div>

                  <div className="pt-2 border-t border-zinc-800">
                    {editingZoneId === zone.id ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">Fee (₦)</label>
                            <input
                              type="number"
                              value={editedFee}
                              onChange={(e) => setEditedFee(Number(e.target.value))}
                              className="w-full py-1.5 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-bold text-brand-gold outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">Min Order (₦)</label>
                            <input
                              type="number"
                              value={editedMinOrder}
                              onChange={(e) => setEditedMinOrder(Number(e.target.value))}
                              className="w-full py-1.5 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-bold text-white outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">ETA Range</label>
                            <input
                              type="text"
                              value={editedTime}
                              onChange={(e) => setEditedTime(e.target.value)}
                              placeholder="e.g. 25 - 40 Mins"
                              className="w-full py-1.5 px-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-bold text-zinc-200 outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-4">
                            <label className="text-[10px] text-zinc-300 font-bold flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editedActive}
                                onChange={(e) => setEditedActive(e.target.checked)}
                                className="rounded text-brand-gold"
                              />
                              <span>Zone Active</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveZone(zone.id)}
                            disabled={isSavingZone}
                            className="flex-1 py-1.5 rounded-lg bg-brand-gold text-zinc-950 font-bold text-xs flex items-center justify-center gap-1 shadow-sm"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save Settings</span>
                          </button>
                          <button
                            onClick={() => setEditingZoneId(null)}
                            className="py-1.5 px-3 rounded-lg bg-zinc-800 text-zinc-400 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-zinc-500 block uppercase">Delivery Fee</span>
                          <span className="text-sm font-black text-brand-gold">{formatNaira(zone.deliveryFee)}</span>
                          <span className="text-[10px] text-zinc-500 block">Min: {formatNaira(zone.minOrderAmount)}</span>
                          {zone.updatedAt && (
                            <span className="text-[9px] text-zinc-500 block truncate mt-0.5" title={zone.lastModifiedBy}>
                              Mod: {new Date(zone.updatedAt).toLocaleDateString()} {zone.lastModifiedBy ? `by ${zone.lastModifiedBy}` : ''}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setEditingZoneId(zone.id);
                            setEditedFee(zone.deliveryFee);
                            setEditedMinOrder(zone.minOrderAmount);
                            setEditedTime(zone.estimatedTime);
                            setEditedActive(zone.isActive !== false);
                          }}
                          className="py-1.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 flex items-center gap-1.5 transition"
                        >
                          <Edit2 className="w-3 h-3 text-brand-gold" />
                          <span>Configure</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: FLEET & DISPATCH MONITORING */}
        {activeTab === 'fleet' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Courier Fleet Management Center</h3>
                <p className="text-xs text-zinc-400">
                  Manage individual courier accounts, send secure onboarding invitations, assign delivery zones, and monitor live deliveries.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center gap-1.5 text-xs font-bold transition shadow-md shadow-amber-500/20"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Invite New Courier</span>
                </button>
                <button
                  onClick={fetchFleet}
                  disabled={isLoadingFleet}
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1.5 text-xs font-bold"
                  title="Refresh Fleet"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingFleet ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* 8 Core KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">1. Total Active Riders</span>
                <p className="text-2xl font-black text-white">{fleetMetrics?.totalActiveRiders ?? fleetRiders.filter((r) => r.is_active).length}</p>
                <span className="text-[10px] text-zinc-500">Enrolled active fleet</span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">2. Currently Online</span>
                <p className="text-2xl font-black text-emerald-400">
                  {fleetMetrics?.ridersOnline ?? fleetRiders.filter((r) => r.is_active && r.is_available).length}
                </p>
                <span className="text-[10px] text-emerald-500/80">Logged in & opted online</span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">3. Currently Available</span>
                <p className="text-2xl font-black text-teal-400">
                  {fleetMetrics?.ridersAvailable ?? fleetRiders.filter((r) => r.is_active && r.is_available && !r.isDelivering).length}
                </p>
                <span className="text-[10px] text-teal-500/80">Ready to accept offers</span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">4. Currently Delivering</span>
                <p className="text-2xl font-black text-amber-400">
                  {fleetMetrics?.ridersDelivering ?? fleetRiders.filter((r) => r.isDelivering).length}
                </p>
                <span className="text-[10px] text-amber-500/80">Active trip in transit</span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">5. Temporarily Unavailable</span>
                <p className="text-2xl font-black text-indigo-400">
                  {fleetMetrics?.ridersTemporarilyUnavailable ?? fleetRiders.filter((r) => r.is_active && !r.is_available).length}
                </p>
                <span className="text-[10px] text-indigo-500/80">On break / paused</span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">6. Awaiting Assignment</span>
                <p className="text-2xl font-black text-orange-400">
                  {fleetMetrics?.ordersAwaitingAssignmentCount ?? awaitingOrders.length}
                </p>
                <span className="text-[10px] text-orange-500/80">In dispatch queue</span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">7. Active Assignments</span>
                <p className="text-2xl font-black text-cyan-400">
                  {fleetMetrics?.activeDeliveryAssignmentsCount ?? activeAssignments.length}
                </p>
                <span className="text-[10px] text-cyan-500/80">Assigned missions</span>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">8. Expired / Rejected Offers</span>
                <p className="text-2xl font-black text-rose-400">
                  {(fleetMetrics?.expiredOffersCount ?? 0) + (fleetMetrics?.rejectedOffersCount ?? 0)}
                </p>
                <span className="text-[10px] text-rose-500/80">
                  {fleetMetrics?.expiredOffersCount ?? 0} expired • {fleetMetrics?.rejectedOffersCount ?? 0} rejected
                </span>
              </div>
            </div>

            {/* Realtime Status Indicator Bar */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs">
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${realtimeConnected ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'}`} />
                <span className="text-zinc-300 font-semibold">
                  Live Dispatch Sync: {realtimeConnected ? 'Connected (Supabase Realtime)' : 'Active (Polling Fallback)'}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500">
                Audited & Sanitized Data
              </span>
            </div>

            {/* AWAITING ORDERS & DISPATCH QUEUE INTERVENTION SECTION */}
            {awaitingOrders.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Orders Awaiting Rider Assignment ({awaitingOrders.length})
                    </h4>
                  </div>
                  <span className="text-[11px] text-amber-400/80">Ready for pickup • Pending courier claim</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {awaitingOrders.map((ord) => (
                    <div key={ord.id} className="p-3 rounded-xl bg-zinc-900/90 border border-amber-800/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">#{ord.orderCode || ord.id.slice(0, 8)}</span>
                        <span className="text-xs font-black text-brand-gold">{formatNaira(ord.totalAmount)}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{ord.deliveryAddress}</p>
                      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-amber-400 font-semibold">In shared pool</span>
                        <button
                          onClick={() => setActionModal({
                            isOpen: true,
                            action: 'reassign_order',
                            targetId: ord.id,
                            targetName: `#${ord.orderCode || ord.id.slice(0, 8)}`,
                            targetType: 'order',
                            orderData: ord
                          })}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[10px] font-bold transition"
                        >
                          Assign Directly
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Couriers Live Monitoring Table & Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Rider Fleet Live Monitoring & Dispatch Control
                </h4>
                <span className="text-[11px] text-zinc-500 font-medium">
                  {fleetRiders.length} registered courier records
                </span>
              </div>

              {fleetRiders.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-3">
                  <Bike className="w-10 h-10 text-zinc-600 mx-auto" />
                  <p className="text-sm font-bold text-zinc-400">No couriers currently enrolled in your fleet.</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Click &quot;Invite New Courier&quot; above to dispatch a secure onboarding link to a genuine rider.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950/80 text-[10px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="py-3 px-3.5">Courier Name</th>
                        <th className="py-3 px-3">Account Status</th>
                        <th className="py-3 px-3">Online State</th>
                        <th className="py-3 px-3">Availability</th>
                        <th className="py-3 px-3">Active Order</th>
                        <th className="py-3 px-3">Assigned Zone</th>
                        <th className="py-3 px-3">Live GPS</th>
                        <th className="py-3 px-3 text-center">Completed</th>
                        <th className="py-3 px-3.5 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-medium text-zinc-300">
                      {fleetRiders.map((rider) => {
                        const assignedOrder = rider.currentDelivery || fleetOrders.find(
                          (o) => o.assigned_rider_id === rider.id && ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status)
                        );
                        const isSuspended = rider.accountStatus === 'suspended' || rider.status === 'suspended' || (!rider.is_active && rider.status !== 'deactivated');
                        const isDeactivated = rider.accountStatus === 'deactivated' || rider.status === 'deactivated';
                        const isActive = rider.is_active && !isSuspended && !isDeactivated;
                        const isOnline = Boolean(rider.isOnline ?? (rider.is_active && rider.is_available));
                        const isAvailable = Boolean(rider.isAvailable ?? rider.is_available);

                        return (
                          <tr key={rider.id} className="hover:bg-zinc-800/40 transition">
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  isActive
                                    ? isAvailable
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                                    : 'bg-zinc-800 text-zinc-500'
                                }`}>
                                  <Bike className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <p className="font-bold text-white text-xs">{rider.fullName || rider.full_name}</p>
                                  <p className="text-[10px] text-zinc-500">
                                    {rider.phone || 'No phone'} • {rider.vehicleType || rider.vehicle_type || 'Motorcycle'}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                isActive
                                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                                  : isSuspended
                                  ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                              }`}>
                                {isActive ? 'Active' : (isSuspended ? 'Suspended' : 'Deactivated')}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-zinc-600'}`} />
                                <span className={`text-[11px] font-semibold ${isOnline ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                  {isOnline ? 'Online' : 'Offline'}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              {isAvailable ? (
                                <span className="text-[11px] font-bold text-teal-400 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-teal-400" />
                                  Available
                                </span>
                              ) : (
                                <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                                  <Coffee className="w-3 h-3 text-zinc-500" />
                                  Unavailable
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {assignedOrder ? (
                                <button
                                  onClick={() => setActionModal({
                                    isOpen: true,
                                    action: 'investigate_failed_assignment',
                                    targetId: assignedOrder.orderId || assignedOrder.id,
                                    targetName: `#${assignedOrder.orderCode || assignedOrder.order_code || (assignedOrder.id && assignedOrder.id.slice(0, 8))}`,
                                    targetType: 'order',
                                    orderData: assignedOrder
                                  })}
                                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 underline underline-offset-2"
                                  title="Inspect Active Delivery Assignment"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                  #{assignedOrder.orderCode || assignedOrder.order_code || (assignedOrder.id && assignedOrder.id.slice(0, 8))}
                                </button>
                              ) : (
                                <span className="text-[11px] text-zinc-600 italic">None</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-[11px] text-zinc-400">
                              {rider.assignedServiceZone || 'Enugu Corridor'}
                            </td>

                            <td className="py-3 px-3 text-[11px]">
                              <span className="text-zinc-600">Standard PWA</span>
                            </td>

                            <td className="py-3 px-3 text-center text-xs font-black text-white">
                              {rider.completedDeliveriesCount ?? 0}
                            </td>

                            <td className="py-3 px-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => fetchRiderDetail(rider.id)}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition"
                                  title="View Courier Profile & Lifetime History"
                                >
                                  Profile
                                </button>

                                <button
                                  onClick={() => handleTriggerPasswordReset(rider.id)}
                                  disabled={isTriggeringReset}
                                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition"
                                  title="Send Password Reset Link"
                                >
                                  Reset
                                </button>

                                <button
                                  onClick={() => setDeletingRiderAccount({
                                    id: rider.id,
                                    name: rider.fullName || rider.full_name || 'Courier'
                                  })}
                                  className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 border border-rose-900/50 text-rose-400 text-[10px] font-bold transition"
                                  title="Delete / Archive Courier Account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                {isActive ? (
                                  <>
                                    <button
                                      onClick={() => setActionModal({
                                        isOpen: true,
                                        action: 'suspend_rider',
                                        targetId: rider.id,
                                        targetName: rider.fullName || rider.full_name,
                                        targetType: 'rider'
                                      })}
                                      className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-bold uppercase tracking-wider transition"
                                      title="Suspend Courier"
                                    >
                                      Suspend
                                    </button>

                                    {isAvailable && (
                                      <button
                                        onClick={() => setActionModal({
                                          isOpen: true,
                                          action: 'mark_unavailable',
                                          targetId: rider.id,
                                          targetName: rider.fullName || rider.full_name,
                                          targetType: 'rider'
                                        })}
                                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[10px] font-bold transition"
                                        title="Mark Courier Temporarily Unavailable"
                                      >
                                        Pause
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    onClick={() => setActionModal({
                                      isOpen: true,
                                      action: 'reactivate_rider',
                                      targetId: rider.id,
                                      targetName: rider.fullName || rider.full_name,
                                      targetType: 'rider'
                                    })}
                                    className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[10px] font-bold uppercase tracking-wider transition"
                                    title="Reactivate Courier"
                                  >
                                    Reactivate
                                  </button>
                                )}

                                {assignedOrder && (
                                  <button
                                    onClick={() => setActionModal({
                                      isOpen: true,
                                      action: 'reassign_order',
                                      targetId: assignedOrder.orderId || assignedOrder.id,
                                      targetName: `#${assignedOrder.orderCode || assignedOrder.order_code || (assignedOrder.id && assignedOrder.id.slice(0, 8))}`,
                                      targetType: 'order',
                                      orderData: assignedOrder
                                    })}
                                    className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold transition"
                                    title="Authorized Reassignment"
                                  >
                                    Reassign
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AUDIT LOG SECTION */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-gold" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Administrative Fleet Intervention Audit Trail
                  </h4>
                </div>
                <span className="text-[11px] text-zinc-500">
                  Immutable records with actor identity, timestamp & reason
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-500 text-center italic">
                  No privileged fleet interventions logged yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white uppercase text-[10px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                            {log.action.replace('_', ' ')}
                          </span>
                          <span className="text-zinc-400">by <span className="text-zinc-200 font-semibold">{log.actorEmail || log.actorRole}</span></span>
                          <span className="text-[10px] text-zinc-500">{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-zinc-300 font-medium text-[11px]">
                          Reason: &quot;{log.reason}&quot;
                        </p>
                      </div>
                      {log.metadata && (
                        <div className="text-[10px] text-zinc-500 sm:text-right">
                          {log.metadata.orderCode ? `Order: ${log.metadata.orderCode}` : ''}
                          {log.metadata.newRiderName ? ` ➔ ${log.metadata.newRiderName}` : ''}
                          {log.metadata.releasedToPool ? ' ➔ Released to shared pool' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MODAL 1: INVITE COURIER */}
            {isInviteModalOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Bike className="w-5 h-5 text-amber-500" />
                      </div>
                      <h4 className="text-base font-bold text-white">Invite Courier to Fleet</h4>
                    </div>
                    <button
                      onClick={() => setIsInviteModalOpen(false)}
                      className="text-zinc-500 hover:text-white text-xs font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleInviteRider} className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                        Full Legal Name
                      </label>
                      <input
                        type="text"
                        required
                        value={inviteFullName}
                        onChange={(e) => setInviteFullName(e.target.value)}
                        placeholder="e.g. Chukwuemeka Okoye"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                        Courier Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="courier@example.com"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                      />
                      <p className="text-[10px] text-zinc-500 mt-1">
                        A single-use 48-hour onboarding invitation link will be delivered via Resend.
                      </p>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        required
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(e.target.value)}
                        placeholder="08012345678"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                          Vehicle Type
                        </label>
                        <select
                          value={inviteVehicleType}
                          onChange={(e) => setInviteVehicleType(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                        >
                          <option value="Motorcycle">Motorcycle</option>
                          <option value="Bicycle">Bicycle</option>
                          <option value="Scooter">Scooter</option>
                          <option value="Car">Car</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                          Assigned Zone
                        </label>
                        <select
                          value={inviteZoneId}
                          onChange={(e) => setInviteZoneId(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                        >
                          <option value="">All Enugu Zones</option>
                          {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsInviteModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingInvite}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                      >
                        {isSubmittingInvite ? 'Dispatching Invite...' : 'Send Invitation'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL 2: COURIER PROFILE & DELIVERY HISTORY */}
            {selectedRiderDetail && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Bike className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white">{selectedRiderDetail.rider?.fullName}</h4>
                        <p className="text-xs text-zinc-400">
                          {selectedRiderDetail.rider?.email} • {selectedRiderDetail.rider?.phone}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedRiderDetail(null)}
                      className="text-zinc-500 hover:text-white text-sm font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Total Assigned</span>
                      <span className="text-xl font-black text-white">{selectedRiderDetail.metrics?.totalAssigned || 0}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">Delivered</span>
                      <span className="text-xl font-black text-emerald-400">{selectedRiderDetail.metrics?.completedCount || 0}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">Cancelled</span>
                      <span className="text-xl font-black text-rose-400">{selectedRiderDetail.metrics?.cancelledCount || 0}</span>
                    </div>
                  </div>

                  {/* Active Delivery Card */}
                  {selectedRiderDetail.activeDelivery ? (
                    <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                          Currently Active On Delivery
                        </span>
                        <span className="text-xs font-bold text-white">
                          Order #{selectedRiderDetail.activeDelivery.order_code || selectedRiderDetail.activeDelivery.id.slice(0, 8)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">
                        Destination: {selectedRiderDetail.activeDelivery.delivery_address}
                      </p>
                      <div className="text-[11px] text-amber-300/80 flex items-center justify-between pt-1">
                        <span>Status: {selectedRiderDetail.activeDelivery.status}</span>
                        <span>Amount: {formatNaira(selectedRiderDetail.activeDelivery.total_amount)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-400 flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>This courier is not currently occupied with an active delivery.</span>
                    </div>
                  )}

                  {/* Account Operational Status Controls */}
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Account Status & Access Management
                    </h5>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleUpdateRiderStatus(selectedRiderDetail.rider.id, 'active', true)}
                        disabled={isUpdatingRiderStatus || selectedRiderDetail.rider.status === 'active'}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          selectedRiderDetail.rider.status === 'active'
                            ? 'bg-emerald-600 text-white cursor-default'
                            : 'bg-zinc-800 hover:bg-emerald-950 hover:text-emerald-300 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        Active
                      </button>

                      <button
                        onClick={() => handleUpdateRiderStatus(selectedRiderDetail.rider.id, 'suspended', false)}
                        disabled={isUpdatingRiderStatus || selectedRiderDetail.rider.status === 'suspended'}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          selectedRiderDetail.rider.status === 'suspended'
                            ? 'bg-rose-600 text-white cursor-default'
                            : 'bg-zinc-800 hover:bg-rose-950 hover:text-rose-300 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        Suspend Access
                      </button>

                      <button
                        onClick={() => handleUpdateRiderStatus(selectedRiderDetail.rider.id, 'deactivated', false)}
                        disabled={isUpdatingRiderStatus || selectedRiderDetail.rider.status === 'deactivated'}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          selectedRiderDetail.rider.status === 'deactivated'
                            ? 'bg-zinc-600 text-white cursor-default'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        Deactivate Account
                      </button>

                      <button
                        onClick={() => handleTriggerPasswordReset(selectedRiderDetail.rider.id)}
                        disabled={isTriggeringReset}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition"
                      >
                        Dispatch Password Reset
                      </button>

                      <button
                        onClick={() => {
                          const r = selectedRiderDetail.rider;
                          setDeletingRiderAccount({
                            id: r.id,
                            name: r.fullName || r.full_name || 'Courier'
                          });
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900 border border-rose-900/60 text-rose-300 text-xs font-bold transition ml-auto flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Delete Account</span>
                      </button>
                    </div>
                  </div>

                  {/* Historical Delivery Logs */}
                  <div className="space-y-2.5">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Completed & Past Deliveries ({selectedRiderDetail.history?.length || 0})
                    </h5>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {(!selectedRiderDetail.history || selectedRiderDetail.history.length === 0) ? (
                        <p className="text-xs text-zinc-500 italic">No delivery history recorded yet for this courier.</p>
                      ) : (
                        selectedRiderDetail.history.map((h: any) => (
                          <div
                            key={h.id}
                            className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-white">Order #{h.order_code || h.id.slice(0, 8)}</span>
                              <p className="text-[11px] text-zinc-500 line-clamp-1">{h.delivery_address || 'Enugu delivery'}</p>
                            </div>
                            <div className="text-right">
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                h.status === 'delivered'
                                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                              }`}>
                                {h.status}
                              </span>
                              <span className="block text-[11px] font-bold text-zinc-400 mt-0.5">
                                {formatNaira(h.total_amount)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* MODAL 3: PRIVILEGED FLEET ACTION INTERVENTION (SUSPEND, REASSIGN, INVESTIGATE, PAUSE) */}
            {actionModal.isOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white capitalize">
                          {actionModal.action?.replace('_', ' ')}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          Target: <span className="text-zinc-200 font-semibold">{actionModal.targetName}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setActionModal({ isOpen: false, action: null, targetId: '', targetName: '', targetType: 'rider' });
                        setInvestigationData(null);
                        setActionReason('');
                        setActionReplacementRiderId('');
                      }}
                      className="text-zinc-500 hover:text-white text-sm font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Investigation Results View */}
                  {investigationData ? (
                    <div className="space-y-4">
                      <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">Order #{investigationData.order?.order_code}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800 text-amber-400 font-bold uppercase text-[9px]">
                            {investigationData.order?.status}
                          </span>
                        </div>
                        <p className="text-zinc-400">
                          Current Assigned Courier: {investigationData.order?.assigned_rider_id || 'None (Unassigned)'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          State Transition Audit Trail ({investigationData.statusHistory?.length || 0})
                        </h5>
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                          {investigationData.statusHistory?.length === 0 ? (
                            <p className="text-xs text-zinc-500 italic">No transition history logged for this order.</p>
                          ) : (
                            investigationData.statusHistory.map((h: any) => (
                              <div key={h.id} className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-brand-gold">
                                    {h.from_status} ➔ {h.to_status}
                                  </span>
                                  <span className="text-[10px] text-zinc-500">{new Date(h.created_at).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-[10px] text-zinc-400">
                                  Actor: {h.actor_type} ({h.actor_id?.slice(0, 8) || 'system'})
                                </p>
                                {h.notes && (
                                  <p className="text-[10px] text-zinc-300 italic bg-zinc-900/60 p-1.5 rounded">
                                    &quot;{h.notes}&quot;
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => {
                            setActionModal({ isOpen: false, action: null, targetId: '', targetName: '', targetType: 'rider' });
                            setInvestigationData(null);
                          }}
                          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200"
                        >
                          Close Investigation
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Reassignment Target Selector */}
                      {actionModal.action === 'reassign_order' && (
                        <div>
                          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">
                            Select Replacement Courier
                          </label>
                          <select
                            value={actionReplacementRiderId}
                            onChange={(e) => setActionReplacementRiderId(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                          >
                            <option value="">Release back to Shared Dispatch Pool (Recommended)</option>
                            {fleetRiders.filter((r) => r.is_active && !r.isDelivering).map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.fullName || r.full_name} ({r.isAvailable ? 'Available' : 'Paused'})
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            Releasing to the shared dispatch pool allows any eligible active courier to accept the mission.
                          </p>
                        </div>
                      )}

                      {/* Mandatory Operational Reason Field */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                          Operational Justification / Reason *
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                          placeholder="State the operational reason for this administrative intervention (recorded in immutable audit logs)..."
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 font-medium resize-none"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActionModal({ isOpen: false, action: null, targetId: '', targetName: '', targetType: 'rider' });
                            setActionReason('');
                            setActionReplacementRiderId('');
                          }}
                          className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleExecuteFleetAction}
                          disabled={isSubmittingAction || !actionReason.trim()}
                          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-bold transition shadow-md shadow-amber-500/20"
                        >
                          {isSubmittingAction ? 'Executing Intervention...' : 'Confirm & Log Intervention'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MODAL 4: DELETE / ARCHIVE COURIER ACCOUNT */}
            {deletingRiderAccount && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 text-center shadow-2xl animate-in zoom-in-95 duration-150">
                  <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
                    <Trash2 className="w-6 h-6" />
                  </div>

                  <div>
                    <h4 className="text-base font-black text-white">Delete / Archive Courier Account</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Courier: <strong className="text-white">{deletingRiderAccount.name}</strong>
                    </p>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 text-left mt-3 leading-relaxed">
                      <span className="font-bold text-amber-400 block mb-0.5">Active Delivery & Audit Safety:</span>
                      Couriers with active deliveries cannot be removed until reassigned or completed. Past delivery transactions and payment audit logs are permanently preserved.
                    </div>
                  </div>

                  <div className="text-left space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Audit Reason for Account Deletion *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Courier resignation / contract terminated..."
                      value={deleteRiderReason}
                      onChange={(e) => setDeleteRiderReason(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-rose-500 transition"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingRiderAccount(null);
                        setDeleteRiderReason('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingRider || !deleteRiderReason.trim()}
                      onClick={handleConfirmDeleteRiderAccount}
                      className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20"
                    >
                      {isDeletingRider ? 'Processing...' : 'Confirm Account Deletion'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ORDER HISTORY & TRANSACTION LEDGER */}
        {activeTab === 'history' && (
          <OrderHistoryManager />
        )}

      </main>
    </div>
  );
}
