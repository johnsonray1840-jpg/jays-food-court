'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Compass,
  Bike,
  CreditCard,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowRight,
  Info,
  RefreshCw,
  Copy,
  Check,
  SendHorizontal,
  Edit3,
  Trash2,
  Archive
} from 'lucide-react';
import { formatNaira } from '@/lib/utils';

interface OrderDetailDrawerProps {
  orderId: string | null;
  onClose: () => void;
  onRefundSuccess?: () => void;
}

export function OrderDetailDrawer({ orderId, onClose, onRefundSuccess }: OrderDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'manifest' | 'payment' | 'refund' | 'timeline'>('manifest');

  // Edit Operational Info State
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLandmark, setEditLandmark] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editAuditReason, setEditAuditReason] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Archive / Safe Operational Removal State
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [isSubmittingArchive, setIsSubmittingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Refund Initiation Form State
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundReason, setRefundReason] = useState<string>('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [refundFormError, setRefundFormError] = useState<string | null>(null);
  const [refundFormSuccess, setRefundFormSuccess] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP error ${res.status}`);
      }
      const json = await res.json();
      setDetailData(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order record');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (!orderId) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleInitiateRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForRefund) return;
    if (!refundReason.trim() || refundReason.trim().length < 3) {
      setRefundFormError('A valid refund justification reason (min 3 chars) is required.');
      return;
    }

    setIsSubmittingRefund(true);
    setRefundFormError(null);
    setRefundFormSuccess(null);

    try {
      const payload: any = {
        paymentId: selectedPaymentForRefund,
        reason: refundReason.trim()
      };
      if (refundAmount && Number(refundAmount) > 0) {
        payload.amountInNaira = Number(refundAmount);
      }

      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process refund request.');
      }

      setRefundFormSuccess(data.message || 'Refund successfully initiated via Paystack.');
      setSelectedPaymentForRefund(null);
      setRefundAmount('');
      setRefundReason('');

      // Refresh order record
      await fetchDetail();
      if (onRefundSuccess) onRefundSuccess();
    } catch (err: any) {
      setRefundFormError(err.message || 'An unexpected error occurred while processing refund.');
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-wider">Delivered</span>;
      case 'picked_up':
      case 'out_for_delivery':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-black uppercase tracking-wider">Out for Delivery</span>;
      case 'ready_for_pickup':
        return <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[11px] font-black uppercase tracking-wider">Ready at Kitchen</span>;
      case 'preparing':
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-[11px] font-black uppercase tracking-wider">Kitchen Preparing</span>;
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[11px] font-black uppercase tracking-wider">Confirmed</span>;
      case 'pending_payment':
        return <span className="px-2.5 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[11px] font-black uppercase tracking-wider">Pending Payment</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-wider">Cancelled</span>;
      case 'refunded':
        return <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[11px] font-black uppercase tracking-wider">Refunded</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 text-[11px] font-bold uppercase">{status}</span>;
    }
  };

  const customer = detailData?.customer;
  const order = detailData?.order;
  const payments = detailData?.payments || [];
  const refund = detailData?.refund;
  const timeline = detailData?.timeline || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 flex justify-end">
      {/* Background click to dismiss */}
      <div className="flex-1" onClick={onClose} />

      {/* Slide-out Drawer Panel */}
      <div className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl relative">
        {/* Drawer Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold font-black">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white font-mono">
                  {order ? `#${order.orderCode}` : 'Order Detail'}
                </h2>
                {order && getOrderStatusBadge(order.status)}
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                {order?.id ? `UUID: ${order.id}` : 'Auditing records...'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs Header */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-zinc-800/80 bg-zinc-900/40 text-xs shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('manifest')}
            className={`px-4 py-2.5 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'manifest'
                ? 'border-brand-gold text-brand-gold bg-zinc-800/30'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Order & Customer</span>
          </button>

          <button
            onClick={() => setActiveTab('payment')}
            className={`px-4 py-2.5 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'payment'
                ? 'border-cyan-400 text-cyan-400 bg-zinc-800/30'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Payment ({payments.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('refund')}
            className={`px-4 py-2.5 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'refund'
                ? 'border-amber-400 text-amber-400 bg-zinc-800/30'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refund Ledger {refund?.hasRefund && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}</span>
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2.5 font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-purple-400 text-purple-400 bg-zinc-800/30'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Activity Timeline ({timeline.length})</span>
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading && (
            <div className="p-16 text-center text-zinc-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-gold" />
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Retrieving Authoritative Order & Payment Records...
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-xs text-red-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Error Loading Details</span>
              </div>
              <p>{error}</p>
            </div>
          )}

          {!loading && detailData && (
            <>
              {/* TAB 1: ORDER & CUSTOMER INFORMATION */}
              {activeTab === 'manifest' && (
                <div className="space-y-6">
                  {/* Section A: Customer Information */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-brand-gold">
                        Customer & Delivery Information
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditCustomerName(customer.name || '');
                            setEditPhone(customer.phone || '');
                            setEditAddress(customer.deliveryAddress || '');
                            setEditLandmark(customer.landmark || '');
                            setEditInstructions(customer.specialInstructions || '');
                            setEditAuditReason('');
                            setEditError(null);
                            setIsEditingInfo(!isEditingInfo);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-[10px] font-bold transition flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{isEditingInfo ? 'Cancel' : 'Edit Details'}</span>
                        </button>
                      </div>
                    </div>

                    {isEditingInfo ? (
                      <div className="p-3.5 bg-zinc-950 border border-amber-500/30 rounded-xl space-y-3">
                        <span className="text-[11px] font-bold text-amber-400 block">
                          Controlled Operational Edit (Audit Logged)
                        </span>

                        {editError && (
                          <div className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg">
                            {editError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Customer Name</label>
                            <input
                              type="text"
                              value={editCustomerName}
                              onChange={(e) => setEditCustomerName(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Phone Number</label>
                            <input
                              type="text"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 font-bold uppercase block">Delivery Address (Before Dispatch)</label>
                          <input
                            type="text"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 font-bold uppercase block">Delivery Landmark</label>
                          <input
                            type="text"
                            value={editLandmark}
                            onChange={(e) => setEditLandmark(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400 font-bold uppercase block">Delivery Instructions</label>
                          <textarea
                            rows={2}
                            value={editInstructions}
                            onChange={(e) => setEditInstructions(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
                          />
                        </div>

                        <div className="space-y-1 pt-1 border-t border-zinc-800">
                          <label className="text-[10px] text-zinc-400 font-bold uppercase block">Audit Justification Reason *</label>
                          <input
                            type="text"
                            placeholder="e.g. Customer called to correct phone/landmark..."
                            value={editAuditReason}
                            onChange={(e) => setEditAuditReason(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-amber-500/40 text-xs text-white"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingInfo(false)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isSavingEdit}
                            onClick={async () => {
                              if (!editAuditReason.trim()) {
                                setEditError('Audit reason is required for compliance.');
                                return;
                              }
                              setIsSavingEdit(true);
                              setEditError(null);
                              try {
                                const res = await fetch(`/api/admin/orders/${orderId}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    customerName: editCustomerName,
                                    phone: editPhone,
                                    deliveryAddress: editAddress,
                                    deliveryLandmark: editLandmark,
                                    specialInstructions: editInstructions,
                                    auditReason: editAuditReason.trim()
                                  })
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setIsEditingInfo(false);
                                  await fetchDetail();
                                } else {
                                  setEditError(data.error || 'Failed to update order');
                                }
                              } catch (err: any) {
                                setEditError(err.message || 'Network error');
                              } finally {
                                setIsSavingEdit(false);
                              }
                            }}
                            className="px-4 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold text-xs"
                          >
                            {isSavingEdit ? 'Saving...' : 'Save & Log Audit'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Full Name</span>
                        <div className="flex items-center gap-1.5 font-bold text-white mt-0.5">
                          <User className="w-3.5 h-3.5 text-brand-gold" />
                          <span>{customer.name}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Phone Number</span>
                        <div className="flex items-center gap-1.5 font-mono text-zinc-200 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-brand-gold" />
                          <span>{customer.phone || '—'}</span>
                          {customer.phone && (
                            <button
                              onClick={() => handleCopy(customer.phone, 'phone')}
                              className="text-zinc-500 hover:text-white transition ml-1"
                              title="Copy phone"
                            >
                              {copiedText === 'phone' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Email Address</span>
                        <div className="flex items-center gap-1.5 text-zinc-300 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-brand-gold" />
                          <span>{customer.email || 'Not provided'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Delivery Zone</span>
                        <div className="flex items-center gap-1.5 text-zinc-300 mt-0.5 font-bold">
                          <Compass className="w-3.5 h-3.5 text-brand-gold" />
                          <span>{customer.deliveryZone?.name || 'Agbani Delivery Zone'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Address & Landmark */}
                    <div className="pt-2 border-t border-zinc-800 space-y-1.5 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Delivery Address</span>
                        <div className="flex items-start gap-1.5 text-zinc-200 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-brand-gold shrink-0 mt-0.5" />
                          <span>{customer.deliveryAddress}</span>
                        </div>
                      </div>

                      {customer.landmark && (
                        <div>
                          <span className="text-zinc-500 block text-[10px] uppercase font-bold">Landmark</span>
                          <span className="text-zinc-300 text-xs">{customer.landmark}</span>
                        </div>
                      )}

                      {customer.specialInstructions && (
                        <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-[11px] text-amber-300">
                          <span className="font-bold text-amber-400 block mb-0.5">Customer Delivery Instructions:</span>
                          <span>&ldquo;{customer.specialInstructions}&rdquo;</span>
                        </div>
                      )}
                    </div>
                    </>
                  )}
                  </div>

                  {/* Section B: Order Information & Line Items */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-brand-gold">
                        Order Information & Purchased Items
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {order.items?.length || 0} Line Items &bull; Immutable Prices
                      </span>
                    </div>

                    {/* Metadata Header */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-zinc-950 p-3 rounded-xl border border-zinc-800/80">
                      <div>
                        <span className="text-zinc-500 block">Created At</span>
                        <span className="text-white font-mono font-bold">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[10px] text-zinc-500 block">
                          {new Date(order.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block">Status</span>
                        <span className="text-white font-bold capitalize">{order.status}</span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block">Est. Prep Time</span>
                        <span className="text-white font-bold">{order.estimatedPrepMinutes ? `${order.estimatedPrepMinutes} Mins` : 'Standard'}</span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block">Est. Delivery</span>
                        <span className="text-white font-bold">{order.estimatedDeliveryTime || '20 - 30 Mins'}</span>
                      </div>
                    </div>

                    {/* Line Items List with Original Prices */}
                    <div className="space-y-2 divide-y divide-zinc-800/60">
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="pt-2 flex items-start justify-between text-xs">
                          <div className="space-y-0.5">
                            <span className="font-bold text-white">
                              {item.quantity}x {item.name}
                            </span>
                            {item.customizations?.swallows && Array.isArray(item.customizations.swallows) && item.customizations.swallows.length > 0 ? (
                              item.customizations.swallows.map((s: any, sIdx: number) => (
                                <span key={sIdx} className="text-[11px] text-zinc-300 font-mono block">
                                  + {s.quantity} wrap{s.quantity === 1 ? '' : 's'} {s.name} {s.subtotal > 0 ? `(${formatNaira(s.subtotal)})` : '(Included)'}
                                </span>
                              ))
                            ) : item.customizations?.swallow ? (
                              <span className="text-[11px] text-zinc-400 block">+ {item.customizations.swallow}</span>
                            ) : null}
                            {item.customizations?.proteins && Array.isArray(item.customizations.proteins) && item.customizations.proteins.length > 0 ? (
                              item.customizations.proteins.map((p: any, pIdx: number) => (
                                <span key={pIdx} className="text-[11px] text-amber-400/90 font-mono block">
                                  + {p.quantity}x {p.name} ({formatNaira(p.subtotal || p.unitPrice * p.quantity)})
                                </span>
                              ))
                            ) : item.customizations?.protein ? (
                              <span className="text-[11px] text-zinc-400 block">+ {item.customizations.protein}</span>
                            ) : null}
                            {item.customizations?.addons && Array.isArray(item.customizations.addons) && item.customizations.addons.length > 0 ? (
                              item.customizations.addons.map((a: any, aIdx: number) => (
                                <span key={aIdx} className="text-[11px] text-blue-400 font-mono block">
                                  + {a.quantity}x {a.name} ({formatNaira(a.subtotal || a.unitPrice * a.quantity)})
                                </span>
                              ))
                            ) : null}
                            {item.notes && (
                              <span className="text-[11px] text-zinc-500 italic block">Special note: {item.notes}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-extrabold text-white text-xs block">
                              {formatNaira(item.totalPrice)}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono block">
                              @{formatNaira(item.unitPrice)} each
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Financial Breakdown */}
                    <div className="border-t border-zinc-800 pt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-zinc-400">
                        <span>Subtotal</span>
                        <span className="font-mono text-white">{formatNaira(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Delivery Fee</span>
                        <span className="font-mono text-white">{formatNaira(order.deliveryFee)}</span>
                      </div>
                      {order.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-400 font-bold">
                          <span>Discount Applied</span>
                          <span className="font-mono">-{formatNaira(order.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-black text-white pt-2 border-t border-zinc-800">
                        <span>Total Paid / Payable</span>
                        <span className="font-mono text-brand-gold">{formatNaira(order.totalAmount)}</span>
                      </div>
                    </div>

                    {/* Cancellation details if recorded */}
                    {order.cancellationReason && (
                      <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-xl text-xs text-red-300">
                        <span className="font-bold text-red-400 block mb-0.5">Cancellation Audit Record:</span>
                        <span>{order.cancellationReason}</span>
                      </div>
                    )}

                    {/* Assigned Courier */}
                    {order.assignedRider && (
                      <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Bike className="w-4 h-4 text-brand-gold" />
                          <div>
                            <span className="text-zinc-400 text-[10px] uppercase font-bold block">Assigned Delivery Courier</span>
                            <span className="font-bold text-white">{order.assignedRider.fullName}</span>
                          </div>
                        </div>
                        <div className="text-right font-mono text-zinc-300">
                          <span>{order.assignedRider.phone}</span>
                          <span className="text-[10px] text-zinc-500 block">Rating: ★ {order.assignedRider.rating}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: PAYMENT INFORMATION (Section C) */}
              {activeTab === 'payment' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
                      Payment Gateway & Transaction Audit
                    </span>
                    <span className="text-[10px] text-zinc-500">Security Redacted</span>
                  </div>

                  {payments.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-bold text-zinc-400">No payment records found.</p>
                      <p className="text-[11px] text-zinc-600">The customer may not have initiated checkout on Paystack yet.</p>
                    </div>
                  ) : (
                    payments.map((p: any, idx: number) => {
                      const isEligibleForRefund = p.status === 'successful' && p.refundStatus !== 'full' && p.refundStatus !== 'processing';

                      return (
                        <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 text-xs">
                          {/* Transaction Card Header */}
                          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-black text-white">{formatNaira(p.amount)}</span>
                              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] uppercase font-bold">
                                {p.provider}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] uppercase font-bold">
                                {p.currency}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isEligibleForRefund && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPaymentForRefund(p.id);
                                    const maxRefundable = Math.max(0, p.amount - (p.refundAmount || 0));
                                    setRefundAmount(maxRefundable.toString());
                                    setActiveTab('refund');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 font-bold text-[10px] uppercase transition flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Refund</span>
                                </button>
                              )}

                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                p.status === 'successful'
                                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                  : p.status === 'failed'
                                  ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                                  : 'bg-yellow-500/15 border border-yellow-500/30 text-yellow-400'
                              }`}>
                                {p.status}
                              </span>
                            </div>
                          </div>

                          {/* Transaction Detail Attributes */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                            <div>
                              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Provider Reference</span>
                              <div className="flex items-center gap-1.5 text-zinc-200 mt-0.5">
                                <span className="select-all text-[11px]">{p.reference}</span>
                                <button
                                  onClick={() => handleCopy(p.reference, `ref-${idx}`)}
                                  className="text-zinc-500 hover:text-white transition"
                                  title="Copy Reference"
                                >
                                  {copiedText === `ref-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Payment Channel</span>
                              <span className="text-zinc-200 capitalize mt-0.5 block font-bold">
                                {p.channel || 'Card / Paystack Checkout'}
                              </span>
                            </div>

                            <div>
                              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Initialized At</span>
                              <span className="text-zinc-300 text-[11px]">
                                {p.initializedAt ? new Date(p.initializedAt).toLocaleString('en-NG') : '—'}
                              </span>
                            </div>

                            <div>
                              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Verified At</span>
                              <span className="text-zinc-300 text-[11px]">
                                {p.verifiedAt ? new Date(p.verifiedAt).toLocaleString('en-NG') : '—'}
                              </span>
                            </div>
                          </div>

                          {/* Webhook & Failure Details */}
                          {p.webhookEventId && (
                            <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                              <span>Webhook Event ID: {p.webhookEventId}</span>
                              <span className="text-emerald-400 font-bold flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" /> Webhook Verified
                              </span>
                            </div>
                          )}

                          {p.status === 'failed' && (
                            <div className="bg-red-950/40 border border-red-900/60 p-3 rounded-xl text-xs text-red-300">
                              <span className="font-bold text-red-400 block mb-0.5">Failure Details:</span>
                              <span>{p.gatewayResponse || 'Payment authorization failed or abandoned by user.'}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: REFUND MANAGEMENT & RECONCILIATION (Section 5) */}
              {activeTab === 'refund' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                      Authoritative Refund Reconciliation & Paystack Management
                    </span>
                    <span className="text-[10px] text-zinc-500">Database Ledger</span>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <span className="text-[10px] font-bold uppercase text-zinc-500 block">Original Paid</span>
                      <span className="text-sm font-black text-white font-mono mt-1 block">
                        {formatNaira(refund?.originalPaymentAmount || 0)}
                      </span>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <span className="text-[10px] font-bold uppercase text-amber-400 block">Total Refunded</span>
                      <span className="text-sm font-black text-amber-400 font-mono mt-1 block">
                        {formatNaira(refund?.totalAmountRefunded || 0)}
                      </span>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 block">Refundable Remainder</span>
                      <span className="text-sm font-black text-emerald-400 font-mono mt-1 block">
                        {formatNaira(refund?.remainingRefundableBalance || 0)}
                      </span>
                    </div>
                  </div>

                  {/* INITIATE REFUND ACTION FORM */}
                  {refund?.remainingRefundableBalance > 0 && payments.some((p: any) => p.status === 'successful' && p.refundStatus !== 'full') && (
                    <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-400">
                          <RotateCcw className="w-4 h-4" />
                          <span>Initiate Refund (Paystack Integration)</span>
                        </div>
                        <span className="text-[10px] text-zinc-500">Manager Authorization Required</span>
                      </div>

                      {refundFormError && (
                        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                          {refundFormError}
                        </div>
                      )}

                      {refundFormSuccess && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                          {refundFormSuccess}
                        </div>
                      )}

                      <form onSubmit={handleInitiateRefund} className="space-y-3 text-xs">
                        {/* Select Payment Transaction */}
                        <div>
                          <label className="text-zinc-400 text-[11px] font-bold block mb-1">
                            Target Transaction Reference
                          </label>
                          <select
                            value={selectedPaymentForRefund || ''}
                            onChange={(e) => {
                              setSelectedPaymentForRefund(e.target.value);
                              const targetPmt = payments.find((p: any) => p.id === e.target.value);
                              if (targetPmt) {
                                const maxBalance = Math.max(0, targetPmt.amount - (targetPmt.refundAmount || 0));
                                setRefundAmount(maxBalance.toString());
                              }
                            }}
                            required
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                          >
                            <option value="">-- Select Payment to Refund --</option>
                            {payments
                              .filter((p: any) => p.status === 'successful' && p.refundStatus !== 'full')
                              .map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.reference} &bull; Paid: {formatNaira(p.amount)} (Avail: {formatNaira(p.amount - (p.refundAmount || 0))})
                                </option>
                              ))}
                          </select>
                        </div>

                        {/* Refund Amount in Naira */}
                        <div>
                          <label className="text-zinc-400 text-[11px] font-bold block mb-1">
                            Refund Amount (₦) — Leave as full balance or enter partial amount
                          </label>
                          <input
                            type="number"
                            step="any"
                            min="1"
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder="Enter refund amount"
                            required
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        {/* Refund Reason */}
                        <div>
                          <label className="text-zinc-400 text-[11px] font-bold block mb-1">
                            Refund Justification Reason (Required for Audit)
                          </label>
                          <textarea
                            rows={2}
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            placeholder="State exact customer reason (e.g. order cancelled prior to prep, item unavailable, duplicate payment)"
                            required
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-400 resize-none"
                          />
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="submit"
                            disabled={isSubmittingRefund || !selectedPaymentForRefund}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            <SendHorizontal className="w-3.5 h-3.5" />
                            <span>{isSubmittingRefund ? 'Initiating via Paystack...' : 'Confirm & Issue Refund'}</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* List of Individual Refund Records */}
                  {(!refund?.records || refund.records.length === 0) ? (
                    <div className="p-8 text-center text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-2xl">
                      <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-bold text-zinc-400">No refunds recorded on this order.</p>
                      <p className="text-[11px] text-zinc-600">All original payment funds remain intact.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
                        Refund Audit Records ({refund.records.length})
                      </span>
                      {refund.records.map((r: any, idx: number) => (
                        <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2.5 text-xs">
                          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                            <div>
                              <span className="font-mono text-sm font-black text-amber-400">{formatNaira(r.refundAmount)}</span>
                              <span className="text-[10px] text-zinc-500 block font-mono">Ref: {r.refundReference}</span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              r.refundStatus === 'full' || r.refundStatus === 'partial'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : r.refundStatus === 'failed'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                            }`}>
                              {r.refundStatus}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                            <div>
                              <span className="text-zinc-500 block">Initiated Timestamp:</span>
                              <span className="text-zinc-300">{r.initiatedAt ? new Date(r.initiatedAt).toLocaleString('en-NG') : '—'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500 block">Completed Timestamp:</span>
                              <span className="text-zinc-300">{r.completedAt ? new Date(r.completedAt).toLocaleString('en-NG') : '—'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500 block">Staff Initiator:</span>
                              <span className="text-zinc-300">{r.initiatedByStaff}</span>
                            </div>
                            <div>
                              <span className="text-zinc-500 block">Reason:</span>
                              <span className="text-zinc-300">{r.refundReason}</span>
                            </div>
                          </div>

                          {r.failureReason && (
                            <div className="bg-red-950/40 border border-red-900/60 p-2.5 rounded-xl text-xs text-red-300">
                              <span className="font-bold text-red-400 block">Failure Reason:</span>
                              <span>{r.failureReason}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CHRONOLOGICAL ACTIVITY TIMELINE (Section E) */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-400">
                      Chronological Activity Timeline
                    </span>
                    <span className="text-[10px] text-zinc-500">Immutable Audit Trail</span>
                  </div>

                  {timeline.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic p-6 text-center">No activity events recorded.</p>
                  ) : (
                    <div className="relative pl-6 space-y-6 border-l-2 border-zinc-800 my-2">
                      {timeline.map((event: any, idx: number) => {
                        const isSuccess = event.status === 'success';
                        const isError = event.status === 'error';
                        const isWarning = event.status === 'warning';

                        const dotBg = isSuccess
                          ? 'bg-emerald-500'
                          : isError
                          ? 'bg-red-500'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-brand-gold';

                        return (
                          <div key={idx} className="relative group">
                            {/* Dot */}
                            <div className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full ${dotBg} border-2 border-zinc-950 shadow-sm`} />

                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-1.5 text-xs transition hover:border-zinc-700">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <span className="font-bold text-white text-xs">
                                  {event.title}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {new Date(event.timestamp).toLocaleString('en-NG', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}
                                </span>
                              </div>

                              {event.description && (
                                <p className="text-zinc-300 text-[11px] leading-relaxed">
                                  {event.description}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                                <span>Source: <strong className="text-zinc-400 capitalize">{event.source}</strong></span>
                                {event.actorId && <span>Actor: <strong className="font-mono text-zinc-400">{event.actorId}</strong></span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            {order && (
              <button
                type="button"
                onClick={() => setIsArchiving(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/80 border border-rose-900/50 text-rose-300 text-xs font-bold transition flex items-center gap-1.5"
                title="Safely remove order from active operational interface"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Archive Order</span>
              </button>
            )}
            <span className="text-[10px] text-zinc-500 hidden sm:inline">
              Controlled Operational Lifecycle &bull; Immutable Financial Audit
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition"
          >
            Close
          </button>
        </div>

        {/* SAFE OPERATIONAL ARCHIVAL CONFIRMATION MODAL */}
        {isArchiving && order && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-4 text-center animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
                <Archive className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-base font-black text-white">Safe Operational Removal / Archival</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Order #{order.orderCode} &bull; Total {formatNaira(order.totalAmount)}
                </p>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 text-left mt-3 leading-relaxed">
                  <span className="font-bold text-zinc-300 block mb-0.5">Non-Destructive Audit Guarantee:</span>
                  This order will be removed from the active operational dispatch view. All payment transactions, Paystack references, line items, and audit history will be permanently preserved for tax and financial reconciliation.
                </div>
              </div>

              {archiveError && (
                <div className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2 rounded-lg text-left">
                  {archiveError}
                </div>
              )}

              <div className="text-left space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Mandatory Archival / Removal Reason *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Duplicate customer order / Operational cancellation request..."
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsArchiving(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingArchive}
                  onClick={async () => {
                    if (!archiveReason.trim() || archiveReason.trim().length < 5) {
                      setArchiveError('Please enter a clear explanation reason (minimum 5 characters).');
                      return;
                    }
                    setIsSubmittingArchive(true);
                    setArchiveError(null);
                    try {
                      const res = await fetch(`/api/admin/orders/${orderId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason: archiveReason.trim() })
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setIsArchiving(false);
                        onClose();
                        if (onRefundSuccess) onRefundSuccess();
                      } else {
                        setArchiveError(data.error || 'Failed to archive order');
                      }
                    } catch (err: any) {
                      setArchiveError(err.message || 'Network error');
                    } finally {
                      setIsSubmittingArchive(false);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
                >
                  {isSubmittingArchive ? 'Archiving...' : 'Confirm Archival'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
