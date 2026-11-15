'use client';

import React, { useState } from 'react';
import {
  UserPlus,
  Search,
  Filter,
  Bike,
  ShieldAlert,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Clock,
  X,
  Radio,
  ExternalLink
} from 'lucide-react';
import { EnuguLocationZone } from '@/lib/enugu-geocoding';

interface RiderManagerProps {
  riders: any[];
  zones: EnuguLocationZone[];
  onRefresh: () => void;
  onOpenInvite: () => void;
  onOpenRiderDetail: (id: string) => void;
  onTriggerPasswordReset: (id: string) => void;
  staffRole?: string;
  staffName?: string;
}

export function RiderManager({
  riders,
  zones,
  onRefresh,
  onOpenInvite,
  onOpenRiderDetail,
  onTriggerPasswordReset,
  staffRole,
  staffName
}: RiderManagerProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'available'>('all');

  // Edit Courier Modal State
  const [editingRider, setEditingRider] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('Motorcycle');
  const [editRegistration, setEditRegistration] = useState('');
  const [editZoneId, setEditZoneId] = useState('');

  // Delete/Archive Courier Modal State
  const [deletingRider, setDeletingRider] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Suspend/Reactivate Modal State
  const [statusActionRider, setStatusActionRider] = useState<{
    rider: any;
    action: 'suspend' | 'reactivate' | 'mark_unavailable';
  } | null>(null);
  const [statusReason, setStatusReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const showFeedback = (text: string, isError = false) => {
    setFeedback({ text, isError });
    setTimeout(() => setFeedback(null), 4000);
  };

  const filteredRiders = riders.filter((r) => {
    const fullName = (r.fullName || r.full_name || '').toLowerCase();
    const phone = (r.phone || '').toLowerCase();
    const email = (r.email || '').toLowerCase();
    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      phone.includes(search.toLowerCase()) ||
      email.includes(search.toLowerCase());

    const isActive = r.is_active ?? true;
    const isAvailable = r.is_available ?? false;

    if (statusFilter === 'active') return matchesSearch && isActive;
    if (statusFilter === 'suspended') return matchesSearch && !isActive;
    if (statusFilter === 'available') return matchesSearch && isActive && isAvailable;

    return matchesSearch;
  });

  const handleOpenEdit = (rider: any) => {
    setEditingRider(rider);
    setEditName(rider.fullName || rider.full_name || '');
    setEditPhone(rider.phone || '');
    setEditVehicleType(rider.vehicleType || rider.vehicle_type || 'Motorcycle');
    setEditRegistration(rider.vehicleRegistration || rider.vehicle_registration || '');
    setEditZoneId(rider.operationalZoneId || rider.operational_zone_id || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRider) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/riders/${editingRider.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editName.trim(),
          phone: editPhone.trim(),
          vehicleType: editVehicleType.trim(),
          vehicleRegistration: editRegistration.trim() || null,
          operationalZoneId: editZoneId || null
        })
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || 'Courier profile updated successfully!');
        setEditingRider(null);
        onRefresh();
      } else {
        showFeedback(data.error || 'Failed to update courier', true);
      }
    } catch {
      showFeedback('Network error while updating courier', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteStatusAction = async () => {
    if (!statusActionRider) return;
    if (!statusReason.trim() || statusReason.trim().length < 3) {
      showFeedback('A justification reason (min 3 characters) is required', true);
      return;
    }

    setIsSubmitting(true);
    try {
      const actionType =
        statusActionRider.action === 'suspend'
          ? 'suspend_rider'
          : statusActionRider.action === 'reactivate'
          ? 'reactivate_rider'
          : 'mark_unavailable';

      const res = await fetch('/api/admin/fleet/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          targetId: statusActionRider.rider.id,
          reason: statusReason.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || 'Courier status updated successfully');
        setStatusActionRider(null);
        setStatusReason('');
        onRefresh();
      } else {
        showFeedback(data.error || 'Failed to update courier status', true);
      }
    } catch {
      showFeedback('Network error while performing status action', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingRider) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/riders/${deletingRider.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: deleteReason.trim() || 'Courier account deactivation'
        })
      });

      const data = await res.json();
      if (res.ok) {
        showFeedback(data.message || 'Courier removed/archived successfully!');
        setDeletingRider(null);
        setDeleteReason('');
        onRefresh();
      } else {
        showFeedback(data.error || 'Failed to remove courier', true);
      }
    } catch {
      showFeedback('Network error while removing courier', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg transition animate-in fade-in slide-in-from-top-2 ${
            feedback.isError
              ? 'bg-rose-950/90 text-rose-200 border border-rose-800'
              : 'bg-emerald-950/90 text-emerald-200 border border-emerald-800'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bike className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-black text-white tracking-tight">Courier Fleet Management Center</h3>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Full administrative lifecycle: invite couriers, edit vehicles and delivery zones, manage status, and reset credentials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenInvite}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center gap-2 text-xs font-bold transition shadow-lg shadow-amber-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite New Courier</span>
          </button>

          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition"
            title="Refresh Fleet"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search couriers by name, phone number, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-amber-500 transition"
          >
            <option value="all">All Couriers ({riders.length})</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended / Inactive</option>
            <option value="available">Online & Available</option>
          </select>
        </div>
      </div>

      {/* Couriers Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                <th className="py-3.5 px-4">Courier</th>
                <th className="py-3.5 px-3">Contact</th>
                <th className="py-3.5 px-3">Vehicle</th>
                <th className="py-3.5 px-3">Assigned Zone</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredRiders.map((rider) => {
                const isActive = rider.is_active ?? true;
                const isAvailable = rider.is_available ?? false;
                const assignedOrder = rider.activeOrder;
                const zone = zones.find(z => z.id === rider.operational_zone_id || z.id === rider.operationalZoneId);

                return (
                  <tr key={rider.id} className="hover:bg-zinc-800/30 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                          {(rider.fullName || rider.full_name || 'C').charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-white block">
                            {rider.fullName || rider.full_name || 'Courier'}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            Rating: {Number(rider.rating || 5.0).toFixed(1)} ★
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="space-y-0.5">
                        <div className="text-xs text-zinc-300 font-mono">{rider.phone || 'No phone'}</div>
                        <div className="text-[10px] text-zinc-500">{rider.email || 'No email'}</div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="text-xs font-semibold text-zinc-300 block">
                        {rider.vehicleType || rider.vehicle_type || 'Motorcycle'}
                      </span>
                      {(rider.vehicleRegistration || rider.vehicle_registration) && (
                        <span className="text-[10px] text-amber-400/80 font-mono">
                          {rider.vehicleRegistration || rider.vehicle_registration}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="text-xs text-zinc-300">
                        {zone ? zone.name : 'All Enugu Zones'}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                              : 'bg-rose-950/80 text-rose-400 border-rose-800'
                          }`}
                        >
                          {isActive ? 'Active' : 'Suspended'}
                        </span>
                        {isActive && (
                          <span className="text-[9px] text-zinc-400">
                            {isAvailable ? '● Online' : '○ Offline'}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenRiderDetail(rider.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition"
                          title="View Complete Delivery History"
                        >
                          Profile
                        </button>

                        <button
                          onClick={() => handleOpenEdit(rider)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[10px] font-bold transition flex items-center gap-1"
                          title="Edit Courier & Vehicle Details"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => onTriggerPasswordReset(rider.id)}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition"
                          title="Send Password Reset Link"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                        </button>

                        {isActive ? (
                          <button
                            onClick={() =>
                              setStatusActionRider({
                                rider,
                                action: 'suspend'
                              })
                            }
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[10px] font-bold uppercase tracking-wider transition"
                            title="Suspend Courier Account"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              setStatusActionRider({
                                rider,
                                action: 'reactivate'
                              })
                            }
                            className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[10px] font-bold uppercase tracking-wider transition"
                            title="Reactivate Courier Account"
                          >
                            Reactivate
                          </button>
                        )}

                        <button
                          onClick={() => setDeletingRider(rider)}
                          className="p-1.5 rounded-lg bg-rose-950/20 hover:bg-rose-900/60 border border-rose-900/40 text-rose-400 transition"
                          title="Safely Archive / Deactivate Courier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredRiders.length === 0 && (
          <div className="p-8 text-center text-xs text-zinc-400">
            No couriers found matching your search.
          </div>
        )}
      </div>

      {/* EDIT COURIER MODAL */}
      {editingRider && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h4 className="text-base font-black text-white">Edit Courier Profile</h4>
                <p className="text-xs text-zinc-400">Update vehicle details and assigned operational zone.</p>
              </div>
              <button
                onClick={() => setEditingRider(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-zinc-800/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Legal Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Phone Number (Nigeria) *
                </label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={editVehicleType}
                    onChange={(e) => setEditVehicleType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                  >
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Bicycle">Bicycle</option>
                    <option value="E-Bike">E-Bike</option>
                    <option value="Car">Car</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Registration Plate
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ENU-123-XY"
                    value={editRegistration}
                    onChange={(e) => setEditRegistration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Assigned Operational Zone
                </label>
                <select
                  value={editZoneId}
                  onChange={(e) => setEditZoneId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                >
                  <option value="">All Enugu Corridor Zones</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} (₦{z.deliveryFee})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingRider(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition"
                >
                  {isSubmitting ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUSPEND / REACTIVATE MODAL */}
      {statusActionRider && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
                statusActionRider.action === 'suspend'
                  ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                  : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
              }`}
            >
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-black text-white">
                {statusActionRider.action === 'suspend' ? 'Suspend Courier Account' : 'Reactivate Courier Account'}
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Courier: <strong>{statusActionRider.rider.fullName || statusActionRider.rider.full_name}</strong>
              </p>
            </div>

            <div className="text-left space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Audit Justification Reason *
              </label>
              <input
                type="text"
                placeholder="e.g. Conduct review / Restored active standing..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStatusActionRider(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteStatusAction}
                className={`px-5 py-2 rounded-xl font-bold text-xs transition ${
                  statusActionRider.action === 'suspend'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isSubmitting ? 'Updating...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / ARCHIVE MODAL WITH ACTIVE DELIVERY SAFEGUARD */}
      {deletingRider && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-base font-black text-white">Deactivate / Remove Courier</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Courier: <strong>{deletingRider.fullName || deletingRider.full_name}</strong>
              </p>
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 text-left mt-3 leading-relaxed">
                <span className="font-bold text-zinc-300 block mb-0.5">Active Delivery Safety Policy:</span>
                Couriers with an ongoing delivery cannot be removed until the order is reassigned or completed. Past delivery audit logs are permanently preserved.
              </div>
            </div>

            <div className="text-left space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Reason for Removal *
              </label>
              <input
                type="text"
                placeholder="e.g. Courier resignation / contract completion..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRider(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
              >
                {isSubmitting ? 'Processing...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
