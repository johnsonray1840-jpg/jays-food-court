'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  User,
  MapPin,
  Bike,
  ChevronDown,
  ChevronUp,
  Receipt,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Ban,
  Calendar,
  ArrowUpDown,
  X,
  Phone,
  Eye,
  ShoppingBag,
  DollarSign,
  AlertOctagon,
  Activity,
  Download
} from 'lucide-react';
import { formatNaira } from '@/lib/utils';
import { OrderDetailDrawer } from './OrderDetailDrawer';

interface OrderHistoryManagerProps {
  onRefreshStats?: () => void;
}

export function OrderHistoryManager({ onRefreshStats }: OrderHistoryManagerProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Detail Drawer state
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Reconciliation Incidents State
  const [reconciliationData, setReconciliationData] = useState<any | null>(null);
  const [showIncidentsPanel, setShowIncidentsPanel] = useState<boolean>(false);
  const [reconcilingRef, setReconcilingRef] = useState<string | null>(null);
  const [reconcileFeedback, setReconcileFeedback] = useState<string | null>(null);

  const fetchOrdersHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        filter: activeFilter,
        dateRange,
        sort: sortOrder,
        page: page.toString(),
        limit: '25'
      });
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      if (dateRange === 'custom') {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      }

      const res = await fetch(`/api/admin/orders/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setSummary(data.summary || null);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
      }
    } catch (err) {
      console.error('Failed to load order history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, dateRange, startDate, endDate, sortOrder, page, searchQuery]);

  // Fetch Financial Incidents & Reconciliation Data
  const fetchReconciliationReport = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/reconciliation');
      if (res.ok) {
        const data = await res.json();
        setReconciliationData(data);
      }
    } catch (err) {
      console.warn('Failed to fetch reconciliation incidents:', err);
    }
  }, []);

  useEffect(() => {
    fetchOrdersHistory();
    fetchReconciliationReport();
  }, [fetchOrdersHistory, fetchReconciliationReport]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setPage(1);
  };

  const handleDateRangeChange = (range: string) => {
    setDateRange(range);
    setPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortOrder(sort);
    setPage(1);
  };

  const handleTriggerReconcile = async (reference: string) => {
    setReconcilingRef(reference);
    setReconcileFeedback(null);
    try {
      const res = await fetch('/api/payments/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_with_paystack',
          reference
        })
      });
      const data = await res.json();
      if (res.ok) {
        setReconcileFeedback(data.message || `Reference ${reference} reconciled successfully.`);
        fetchReconciliationReport();
        fetchOrdersHistory();
      } else {
        setReconcileFeedback(data.error || 'Failed to reconcile payment.');
      }
    } catch (err: any) {
      setReconcileFeedback(err.message || 'Error executing reconciliation sync.');
    } finally {
      setReconcilingRef(null);
    }
  };

  // Operational Lifecycle Badge
  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">Delivered</span>;
      case 'picked_up':
      case 'out_for_delivery':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider">Out for Delivery</span>;
      case 'ready_for_pickup':
        return <span className="px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-black uppercase tracking-wider">Ready for Pickup</span>;
      case 'preparing':
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400 text-[10px] font-black uppercase tracking-wider">Kitchen Preparing</span>;
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-wider">Confirmed</span>;
      case 'pending_payment':
        return <span className="px-2.5 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-black uppercase tracking-wider">Pending Payment</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wider">Cancelled</span>;
      case 'refunded':
        return <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-wider">Refunded</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase">{status}</span>;
    }
  };

  // Payment Status Badge
  const getPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400"><CheckCircle className="w-3 h-3" /> Paid</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><XCircle className="w-3 h-3" /> Failed</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-400"><Clock className="w-3 h-3" /> Pending</span>;
      case 'refunded':
        return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400"><RotateCcw className="w-3 h-3" /> Refunded</span>;
      default:
        return <span className="text-zinc-400 text-[11px] capitalize">{paymentStatus || 'Pending'}</span>;
    }
  };

  // Refund Status Badge
  const getRefundBadge = (refundStatus: string) => {
    switch (refundStatus) {
      case 'full':
        return <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold uppercase">Full Refund</span>;
      case 'partial':
        return <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase">Partial Refund</span>;
      case 'pending':
      case 'processing':
        return <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold uppercase">Refund Processing</span>;
      case 'failed':
        return <span className="px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold uppercase">Refund Failed</span>;
      default:
        return <span className="text-zinc-500 text-[11px]">—</span>;
    }
  };

  const totalIncidentsCount = reconciliationData?.summary?.totalIncidentCount || 0;

  return (
    <div className="space-y-6">
      {/* 1. TOP AUTHORITATIVE STATISTICAL METRICS OVERVIEW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Orders</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{summary ? summary.totalOrders : '...'}</span>
            <FileText className="w-4 h-4 text-brand-gold opacity-80" />
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">{summary ? `${summary.totalPaymentTransactions} transactions` : 'Loading...'}</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Delivered</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">{summary ? summary.completedDeliveredOrders : '...'}</span>
            <CheckCircle className="w-4 h-4 text-emerald-400 opacity-80" />
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">{summary ? `${summary.paidNotDeliveredOrders} paid in transit` : ''}</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-yellow-400">Pending Payments</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-yellow-400">{summary ? summary.pendingPaymentOrders : '...'}</span>
            <Clock className="w-4 h-4 text-yellow-400 opacity-80" />
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">Awaiting checkout</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">Cancelled / Failed</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-red-400">{summary ? summary.cancelledOrders : '...'}</span>
            <Ban className="w-4 h-4 text-red-400 opacity-80" />
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">{summary ? `${summary.failedPaymentAttempts} failed pay attempts` : ''}</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Total Revenue Paid</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-white">
              {summary ? formatNaira(summary.totalSuccessfulPaymentAmount) : '...'}
            </span>
            <CreditCard className="w-4 h-4 text-cyan-400 opacity-80" />
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">Verified on Paystack</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Total Refunded</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black text-amber-400">
              {summary ? formatNaira(summary.totalRefundedAmount) : '...'}
            </span>
            <RotateCcw className="w-4 h-4 text-amber-400 opacity-80" />
          </div>
          <span className="text-[10px] text-zinc-500 mt-1">{summary ? `${summary.fullyRefundedPayments} full &bull; ${summary.partiallyRefundedPayments} partial` : ''}</span>
        </div>
      </div>

      {/* FINANCIAL INCIDENTS NOTIFICATION BANNER */}
      {totalIncidentsCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-amber-400 uppercase tracking-wide block">
                {totalIncidentsCount} Financial Incident{totalIncidentsCount === 1 ? '' : 's'} Requiring Reconciliation
              </span>
              <span className="text-zinc-300 text-[11px]">
                Detected discrepancies across cancelled orders, unsettled payments, or pending refunds. Records preserved for audit.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowIncidentsPanel(!showIncidentsPanel)}
            className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-black text-xs hover:bg-amber-400 transition shrink-0"
          >
            {showIncidentsPanel ? 'Hide Incidents' : 'View Financial Incidents'}
          </button>
        </div>
      )}

      {/* EXPANDABLE RECONCILIATION INCIDENTS PANEL */}
      {showIncidentsPanel && reconciliationData && (
        <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Payment & Order Reconciliation Dashboard
              </h3>
            </div>
            <button
              onClick={fetchReconciliationReport}
              className="text-zinc-400 hover:text-white text-xs flex items-center gap-1 font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-scan Anomaly Engine</span>
            </button>
          </div>

          {reconcileFeedback && (
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-amber-300">
              {reconcileFeedback}
            </div>
          )}

          {/* List of Incidents */}
          <div className="space-y-3">
            {/* 1. Cancelled orders with successful payments */}
            {reconciliationData.incidents?.cancelledOrdersWithSuccessfulPayments?.map((item: any, idx: number) => (
              <div key={idx} className="bg-zinc-950 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-white">#{item.order.order_code}</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold uppercase">Cancelled & Paid</span>
                    <span className="font-mono font-bold text-amber-400">{formatNaira(item.payment.amount)}</span>
                  </div>
                  <p className="text-zinc-400 text-[11px]">{item.message}</p>
                  <span className="text-zinc-500 font-mono text-[10px] block">Paystack Ref: {item.payment.provider_reference}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedOrder(item.order)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition"
                  >
                    Inspect & Refund
                  </button>
                  <button
                    onClick={() => handleTriggerReconcile(item.payment.provider_reference)}
                    disabled={reconcilingRef === item.payment.provider_reference}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black transition disabled:opacity-40"
                  >
                    {reconcilingRef === item.payment.provider_reference ? 'Syncing...' : 'Sync Gateway'}
                  </button>
                </div>
              </div>
            ))}

            {/* 2. Inconsistent status orders */}
            {reconciliationData.incidents?.inconsistentStatusOrders?.map((item: any, idx: number) => (
              <div key={idx} className="bg-zinc-950 border border-yellow-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-white">#{item.order.order_code}</span>
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-bold uppercase">Status Desync</span>
                  </div>
                  <p className="text-zinc-400 text-[11px]">{item.message}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedOrder(item.order)}
                    className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition"
                  >
                    View Record
                  </button>
                  {item.payments?.[0]?.provider_reference && (
                    <button
                      onClick={() => handleTriggerReconcile(item.payments[0].provider_reference)}
                      disabled={reconcilingRef === item.payments[0].provider_reference}
                      className="px-3 py-1.5 rounded-xl bg-brand-gold text-zinc-950 text-xs font-black transition disabled:opacity-40"
                    >
                      {reconcilingRef === item.payments[0].provider_reference ? 'Reconciling...' : 'Reconcile Status'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* 3. Stale Pending Refunds */}
            {reconciliationData.incidents?.stalePendingRefunds?.map((item: any, idx: number) => (
              <div key={idx} className="bg-zinc-950 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white block">Stale Refund for Payment {item.provider_reference}</span>
                  <span className="text-zinc-400 text-[11px]">Refund has been pending for &gt; 24 hours. Gateway confirmation required.</span>
                </div>
                <button
                  onClick={() => handleTriggerReconcile(item.provider_reference)}
                  disabled={reconcilingRef === item.provider_reference}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition"
                >
                  Verify at Paystack
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. CONTROLS: SEARCH, FILTERS, DATE RANGES, AND SORTING */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
        {/* Top Control Bar: Search + Date Range + Sorting + Refresh */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search reference, customer, phone, Paystack ref..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-brand-gold font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300">
              <Calendar className="w-3.5 h-3.5 text-brand-gold shrink-0" />
              <select
                value={dateRange}
                onChange={(e) => handleDateRangeChange(e.target.value)}
                aria-label="Filter by date range"
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900 text-white">All Time</option>
                <option value="today" className="bg-zinc-900 text-white">Today</option>
                <option value="yesterday" className="bg-zinc-900 text-white">Yesterday</option>
                <option value="7days" className="bg-zinc-900 text-white">Last 7 Days</option>
                <option value="30days" className="bg-zinc-900 text-white">Last 30 Days</option>
                <option value="this_month" className="bg-zinc-900 text-white">This Month</option>
                <option value="custom" className="bg-zinc-900 text-white">Custom Range...</option>
              </select>
            </div>

            {/* Custom Date Range Pickers (conditional) */}
            {dateRange === 'custom' && (
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  aria-label="Start date"
                  className="bg-zinc-900 text-white text-xs rounded px-2 py-1 border border-zinc-700"
                />
                <span className="text-zinc-500 text-xs">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  aria-label="End date"
                  className="bg-zinc-900 text-white text-xs rounded px-2 py-1 border border-zinc-700"
                />
              </div>
            )}

            {/* Sorting Selector */}
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-gold shrink-0" />
              <select
                value={sortOrder}
                onChange={(e) => handleSortChange(e.target.value)}
                aria-label="Sort orders"
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-zinc-900 text-white">Newest First</option>
                <option value="oldest" className="bg-zinc-900 text-white">Oldest First</option>
                <option value="amount_desc" className="bg-zinc-900 text-white">Amount: High to Low</option>
                <option value="amount_asc" className="bg-zinc-900 text-white">Amount: Low to High</option>
              </select>
            </div>

            {/* Export CSV Button */}
            <a
              href={`/api/admin/orders/history/export?filter=${activeFilter}&dateRange=${dateRange}&sort=${sortOrder}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition"
              title="Export Current Filtered View as CSV"
            >
              <Download className="w-3.5 h-3.5 text-brand-gold" />
              <span className="hidden sm:inline">Export CSV</span>
            </a>

            {/* Refresh Button */}
            <button
              onClick={fetchOrdersHistory}
              className="px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition"
              title="Refresh Ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-t border-zinc-800/80 pt-3">
          {[
            { id: 'all', label: 'All Orders', count: summary?.totalOrders },
            { id: 'delivered', label: 'Delivered', count: summary?.completedDeliveredOrders },
            { id: 'paid_not_delivered', label: 'Paid & In Transit', count: summary?.paidNotDeliveredOrders },
            { id: 'pending_payment', label: 'Pending Payment', count: summary?.pendingPaymentOrders },
            { id: 'failed_payment', label: 'Failed Payments', count: summary?.failedPaymentAttempts },
            { id: 'cancelled', label: 'Cancelled', count: summary?.cancelledOrders },
            { id: 'fully_refunded', label: 'Fully Refunded', count: summary?.fullyRefundedPayments },
            { id: 'partially_refunded', label: 'Partially Refunded', count: summary?.partiallyRefundedPayments },
            { id: 'pending_refund', label: 'Pending Refund', count: summary?.pendingRefunds },
            { id: 'failed_refund', label: 'Failed Refund', count: summary?.failedRefunds }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                activeFilter === tab.id
                  ? 'bg-brand-gold text-zinc-950 shadow-sm'
                  : 'bg-zinc-800/70 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeFilter === tab.id ? 'bg-zinc-950/20 text-zinc-950 font-black' : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 3. ORDER HISTORY & TRANSACTION AUDIT TABLE */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        {isLoading && orders.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-gold" />
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-300">Auditing Order & Transaction Records...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 space-y-2">
            <Receipt className="w-12 h-12 mx-auto text-zinc-600 mb-2" />
            <p className="text-sm font-bold text-white">No historical orders match this filter or search query.</p>
            <p className="text-xs text-zinc-500">Every recorded order and payment transaction remains permanently in the database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px] select-none">
                <tr>
                  <th className="py-3.5 px-4 font-black">Order Reference</th>
                  <th className="py-3.5 px-4 font-black">Customer</th>
                  <th className="py-3.5 px-4 font-black">Phone</th>
                  <th className="py-3.5 px-4 font-black">Date</th>
                  <th className="py-3.5 px-4 font-black text-center">Items</th>
                  <th className="py-3.5 px-4 font-black">Total</th>
                  <th className="py-3.5 px-4 font-black">Payment</th>
                  <th className="py-3.5 px-4 font-black">Order Status</th>
                  <th className="py-3.5 px-4 font-black">Refund</th>
                  <th className="py-3.5 px-4 font-black">Payment Method</th>
                  <th className="py-3.5 px-4 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {orders.map((order) => {
                  const latestPayment = order.payments?.[order.payments.length - 1];
                  const itemCount = (order.items || []).reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);

                  return (
                    <tr 
                      key={order.id}
                      className="hover:bg-zinc-800/40 transition group"
                    >
                      {/* 1. Order Reference */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-white text-xs block group-hover:text-brand-gold transition">
                          #{order.orderCode}
                        </span>
                        <span className="text-[10px] text-zinc-500 block font-mono">
                          {order.id.slice(0, 8)}...
                        </span>
                      </td>

                      {/* 2. Customer */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white block max-w-[140px] truncate">
                          {order.customerName}
                        </span>
                      </td>

                      {/* 3. Phone */}
                      <td className="py-3.5 px-4 font-mono text-zinc-300 text-xs">
                        {order.phone || '—'}
                      </td>

                      {/* 4. Date */}
                      <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                        <span className="block text-zinc-200">
                          {new Date(order.createdAt).toLocaleDateString('en-NG', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="block text-[10px] text-zinc-500 font-mono">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      {/* 5. Items */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-bold text-[11px]">
                          {itemCount}
                        </span>
                      </td>

                      {/* 6. Total */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-extrabold text-white text-xs">
                          {formatNaira(order.totalAmount)}
                        </span>
                      </td>

                      {/* 7. Payment */}
                      <td className="py-3.5 px-4">
                        {getPaymentBadge(order.paymentStatus)}
                        {latestPayment?.reference && (
                          <span className="text-[10px] text-zinc-500 block font-mono truncate max-w-[120px]" title={latestPayment.reference}>
                            {latestPayment.reference}
                          </span>
                        )}
                      </td>

                      {/* 8. Order Status */}
                      <td className="py-3.5 px-4">
                        {getOrderStatusBadge(order.status)}
                      </td>

                      {/* 9. Refund */}
                      <td className="py-3.5 px-4">
                        {getRefundBadge(order.refundStatus)}
                        {order.financialSummary?.refundAmount > 0 && (
                          <span className="text-[10px] text-amber-400 block font-mono">
                            {formatNaira(order.financialSummary.refundAmount)}
                          </span>
                        )}
                      </td>

                      {/* 10. Payment Method */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] font-bold capitalize">
                          <CreditCard className="w-3 h-3 text-brand-gold shrink-0" />
                          <span>{order.paymentMethod || 'Paystack'}</span>
                        </span>
                      </td>

                      {/* 11. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-gold/15 hover:bg-brand-gold text-brand-gold hover:text-zinc-950 text-xs font-black transition border border-brand-gold/30 hover:border-brand-gold"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Bar */}
        <div className="bg-zinc-950 border-t border-zinc-800 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-zinc-400 font-medium">
            Showing <span className="text-white font-bold">{orders.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}</span> to{' '}
            <span className="text-white font-bold">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
            <span className="text-white font-bold">{pagination.total}</span> recorded orders
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition"
            >
              Previous
            </button>
            <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-brand-gold font-mono font-bold text-xs">
              Page {pagination.page} / {Math.max(1, pagination.totalPages)}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
              disabled={page >= pagination.totalPages || isLoading}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed font-bold transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 4. DEDICATED AUDIT & TRANSACTION DETAIL DRAWER (WITH REFUND INITIATION) */}
      <OrderDetailDrawer
        orderId={selectedOrder?.id || null}
        onClose={() => setSelectedOrder(null)}
        onRefundSuccess={() => {
          fetchOrdersHistory();
          fetchReconciliationReport();
        }}
      />
    </div>
  );
}
