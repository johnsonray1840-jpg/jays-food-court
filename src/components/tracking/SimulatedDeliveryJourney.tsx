'use client';

import React, { useId, useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bike,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChefHat,
  ShieldCheck,
  Navigation,
  Sparkles
} from 'lucide-react';
import { OrderStatus } from '@/types';
import { calculateDeliverySimulation, SimulationState } from '@/lib/delivery-simulation-engine';

interface SimulatedDeliveryJourneyProps {
  status: OrderStatus;
  destinationAddress: string;
  destinationLandmark?: string;
  zoneName?: string;
  courierName?: string;
  estimatedDeliveryTime?: string;
  statusUpdatedAt?: string;
  dispatchedAt?: string;
  prepTimeMinutes?: number;
}

export function SimulatedDeliveryJourney({
  status,
  destinationAddress,
  destinationLandmark,
  zoneName = 'Enugu Corridor',
  courierName = 'Jay’s Dispatch Courier',
  estimatedDeliveryTime = '20 - 30 mins',
  statusUpdatedAt,
  dispatchedAt,
  prepTimeMinutes = 20
}: SimulatedDeliveryJourneyProps) {
  const gradientId = useId();
  const shouldReduceMotion = useReducedMotion();

  // Parse estimated duration (e.g. "20 - 30 Mins" -> 25)
  const parseDurationMinutes = (timeStr: string): number => {
    const match = timeStr.match(/(\d+)/g);
    if (!match) return 25;
    if (match.length >= 2) {
      return Math.round((parseInt(match[0], 10) + parseInt(match[1], 10)) / 2);
    }
    return parseInt(match[0], 10);
  };

  const estimatedDuration = parseDurationMinutes(estimatedDeliveryTime);

  // Dynamic simulation ticker: advances visual interpolation smoothly based on authoritative timestamps
  const [simulation, setSimulation] = useState<SimulationState>(() =>
    calculateDeliverySimulation({
      status,
      statusUpdatedAt,
      dispatchedAt,
      estimatedDeliveryDurationMinutes: estimatedDuration,
      courierName
    })
  );

  useEffect(() => {
    // Initial immediate calculation
    setSimulation(
      calculateDeliverySimulation({
        status,
        statusUpdatedAt,
        dispatchedAt,
        estimatedDeliveryDurationMinutes: estimatedDuration,
        courierName
      })
    );

    // Only set an interval if actively en route (picked_up or out_for_delivery)
    if (status === 'picked_up' || status === 'out_for_delivery' || status === 'dispatched') {
      const interval = setInterval(() => {
        setSimulation(
          calculateDeliverySimulation({
            status,
            statusUpdatedAt,
            dispatchedAt,
            estimatedDeliveryDurationMinutes: estimatedDuration,
            courierName
          })
        );
      }, 4000); // Recalculate deterministic offset every 4 seconds

      return () => clearInterval(interval);
    }
  }, [status, statusUpdatedAt, dispatchedAt, estimatedDuration, courierName]);

  const {
    stage,
    stageLabel,
    headline,
    subtext,
    progressPercent,
    routeOffsetPercent,
    isAnimating,
    isDelayed,
    remainingMinutesText,
    isApproaching,
    isDelivered
  } = simulation;

  return (
    <div className="w-full rounded-luxury bg-white border border-brand-line/90 shadow-luxury overflow-hidden p-5 sm:p-8 space-y-7 transition-all">
      
      {/* 
        ========================================================================
        TOP BAR: BRAND STATUS, STAGE BADGE & AUTHORITATIVE ETA
        White base, Obsidian text, Gold accents, Cream tags
        ========================================================================
      */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-line/80 pb-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-brand-cream border border-brand-gold/30 text-brand-ink text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-gold inline-block" />
              {stageLabel}
            </span>
            <span className="text-[11px] text-brand-muted font-bold uppercase tracking-wider">
              Estimated Delivery Journey
            </span>
          </div>
          
          <h3 className="text-lg sm:text-2xl font-serif font-black text-brand-ink tracking-tight flex items-center gap-2.5">
            <span>{headline}</span>
            {isAnimating && !shouldReduceMotion && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-gold opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-gold" />
              </span>
            )}
          </h3>
          
          <p className="text-xs sm:text-sm text-brand-muted max-w-xl leading-relaxed">
            {subtext}
          </p>
        </div>

        {/* ETA & Prep Timing Card */}
        <div className="flex items-center gap-2 sm:self-start shrink-0">
          <div className="px-4 py-2.5 rounded-2xl bg-brand-cream/80 border border-brand-line text-right shadow-xs">
            <span className="text-[10px] uppercase font-bold text-brand-muted block tracking-wider">
              {isDelayed ? 'Updated Arrival' : 'Est. Arrival'}
            </span>
            <span className={`text-sm sm:text-base font-black flex items-center gap-1.5 justify-end font-mono ${
              isDelayed ? 'text-amber-700' : isDelivered ? 'text-emerald-700' : 'text-brand-ink'
            }`}>
              <Clock className="w-4 h-4 text-brand-gold" />
              <span>{isDelivered ? 'Arrived' : remainingMinutesText}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        ILLUSTRATED VECTOR ROUTE & CUSTOM COURIER (SVG/CSS)
        100% Client-side vector. Zero tiles, zero external API keys.
        ========================================================================
      */}
      <div className="relative py-6 sm:py-8 px-3 sm:px-6 bg-gradient-to-b from-brand-cream/50 via-white to-brand-cream/30 rounded-2xl border border-brand-line/80 shadow-inner">
        
        {/* Stage Timeline Badges */}
        <div className="flex items-center justify-between mb-4 px-1 text-[11px] font-bold text-brand-muted">
          <div className="flex items-center gap-1.5">
            <ChefHat className="w-3.5 h-3.5 text-brand-gold" />
            <span className="text-brand-ink font-extrabold">Jay’s Agbani Hub</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-brand-gold font-extrabold">{progressPercent}% Journey</span>
          </div>
          <div className="flex items-center gap-1.5 text-right">
            <MapPin className="w-3.5 h-3.5 text-brand-ink" />
            <span className="text-brand-ink font-extrabold truncate max-w-[140px] sm:max-w-[200px]">
              {destinationLandmark || zoneName}
            </span>
          </div>
        </div>

        {/* SVG Road & Visual Waypoint Nodes */}
        <div className="relative w-full h-32 sm:h-40 flex items-center justify-center overflow-visible">
          
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 600 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Active Golden Glow Gradient */}
              <linearGradient id={`goldGlow-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFB800" stopOpacity="0.95" />
                <stop offset="70%" stopColor="#FFB800" stopOpacity="1" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.95" />
              </linearGradient>

              {/* Road Drop Shadow */}
              <filter id={`shadow-${gradientId}`} x="-5%" y="-20%" width="110%" height="160%" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#17140D" floodOpacity="0.08" />
              </filter>
            </defs>

            {/* Base Scenic Road with Soft Shadow */}
            <path
              d="M 35,60 C 180,15 420,105 565,60"
              stroke="#F0E9D6"
              strokeWidth="16"
              strokeLinecap="round"
              filter={`url(#shadow-${gradientId})`}
            />

            {/* Road Asphalt Inner Core */}
            <path
              d="M 35,60 C 180,15 420,105 565,60"
              stroke="#FAF7EF"
              strokeWidth="10"
              strokeLinecap="round"
            />

            {/* Center Dashed Guidance Line */}
            <path
              d="M 35,60 C 180,15 420,105 565,60"
              stroke="#D6CDB8"
              strokeWidth="2"
              strokeDasharray="8 10"
              strokeLinecap="round"
            />

            {/* Active Traveled Progress Path */}
            <motion.path
              d="M 35,60 C 180,15 420,105 565,60"
              stroke={`url(#goldGlow-${gradientId})`}
              strokeWidth="8"
              strokeLinecap="round"
              initial={false}
              animate={{ pathLength: shouldReduceMotion ? progressPercent / 100 : progressPercent / 100 }}
              transition={{ duration: shouldReduceMotion ? 0 : 1.2, ease: 'easeOut' }}
            />

            {/* START WAYPOINT: Kitchen Hub */}
            <g transform="translate(35, 60)">
              <circle r="18" fill="#FFFFFF" stroke="#FFB800" strokeWidth="3" filter={`url(#shadow-${gradientId})`} />
              <circle r="8" fill="#17140D" />
              <circle r="4" fill="#FFB800" />
            </g>

            {/* END WAYPOINT: Customer Residence */}
            <g transform="translate(565, 60)">
              <circle
                r="18"
                fill="#FFFFFF"
                stroke={isDelivered ? '#10B981' : isApproaching ? '#FFB800' : '#D6CDB8'}
                strokeWidth="3"
                filter={`url(#shadow-${gradientId})`}
              />
              <circle
                r="8"
                fill={isDelivered ? '#10B981' : isApproaching ? '#17140D' : '#A8A29E'}
              />
              <circle
                r="4"
                fill={isDelivered ? '#FFFFFF' : isApproaching ? '#FFB800' : '#FAF7EF'}
              />
            </g>
          </svg>

          {/* 
            ====================================================================
            ILLUSTRATED MOTORCYCLE COURIER BADGE & FLOATING STATUS
            Custom SVG Courier Icon, hardware-accelerated transforms
            ====================================================================
          */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none z-20"
            style={{ left: `${routeOffsetPercent}%` }}
            animate={
              shouldReduceMotion
                ? { y: 0 }
                : {
                    y: isAnimating ? [-3, 3, -3] : [0, 0, 0]
                  }
            }
            transition={{
              duration: 2,
              repeat: isAnimating && !shouldReduceMotion ? Infinity : 0,
              ease: 'easeInOut'
            }}
          >
            <div className="relative -translate-x-1/2 -translate-y-2 flex flex-col items-center">
              
              {/* Dynamic En Route Status Capsule */}
              <div
                className={`mb-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  isDelivered
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : isApproaching
                    ? 'bg-amber-50 border-brand-gold text-brand-ink ring-2 ring-brand-gold/30'
                    : isAnimating
                    ? 'bg-brand-ink border-brand-gold text-brand-gold'
                    : 'bg-white border-brand-line text-brand-ink'
                }`}
              >
                {isDelivered ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Bike className="w-3.5 h-3.5 text-brand-gold" />
                )}
                <span>
                  {isDelivered
                    ? 'Arrived at Destination'
                    : isApproaching
                    ? 'Approaching Destination'
                    : isAnimating
                    ? 'En Route'
                    : stage === 4
                    ? 'Courier Assigned'
                    : 'Kitchen Preparing'}
                </span>
              </div>

              {/* Courier Illustrated Avatar Circle */}
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shadow-luxury border-2 transition-all ${
                  isDelivered
                    ? 'bg-emerald-600 text-white border-white ring-4 ring-emerald-500/20'
                    : 'bg-brand-ink text-brand-gold border-brand-gold ring-4 ring-brand-gold/25'
                }`}
              >
                {isDelivered ? (
                  <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
                ) : (
                  /* Custom Illustrated Courier Bike SVG */
                  <svg
                    className="w-7 h-7 sm:w-8 sm:h-8"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Front & Rear Wheels */}
                    <circle cx="7" cy="23" r="5" stroke="#FFB800" strokeWidth="2.5" />
                    <circle cx="25" cy="23" r="5" stroke="#FFB800" strokeWidth="2.5" />
                    <circle cx="7" cy="23" r="2" fill="#FFFFFF" />
                    <circle cx="25" cy="23" r="2" fill="#FFFFFF" />

                    {/* Motorcycle Frame & Chassis */}
                    <path
                      d="M7 23 L14 16 L20 16 L25 23 M14 16 L17 9 L22 9"
                      stroke="#FFB800"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Food Delivery Box (Insulated Gold Pack) */}
                    <rect
                      x="8"
                      y="11"
                      width="6"
                      height="6"
                      rx="1"
                      fill="#FFB800"
                      stroke="#FFFFFF"
                      strokeWidth="1"
                    />

                    {/* Rider Helmet / Head */}
                    <circle cx="17" cy="7" r="2.5" fill="#FFFFFF" />
                  </svg>
                )}
              </div>

              {/* Pulse glow indicator while en route */}
              {isAnimating && !shouldReduceMotion && (
                <div className="mt-1.5 w-2 h-2 rounded-full bg-brand-gold animate-ping" />
              )}
            </div>
          </motion.div>

        </div>

        {/* 
          Progress Indicator & Delay Warning 
        */}
        <div className="mt-3 space-y-2 px-1">
          <div className="w-full h-2.5 rounded-full bg-brand-line/70 overflow-hidden shadow-inner">
            <motion.div
              className={`h-full rounded-full ${
                isDelivered
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-brand-gold via-amber-400 to-emerald-500'
              }`}
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: shouldReduceMotion ? 0 : 1, ease: 'easeOut' }}
            />
          </div>

          {/* Traffic / Delay Notice if en route takes longer than estimated */}
          {isDelayed && !isDelivered && (
            <div className="mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="space-y-0.5">
                <span className="font-extrabold block">Live Traffic Notice:</span>
                <span>
                  Delivery is taking slightly longer than estimated due to corridor traffic. Your courier is actively moving toward your landmark.
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* 
        ========================================================================
        INFORMATION CARDS: DESTINATION, COURIER & TRANSPARENCY NOTICE
        Clean typography, Obsidian headings, Cream info pills
        ========================================================================
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        
        {/* Destination Card */}
        <div className="p-4 rounded-2xl bg-brand-cream/40 border border-brand-line space-y-1.5">
          <span className="text-[10px] uppercase font-black text-brand-muted tracking-wider flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-brand-gold" />
            <span>Delivery Destination</span>
          </span>
          <p className="font-bold text-brand-ink text-sm sm:text-base leading-snug truncate">
            {destinationAddress}
          </p>
          {destinationLandmark && (
            <p className="text-xs text-amber-800 font-medium truncate">
              Landmark: {destinationLandmark}
            </p>
          )}
        </div>

        {/* Courier Card */}
        <div className="p-4 rounded-2xl bg-brand-cream/40 border border-brand-line space-y-1.5">
          <span className="text-[10px] uppercase font-black text-brand-muted tracking-wider flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5 text-brand-gold" />
            <span>Assigned Fleet Rider</span>
          </span>
          <div className="flex items-center justify-between">
            <p className="font-bold text-brand-ink text-sm sm:text-base">
              {courierName}
            </p>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-cream border border-brand-line text-brand-ink font-bold">
              Enugu Express Fleet
            </span>
          </div>
          <p className="text-xs text-brand-muted">
            Dispatched from Agbani Kitchen Hub
          </p>
        </div>

      </div>

      {/* Customer Transparency Guarantee */}
      <div className="p-3.5 rounded-2xl bg-brand-cream/60 border border-brand-line text-xs text-brand-ink flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-extrabold text-brand-ink text-xs">
            Estimated Delivery Journey
          </p>
          <p className="text-[11px] text-brand-muted leading-relaxed">
            The illustrated courier journey depicts your estimated delivery progress based on kitchen readiness and authoritative dispatch timestamps. It does not track or collect continuous rider GPS. Delivery is verified securely upon face-to-face 6-digit OTP verification.
          </p>
        </div>
      </div>

    </div>
  );
}
