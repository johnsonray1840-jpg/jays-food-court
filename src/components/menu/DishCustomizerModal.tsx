'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  MenuItem,
  SwallowOption,
  CartLineItem,
  SelectedProteinItem,
  SelectedSwallowItem,
  SelectedAddonItem
} from '@/types';
import { formatNaira } from '@/lib/utils';
import { X, Check, Circle, Plus, Minus, Info, Sparkles, AlertCircle } from 'lucide-react';
import { CustomizationGroupConfig } from '@/lib/customizations-service';

interface DishModalProps {
  dish: MenuItem | null;
  onClose: () => void;
  onAddToCart: (item: CartLineItem) => void;
}

export function DishCustomizerModal({ dish, onClose, onAddToCart }: DishModalProps) {
  // Configured groups fetched dynamically for this dish
  const [customizationGroups, setCustomizationGroups] = useState<CustomizationGroupConfig[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  // Selected state:
  // - For quantity groups: map [optionId] -> quantity
  // - For single selection groups: map [groupId] -> optionId
  // - For multiple checkbox groups: map [groupId] -> Set(optionId)
  const [quantitySelections, setQuantitySelections] = useState<Record<string, number>>({});
  const [singleSelections, setSingleSelections] = useState<Record<string, string>>({});
  const [multiSelections, setMultiSelections] = useState<Record<string, string[]>>({});

  const [quantity, setQuantity] = useState(1);
  const [specialNotes, setSpecialNotes] = useState('');

  // Fetch meal-specific customization groups
  useEffect(() => {
    if (!dish) return;

    let isMounted = true;
    setIsLoadingGroups(true);

    fetch(`/api/menu/${dish.id}/customizations`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        const groups: CustomizationGroupConfig[] = data?.groups || [];
        setCustomizationGroups(groups);

        // Initialize selections according to group rules
        const initialQty: Record<string, number> = {};
        const initialSingle: Record<string, string> = {};
        const initialMulti: Record<string, string[]> = {};

        groups.forEach((grp) => {
          if (grp.selectionType === 'quantity') {
            // If swallow group on soup, default 1 wrap of Pounded Yam (or first available option)
            if (grp.id === 'grp_swallow_selection' && dish.swallow) {
              const defaultOpt = grp.options.find((o) => o.name === 'Pounded Yam' && o.isAvailable) || grp.options.find((o) => o.isAvailable);
              if (defaultOpt) {
                initialQty[defaultOpt.id] = 1;
              }
            }
          } else if (grp.selectionType === 'single') {
            // Pre-select first available option
            const firstAvail = grp.options.find((o) => o.isAvailable);
            if (firstAvail) {
              initialSingle[grp.id] = firstAvail.id;
            }
          } else if (grp.selectionType === 'multiple') {
            initialMulti[grp.id] = [];
          }
        });

        setQuantitySelections(initialQty);
        setSingleSelections(initialSingle);
        setMultiSelections(initialMulti);
        setQuantity(1);
        setSpecialNotes('');
      })
      .catch((err) => {
        console.error('Error fetching customizations for meal:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingGroups(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dish]);

  if (!dish) return null;

  if (!dish.available) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-xs" />
        <div className="relative w-full max-w-sm bg-white rounded-3xl p-6 text-center space-y-4 z-10 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-black">
            ✕
          </div>
          <div>
            <h4 className="font-extrabold text-base text-brand-ink">{dish.name}</h4>
            <p className="text-xs text-zinc-500 mt-1">
              This dish is currently sold out and cannot be added to your order bag.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-full bg-zinc-900 text-white font-bold text-xs"
          >
            Choose Another Dish
          </button>
        </div>
      </div>
    );
  }

  // Handle Stepper Changes
  const handleUpdateQtyOption = (
    groupId: string,
    optionId: string,
    delta: number,
    minQty: number,
    maxQty: number,
    groupMax: number
  ) => {
    setQuantitySelections((prev) => {
      const current = prev[optionId] || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));

      // Check group-wide max constraint
      if (delta > 0) {
        const grp = customizationGroups.find((g) => g.id === groupId);
        if (grp) {
          const totalInGroup = grp.options.reduce((sum, o) => sum + (o.id === optionId ? next : (prev[o.id] || 0)), 0);
          if (totalInGroup > groupMax) {
            return prev; // Exceeds group maximum
          }
        }
      }

      const updated = { ...prev };
      if (next === 0) {
        delete updated[optionId];
      } else {
        updated[optionId] = next;
      }
      return updated;
    });
  };

  // Handle Single Choice Radio
  const handleSelectSingleOption = (groupId: string, optionId: string) => {
    setSingleSelections((prev) => ({
      ...prev,
      [groupId]: optionId
    }));
  };

  // Handle Multi Checkboxes
  const handleToggleMultiOption = (groupId: string, optionId: string, groupMax: number) => {
    setMultiSelections((prev) => {
      const currentList = prev[groupId] || [];
      if (currentList.includes(optionId)) {
        return {
          ...prev,
          [groupId]: currentList.filter((id) => id !== optionId)
        };
      } else {
        if (currentList.length >= groupMax) return prev;
        return {
          ...prev,
          [groupId]: [...currentList, optionId]
        };
      }
    });
  };

  // ----------------------------------------------------
  // Authoritative Pricing & Subtotal Calculations
  // ----------------------------------------------------
  let customizationSubtotal = 0;
  const activeCustomizationsBreakdown: {
    groupName: string;
    optionName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    isFree?: boolean;
  }[] = [];

  const swallowList: SelectedSwallowItem[] = [];
  const proteinList: SelectedProteinItem[] = [];
  const addonList: SelectedAddonItem[] = [];

  // Evaluate each configured group
  customizationGroups.forEach((grp) => {
    if (grp.selectionType === 'quantity') {
      // Free included quantity logic (e.g. 1 included wrap for soup swallows)
      let freeAllowanceRemaining = grp.includedQuantity || 0;

      grp.options.forEach((opt) => {
        const selectedCount = quantitySelections[opt.id] || 0;
        if (selectedCount <= 0) return;

        let billableQty = selectedCount;
        let isFreePortion = false;

        if (freeAllowanceRemaining > 0) {
          const freeApplied = Math.min(billableQty, freeAllowanceRemaining);
          billableQty -= freeApplied;
          freeAllowanceRemaining -= freeApplied;
          if (billableQty === 0) isFreePortion = true;
        }

        const optCost = billableQty * opt.additionalPrice;
        customizationSubtotal += optCost;

        activeCustomizationsBreakdown.push({
          groupName: grp.name,
          optionName: opt.name,
          quantity: selectedCount,
          unitPrice: opt.additionalPrice,
          subtotal: optCost,
          isFree: isFreePortion && optCost === 0
        });

        // Group into semantic categories for backward compatibility
        if (grp.id === 'grp_swallow_selection') {
          swallowList.push({ name: opt.name, quantity: selectedCount, unitPrice: opt.additionalPrice });
        } else if (grp.id === 'grp_protein_selection') {
          proteinList.push({ name: opt.name, quantity: selectedCount, unitPrice: opt.additionalPrice });
        } else {
          addonList.push({ name: opt.name, quantity: selectedCount, unitPrice: opt.additionalPrice });
        }
      });
    } else if (grp.selectionType === 'single') {
      const selectedOptId = singleSelections[grp.id];
      const opt = grp.options.find((o) => o.id === selectedOptId);
      if (opt && opt.isAvailable) {
        const optCost = opt.additionalPrice || 0;
        customizationSubtotal += optCost;
        if (optCost > 0 || opt.name !== 'Regular Portion') {
          activeCustomizationsBreakdown.push({
            groupName: grp.name,
            optionName: opt.name,
            quantity: 1,
            unitPrice: opt.additionalPrice,
            subtotal: optCost
          });
        }
      }
    } else if (grp.selectionType === 'multiple') {
      const selectedIds = multiSelections[grp.id] || [];
      selectedIds.forEach((sId) => {
        const opt = grp.options.find((o) => o.id === sId);
        if (opt && opt.isAvailable) {
          const optCost = opt.additionalPrice || 0;
          customizationSubtotal += optCost;
          activeCustomizationsBreakdown.push({
            groupName: grp.name,
            optionName: opt.name,
            quantity: 1,
            unitPrice: opt.additionalPrice,
            subtotal: optCost
          });
          addonList.push({ name: opt.name, quantity: 1, unitPrice: opt.additionalPrice });
        }
      });
    }
  });

  // Check required group validations
  let validationError: string | null = null;
  for (const grp of customizationGroups) {
    if (grp.isRequired) {
      if (grp.selectionType === 'quantity') {
        const totalQty = grp.options.reduce((sum, o) => sum + (quantitySelections[o.id] || 0), 0);
        if (totalQty < Math.max(1, grp.minSelectable)) {
          validationError = `Please select at least ${Math.max(1, grp.minSelectable)} option for "${grp.name}".`;
          break;
        }
      } else if (grp.selectionType === 'single') {
        if (!singleSelections[grp.id]) {
          validationError = `Please choose your preferred "${grp.name}".`;
          break;
        }
      } else if (grp.selectionType === 'multiple') {
        const chosen = multiSelections[grp.id] || [];
        if (chosen.length < grp.minSelectable) {
          validationError = `Please choose at least ${grp.minSelectable} "${grp.name}".`;
          break;
        }
      }
    }
  }

  const mealUnitPrice = dish.price + customizationSubtotal;
  const orderTotal = mealUnitPrice * quantity;

  // Add to Cart Action
  const handleAddMealToCart = () => {
    if (validationError) return;

    // Build structured breakdown & unique key
    const swallowSummary = swallowList.map((s) => `${s.quantity}x ${s.name}`).join(', ');
    const extrasDisplay = activeCustomizationsBreakdown.map((item) =>
      item.quantity > 1 ? `${item.quantity}x ${item.optionName}` : item.optionName
    );

    const configKey = [
      dish.id,
      ...activeCustomizationsBreakdown.map((b) => `${b.optionName}:${b.quantity}`),
      specialNotes.trim()
    ].join('|');

    onAddToCart({
      key: configKey,
      id: dish.id,
      name: dish.name,
      img: `/images/${dish.img}.jpg`,
      unit: mealUnitPrice,
      qty: quantity,
      swallow: (swallowSummary as any) || null,
      extras: extrasDisplay,
      proteins: proteinList,
      swallows: swallowList,
      addons: addonList,
      note: specialNotes.trim() || undefined
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity" />

      {/* Modal Dialog Sheet (Mobile-First, Chowdeck-Style) */}
      <div className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-3xl overflow-hidden shadow-2xl z-10 max-h-[92vh] flex flex-col animate-in fade-in slide-in-from-bottom-8 duration-300">
        
        {/* Mobile Drag Indicator */}
        <div className="w-full flex justify-center py-2 sm:hidden bg-brand-cream/60 border-b border-brand-line/50">
          <div className="w-12 h-1.5 rounded-full bg-zinc-300" />
        </div>

        {/* Visual Hero Image & Close */}
        <div className="relative h-44 sm:h-52 w-full bg-brand-cream shrink-0">
          <Image
            src={`/images/${dish.img}.jpg`}
            alt={dish.name}
            fill
            sizes="(max-width: 640px) 100vw, 512px"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center shadow-lg transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Title & Base Price Overlay */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-gold text-zinc-950 text-[10px] font-black uppercase tracking-wider inline-block mb-1 shadow-xs">
              {dish.cat}
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-black text-lg sm:text-xl leading-tight truncate drop-shadow-sm">
                {dish.name}
              </h3>
              <span className="font-extrabold text-brand-gold text-base sm:text-lg shrink-0">
                {formatNaira(dish.price)}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Meal Description */}
          {dish.desc && (
            <p className="text-xs sm:text-sm text-brand-muted leading-relaxed">
              {dish.desc}
            </p>
          )}

          {/* Loading Groups State */}
          {isLoadingGroups ? (
            <div className="py-8 text-center text-xs text-zinc-400 space-y-2">
              <div className="w-6 h-6 border-2 border-brand-gold border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading chef&apos;s customization choices...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {customizationGroups.map((group) => {
                const isGroupQuantity = group.selectionType === 'quantity';
                const isGroupSingle = group.selectionType === 'single';
                const isGroupMultiple = group.selectionType === 'multiple';

                const totalGroupQty = isGroupQuantity
                  ? group.options.reduce((sum, o) => sum + (quantitySelections[o.id] || 0), 0)
                  : 0;

                return (
                  <section
                    key={group.id}
                    className="p-4 rounded-2xl bg-brand-cream/40 border border-brand-line space-y-3"
                  >
                    {/* Group Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-xs sm:text-sm text-brand-ink">
                            {group.name}
                          </h4>
                          {group.isRequired ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-900 border border-amber-500/30">
                              Required
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-500">
                              Optional
                            </span>
                          )}
                          {group.includedQuantity > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                              {group.includedQuantity} Included Free
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-[11px] text-zinc-500 mt-0.5">{group.description}</p>
                        )}
                      </div>

                      {/* Group Count Badge */}
                      {isGroupQuantity && (
                        <span className="text-xs font-black text-brand-goldDark bg-white px-2.5 py-1 rounded-full border border-brand-line shadow-2xs">
                          {totalGroupQty} / {group.maxSelectable}
                        </span>
                      )}
                    </div>

                    {/* Group Options List */}
                    <div className="divide-y divide-brand-line/60">
                      {group.options.map((opt) => {
                        const optQty = quantitySelections[opt.id] || 0;
                        const isSelectedRadio = singleSelections[group.id] === opt.id;
                        const isCheckedBox = (multiSelections[group.id] || []).includes(opt.id);

                        return (
                          <div
                            key={opt.id}
                            className={`py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 ${
                              !opt.isAvailable ? 'opacity-50 pointer-events-none' : ''
                            }`}
                          >
                            {/* Option Meta */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-brand-ink truncate">
                                  {opt.name}
                                </span>
                                {!opt.isAvailable && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 text-red-600">
                                    Sold Out
                                  </span>
                                )}
                              </div>
                              {opt.desc && (
                                <p className="text-[11px] text-brand-muted line-clamp-1 mt-0.5">{opt.desc}</p>
                              )}
                              <span className="text-xs font-extrabold text-amber-900 mt-0.5 block">
                                {opt.additionalPrice > 0 ? `+${formatNaira(opt.additionalPrice)}` : 'Included in base price'}
                              </span>
                            </div>

                            {/* Option Control based on Selection Type */}
                            {isGroupQuantity && (
                              <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-full border border-brand-line shadow-2xs shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateQtyOption(
                                      group.id,
                                      opt.id,
                                      -1,
                                      opt.minQuantity,
                                      opt.maxQuantity,
                                      group.maxSelectable
                                    )
                                  }
                                  disabled={optQty === 0}
                                  className="w-7 h-7 rounded-full bg-brand-cream/80 hover:bg-brand-cream text-brand-ink flex items-center justify-center font-black text-xs disabled:opacity-30 active:scale-95 transition"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-5 text-center font-black text-xs text-brand-ink">
                                  {optQty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateQtyOption(
                                      group.id,
                                      opt.id,
                                      1,
                                      opt.minQuantity,
                                      opt.maxQuantity,
                                      group.maxSelectable
                                    )
                                  }
                                  disabled={totalGroupQty >= group.maxSelectable}
                                  className="w-7 h-7 rounded-full bg-brand-gold hover:bg-brand-goldDark text-zinc-950 flex items-center justify-center font-black text-xs disabled:opacity-30 active:scale-95 transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}

                            {isGroupSingle && (
                              <button
                                type="button"
                                onClick={() => handleSelectSingleOption(group.id, opt.id)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                                  isSelectedRadio
                                    ? 'border-brand-gold bg-brand-gold text-zinc-950'
                                    : 'border-zinc-300 bg-white'
                                }`}
                              >
                                {isSelectedRadio && <div className="w-2 h-2 rounded-full bg-zinc-950" />}
                              </button>
                            )}

                            {isGroupMultiple && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleMultiOption(group.id, opt.id, group.maxSelectable)
                                }
                                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition ${
                                  isCheckedBox
                                    ? 'border-brand-gold bg-brand-gold text-zinc-950'
                                    : 'border-zinc-300 bg-white'
                                }`}
                              >
                                {isCheckedBox && <Check className="w-4 h-4 stroke-[3]" />}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {/* Kitchen Special Instructions */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-brand-ink">
              Special Kitchen Note (Optional)
            </label>
            <input
              type="text"
              maxLength={150}
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              placeholder="e.g. Please pack soup and swallow in separate bowls"
              className="w-full py-2.5 px-3.5 rounded-2xl bg-brand-cream/60 border border-brand-line text-xs text-brand-ink placeholder:text-zinc-400 outline-none focus:border-brand-gold focus:bg-white transition"
            />
          </div>

          {/* Live Order Breakdown Summary Panel */}
          {activeCustomizationsBreakdown.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-950">
                <span>Selected Portions & Extras</span>
                <span>+{formatNaira(customizationSubtotal)}</span>
              </div>
              <div className="space-y-1">
                {activeCustomizationsBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] text-amber-900">
                    <span>
                      {item.quantity}x {item.optionName} {item.isFree && <span className="text-emerald-700 font-bold">(Included)</span>}
                    </span>
                    <span>{item.subtotal > 0 ? formatNaira(item.subtotal) : '₦0'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Warning Alert */}
          {validationError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Bottom Floating Action Bar with Continuous Price & Stepper */}
        <div className="p-4 sm:p-5 bg-white border-t border-brand-line/80 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            {/* Meal Quantity Stepper */}
            <div className="flex items-center gap-3 bg-brand-cream px-3 py-1.5 rounded-full border border-brand-line">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-black text-sm shadow-2xs active:scale-90 transition"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-extrabold text-sm text-brand-ink min-w-[20px] text-center">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                aria-label="Increase quantity"
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-black text-sm shadow-2xs active:scale-90 transition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Total Display */}
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">
                Total Price
              </span>
              <span className="font-black text-lg sm:text-xl text-brand-ink">
                {formatNaira(orderTotal)}
              </span>
            </div>
          </div>

          {/* Add to Bag Button */}
          <button
            type="button"
            onClick={handleAddMealToCart}
            disabled={Boolean(validationError) || isLoadingGroups}
            className="w-full py-3.5 rounded-full bg-brand-gold hover:bg-brand-goldDark text-zinc-950 font-black text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            <span>Add to Cart • {formatNaira(orderTotal)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
