import { getSupabaseAdminClient } from './supabase/admin';
import { STATIC_MENU, CANONICAL_EXTRAS, STANDARD_DELIVERY_FEE, ONLINE_PROMO_DISCOUNT_PERCENT, getMenuItems } from './menu';
import { getDeliveryZoneById, matchDeliveryZoneByAddress } from './delivery-zones';
import { getEnuguZoneById, resolveZoneFromAddress } from './enugu-zones-service';
import { getCustomizationGroups, getCustomizationsForMeal } from './customizations-service';

export interface RawOrderItemPortion {
  id?: string;
  name: string;
  quantity: number;
}

export interface RawOrderItemProtein extends RawOrderItemPortion {}
export interface RawOrderItemSwallow extends RawOrderItemPortion {}
export interface RawOrderItemAddon extends RawOrderItemPortion {}

export interface RawOrderItemRequest {
  menuItemId?: string | number;
  menuId?: string | number; // Backward compatibility with cart line item
  name?: string; // Optional advisory name, IGNORED for pricing
  unit?: number; // IGNORED FOR PRICING
  qty?: number;
  quantity?: number;
  customizationOptionIds?: string[];
  extras?: string[]; // Backward compatibility with extra names
  proteins?: RawOrderItemProtein[]; // Flexible protein portions with independent quantities
  swallows?: RawOrderItemSwallow[]; // Flexible swallow portions (e.g. 3 wraps Eba, 1 Fufu)
  addons?: RawOrderItemAddon[]; // Reusable optional add-ons like Bottled Water
  swallow?: string | null;
  note?: string;
  notes?: string;
}

export interface ValidatedLineItem {
  menuItemId: string; // Database UUID
  legacyId?: number;
  itemName: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  customizations: {
    swallow?: string | null;
    options: { id?: string; name: string; price: number; quantity?: number }[];
    proteins?: { id?: string; name: string; unitPrice: number; quantity: number; subtotal: number }[];
    swallows?: { id?: string; name: string; unitPrice: number; quantity: number; subtotal: number }[];
    addons?: { id?: string; name: string; unitPrice: number; quantity: number; subtotal: number }[];
    totalCustomizationCharge: number;
  };
  notes?: string;
}

export interface AuthoritativePricingResult {
  items: ValidatedLineItem[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  estimatedDeliveryTime?: string;
  appliedPromo?: {
    code: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
  };
}

/**
 * SERVER-AUTHORITATIVE PRICING ENGINE
 * 
 * Retrieves live records from Supabase database (with resilient canonical fallback).
 * Calculates base meal prices, customization charges, quantities, subtotal, delivery fee,
 * and valid promotional discounts.
 * 
 * NEVER TRUSTS ANY TOTALS OR PRICES SUPPLIED BY THE BROWSER.
 */
export async function calculateServerAuthoritativeOrder(
  requestedItems: RawOrderItemRequest[],
  promoCode?: string,
  zoneIdOrAddress?: string
): Promise<AuthoritativePricingResult> {
  if (!requestedItems || requestedItems.length === 0) {
    throw new Error('Your cart bag cannot be empty.');
  }

  const supabase = getSupabaseAdminClient();

  // Try live database fetch if credentials configured
  let dbMenuItems: any[] = [];
  let dbOptions: any[] = [];
  let dbGroups: any[] = [];
  let dbItemGroupLinks: any[] = [];
  let dbPromo: any = null;
  let dbDeliveryFee = STANDARD_DELIVERY_FEE;

  if (supabase) {
    try {
      const [itemsRes, optsRes, groupsRes, linksRes, promoRes, settingsRes] = await Promise.all([
        supabase.from('menu_items').select('id, legacy_id, name, base_price, is_available'),
        supabase.from('customization_options').select('id, group_id, name, additional_price, is_available'),
        supabase.from('customization_groups').select('id, name'),
        supabase.from('menu_item_customization_groups').select('menu_item_id, group_id'),
        supabase.from('promotions').select('*').eq('is_active', true),
        supabase.from('restaurant_settings').select('*').eq('key', 'delivery_config').maybeSingle()
      ]);

      if (itemsRes.data && itemsRes.data.length > 0) dbMenuItems = itemsRes.data;
      if (optsRes.data && optsRes.data.length > 0) dbOptions = optsRes.data;
      if (groupsRes.data && groupsRes.data.length > 0) dbGroups = groupsRes.data;
      if (linksRes.data && linksRes.data.length > 0) dbItemGroupLinks = linksRes.data;

      if (promoRes.data && promoRes.data.length > 0 && promoCode) {
        dbPromo = promoRes.data.find(
          (p: any) => p.code.toUpperCase() === promoCode.trim().toUpperCase() && p.is_active
        );
      }

      if (settingsRes.data?.value?.flat_fee) {
        dbDeliveryFee = Number(settingsRes.data.value.flat_fee);
      }
    } catch (err) {
      console.warn('Supabase pricing query failed, falling back to canonical pricing matrix', err);
    }
  }

  const CANONICAL_SWALLOWS = ['Pounded Yam', 'Yellow Garri (Eba)', 'Semovita', 'Eba', 'Fufu'];
  const swallowGroup = dbGroups.find((g: any) => String(g.name).toLowerCase().includes('swallow'));

  // Fallback map builders
  const validatedItems: ValidatedLineItem[] = [];
  let calculatedSubtotal = 0;

  for (const raw of requestedItems) {
    const rawId = raw.menuItemId ?? raw.menuId;
    const qty = Math.max(1, Math.min(50, Number(raw.quantity ?? raw.qty ?? 1)));
    const notes = (raw.notes || raw.note || '').trim().slice(0, 200) || undefined;

    // 1. Resolve menu item from Supabase or Static Catalog
    let resolvedItem: { id: string; legacyId?: number; name: string; basePrice: number; isAvailable: boolean } | null = null;

    if (dbMenuItems.length > 0) {
      const found = dbMenuItems.find(
        (m: any) => m.id === String(rawId) || String(m.legacy_id) === String(rawId)
      );
      if (found) {
        resolvedItem = {
          id: found.id,
          legacyId: found.legacy_id,
          name: found.name,
          basePrice: Number(found.base_price),
          isAvailable: found.is_available
        };
      }
    }

    if (!resolvedItem) {
      // Check local dynamic menu store first before static fallback
      const localMenu = await getMenuItems();
      const localFound = localMenu.find(
        (m) => String(m.id) === String(rawId)
      );
      if (localFound) {
        resolvedItem = {
          id: `m0000000-0000-0000-0000-00000000000${localFound.id}`,
          legacyId: localFound.id,
          name: localFound.name,
          basePrice: localFound.price,
          isAvailable: localFound.available
        };
      } else {
        const staticFound = STATIC_MENU.find(
          (m) => String(m.id) === String(rawId)
        );
        if (staticFound) {
          resolvedItem = {
            id: `m0000000-0000-0000-0000-00000000000${staticFound.id}`,
            legacyId: staticFound.id,
            name: staticFound.name,
            basePrice: staticFound.price,
            isAvailable: staticFound.available
          };
        }
      }
    }

    if (!resolvedItem) {
      throw new Error(`Menu dish reference #${rawId} does not exist in our restaurant catalog.`);
    }

    if (!resolvedItem.isAvailable) {
      throw new Error(`"${resolvedItem.name}" is currently sold out and cannot be ordered.`);
    }

    // 2. Resolve & Strictly Validate Customizations, Swallows & Additional Proteins
    const configuredGroups = getCustomizationGroups();
    const mealConfiguredGroups = getCustomizationsForMeal(rawId ?? 0);
    const configuredPermittedGroupIds = new Set(mealConfiguredGroups.map((g) => g.id));
    const permittedGroupIds =
      dbItemGroupLinks.length > 0
        ? new Set([
            ...dbItemGroupLinks
              .filter((link: any) => link.menu_item_id === resolvedItem!.id)
              .map((link: any) => link.group_id),
            ...configuredPermittedGroupIds
          ])
        : configuredPermittedGroupIds.size > 0
        ? configuredPermittedGroupIds
        : null;

    let validatedSwallow: string | null = null;
    const hasFlexibleSwallows = Array.isArray(raw.swallows) && raw.swallows.length > 0;

    if (typeof raw.swallow === 'string' && raw.swallow.trim() !== '') {
      let swallowInput = raw.swallow.trim();

      // If raw.swallows array is provided, let flexible swallow validation govern portions,
      // or extract the canonical name if formatted like "1x Pounded Yam" or "1x Pounded Yam, 1x Eba"
      if (hasFlexibleSwallows) {
        // Strip leading multiplier like "1x " or take first item for label fallback
        const firstSegment = swallowInput.split(',')[0].trim();
        swallowInput = firstSegment.replace(/^\d+x\s*/i, '').trim();
      } else {
        // Even without swallows array, handle "1x Pounded Yam" gracefully
        swallowInput = swallowInput.replace(/^\d+x\s*/i, '').trim();
      }

      let matchedSwallow: { name: string; groupId?: string; isAvailable: boolean } | null = null;

      if (dbOptions.length > 0) {
        const foundSwallowOpt = dbOptions.find(
          (o: any) =>
            (o.id === swallowInput || o.name.toLowerCase() === swallowInput.toLowerCase()) &&
            (!swallowGroup || o.group_id === swallowGroup.id)
        );
        if (foundSwallowOpt) {
          matchedSwallow = {
            name: foundSwallowOpt.name,
            groupId: foundSwallowOpt.group_id,
            isAvailable: foundSwallowOpt.is_available
          };
        }
      }
      
      if (!matchedSwallow) {
        const canonicalSwallow = CANONICAL_SWALLOWS.find(
          (s) => s.toLowerCase() === swallowInput.toLowerCase()
        );
        if (canonicalSwallow) {
          matchedSwallow = { name: canonicalSwallow, isAvailable: true };
        }
      }

      if (!matchedSwallow && !hasFlexibleSwallows) {
        throw new Error(`Invalid swallow customization "${raw.swallow}" for "${resolvedItem.name}".`);
      }

      if (matchedSwallow) {
        if (!matchedSwallow.isAvailable) {
          throw new Error(`Swallow option "${matchedSwallow.name}" is currently unavailable.`);
        }
        if (permittedGroupIds && matchedSwallow.groupId && !permittedGroupIds.has(matchedSwallow.groupId)) {
          throw new Error(`"${resolvedItem.name}" does not accept swallow selection "${matchedSwallow.name}".`);
        }

        // If item is not in Soups & Swallows category (e.g. drinks, yam, rice), reject swallow
        const staticItem = STATIC_MENU.find((m) => m.name.toLowerCase() === resolvedItem!.name.toLowerCase() || String(m.id) === String(rawId));
        if (staticItem && !staticItem.swallow) {
          throw new Error(`"${resolvedItem.name}" does not accept swallow selection "${matchedSwallow.name}".`);
        }

        validatedSwallow = matchedSwallow.name;
      }
    }

    const requestedOptionIdentifiers: string[] = [
      ...(raw.customizationOptionIds || []),
      ...(raw.extras || [])
    ];

    let customizationCharges = 0;
    const validatedOptionRecords: { id?: string; name: string; price: number; quantity?: number }[] = [];
    const validatedProteins: { id?: string; name: string; unitPrice: number; quantity: number; subtotal: number }[] = [];
    const validatedSwallows: { id?: string; name: string; unitPrice: number; quantity: number; subtotal: number }[] = [];
    const validatedAddons: { id?: string; name: string; unitPrice: number; quantity: number; subtotal: number }[] = [];

    const resolveCustomOption = (optIdentifier: string) => {
      let resolvedOpt: { id?: string; groupId?: string; name: string; price: number; isAvailable: boolean } | null = null;
      
      // Check dynamic configured groups first
      for (const grp of configuredGroups) {
        const found = grp.options.find(
          (o) => o.id === optIdentifier || o.name.toLowerCase() === optIdentifier.toLowerCase()
        );
        if (found) {
          resolvedOpt = {
            id: found.id,
            groupId: found.groupId,
            name: found.name,
            price: Number(found.additionalPrice),
            isAvailable: found.isAvailable
          };
          break;
        }
      }

      if (!resolvedOpt && dbOptions.length > 0) {
        const foundOpt = dbOptions.find(
          (o: any) => o.id === optIdentifier || o.name.toLowerCase() === optIdentifier.toLowerCase()
        );
        if (foundOpt) {
          resolvedOpt = {
            id: foundOpt.id,
            groupId: foundOpt.group_id,
            name: foundOpt.name,
            price: Number(foundOpt.additional_price),
            isAvailable: foundOpt.is_available
          };
        }
      }
      if (!resolvedOpt && CANONICAL_EXTRAS[optIdentifier] !== undefined) {
        resolvedOpt = {
          name: optIdentifier,
          price: CANONICAL_EXTRAS[optIdentifier],
          isAvailable: true
        };
      }
      return resolvedOpt;
    };

    // 1. Process flexible swallow portions (e.g. Eba: 3 wraps, Pounded Yam: 1 wrap)
    // Rule: If item accepts swallow (e.g. Soups), first wrap of default/first swallow may be included
    // or charged according to portion configuration.
    if (raw.swallows && Array.isArray(raw.swallows) && raw.swallows.length > 0) {
      // Validate item accepts swallow
      const staticItem = STATIC_MENU.find((m) => m.name.toLowerCase() === resolvedItem!.name.toLowerCase() || String(m.id) === String(rawId));
      if (staticItem && !staticItem.swallow) {
        throw new Error(`"${resolvedItem.name}" does not accept swallow selections.`);
      }

      // Calculate total swallow wraps requested and assert limits
      let totalWraps = 0;
      for (const sw of raw.swallows) {
        const q = Number(sw.quantity);
        if (isNaN(q) || q < 0) {
          throw new Error('Swallow quantity cannot be negative.');
        }
        totalWraps += Math.max(0, Math.floor(q));
      }

      if (totalWraps > 20) {
        throw new Error(`Requested swallow quantity (${totalWraps}) exceeds maximum limit of 20 wraps per dish.`);
      }

      // Default free swallow wrap included with soup meals: 1 wrap
      let freeWrapsRemaining = (staticItem && staticItem.swallow) ? 1 : 0;

      for (const swallowReq of raw.swallows) {
        const swallowName = (swallowReq.name || '').trim();
        const rawQty = Number(swallowReq.quantity);
        if (isNaN(rawQty) || rawQty < 0) {
          throw new Error('Option quantity cannot be negative.');
        }
        const swallowQty = Math.floor(rawQty);
        if (!swallowName || swallowQty <= 0) continue;

        if (swallowQty > 20) {
          throw new Error(`Quantity for swallow "${swallowName}" exceeds maximum limit of 20 wraps.`);
        }

        const resolvedOpt = resolveCustomOption(swallowReq.id || swallowName);
        if (!resolvedOpt) {
          throw new Error(`Invalid swallow option "${swallowName}".`);
        }
        if (!resolvedOpt.isAvailable) {
          throw new Error(`Swallow option "${resolvedOpt.name}" is currently unavailable.`);
        }

        // Apply free wrap allowance if available
        let payableWraps = swallowQty;
        if (freeWrapsRemaining > 0) {
          const discountCount = Math.min(payableWraps, freeWrapsRemaining);
          payableWraps -= discountCount;
          freeWrapsRemaining -= discountCount;
        }

        const swallowSubtotal = resolvedOpt.price * payableWraps;
        customizationCharges += swallowSubtotal;

        validatedSwallows.push({
          id: resolvedOpt.id,
          name: resolvedOpt.name,
          unitPrice: resolvedOpt.price,
          quantity: swallowQty,
          subtotal: swallowSubtotal
        });

        validatedOptionRecords.push({
          id: resolvedOpt.id,
          name: `${swallowQty}x ${resolvedOpt.name}`,
          price: swallowSubtotal,
          quantity: swallowQty
        });
      }

      if (validatedSwallows.length > 0) {
        validatedSwallow = validatedSwallows.map((s) => `${s.quantity}x ${s.name}`).join(', ');
      }
    }

    // 2. Process flexible protein portions if provided
    if (raw.proteins && Array.isArray(raw.proteins)) {
      for (const proteinReq of raw.proteins) {
        const proteinName = (proteinReq.name || '').trim();
        const rawQty = Number(proteinReq.quantity);
        if (isNaN(rawQty) || rawQty < 0) {
          throw new Error('Protein quantity cannot be negative.');
        }
        const proteinQty = Math.floor(rawQty);
        if (!proteinName || proteinQty <= 0) continue;

        if (proteinQty > 20) {
          throw new Error(`Quantity for protein "${proteinName}" exceeds maximum limit of 20 pieces.`);
        }

        const resolvedOpt = resolveCustomOption(proteinReq.id || proteinName);
        if (!resolvedOpt) {
          throw new Error(`Invalid protein customization option "${proteinName}".`);
        }
        if (!resolvedOpt.isAvailable) {
          throw new Error(`Protein option "${resolvedOpt.name}" is currently unavailable.`);
        }
        if (permittedGroupIds && resolvedOpt.groupId && !permittedGroupIds.has(resolvedOpt.groupId)) {
          throw new Error(`Protein "${resolvedOpt.name}" is not valid for "${resolvedItem.name}".`);
        }

        const proteinSubtotal = resolvedOpt.price * proteinQty;
        customizationCharges += proteinSubtotal;

        validatedProteins.push({
          id: resolvedOpt.id,
          name: resolvedOpt.name,
          unitPrice: resolvedOpt.price,
          quantity: proteinQty,
          subtotal: proteinSubtotal
        });

        // Also add to options for backward compatibility
        validatedOptionRecords.push({
          id: resolvedOpt.id,
          name: `${proteinQty}x ${resolvedOpt.name}`,
          price: proteinSubtotal,
          quantity: proteinQty
        });
      }
    }

    // 3. Process optional reusable add-ons (e.g. Bottled Water)
    if (raw.addons && Array.isArray(raw.addons)) {
      for (const addonReq of raw.addons) {
        const addonName = (addonReq.name || '').trim();
        const rawQty = Number(addonReq.quantity);
        if (isNaN(rawQty) || rawQty < 0) {
          throw new Error('Add-on quantity cannot be negative.');
        }
        const addonQty = Math.floor(rawQty);
        if (!addonName || addonQty <= 0) continue;

        if (addonQty > 30) {
          throw new Error(`Quantity for add-on "${addonName}" exceeds maximum limit of 30.`);
        }

        const resolvedOpt = resolveCustomOption(addonReq.id || addonName);
        if (!resolvedOpt) {
          throw new Error(`Invalid add-on option "${addonName}".`);
        }
        if (!resolvedOpt.isAvailable) {
          throw new Error(`Add-on option "${resolvedOpt.name}" is currently unavailable.`);
        }

        const addonSubtotal = resolvedOpt.price * addonQty;
        customizationCharges += addonSubtotal;

        validatedAddons.push({
          id: resolvedOpt.id,
          name: resolvedOpt.name,
          unitPrice: resolvedOpt.price,
          quantity: addonQty,
          subtotal: addonSubtotal
        });

        validatedOptionRecords.push({
          id: resolvedOpt.id,
          name: `${addonQty}x ${resolvedOpt.name}`,
          price: addonSubtotal,
          quantity: addonQty
        });
      }
    }

    // 4. Process standard single extras / customizations
    for (const rawOptIdentifier of requestedOptionIdentifiers) {
      const optIdentifier = typeof rawOptIdentifier === 'string' ? rawOptIdentifier.trim() : '';
      if (!optIdentifier) {
        throw new Error('Empty customization identifier is not permitted.');
      }

      // Check if this option was already counted in proteins, swallows, or addons
      const alreadyHandled = (
        validatedProteins.some((p) => p.name.toLowerCase() === optIdentifier.toLowerCase() || p.id === optIdentifier) ||
        validatedSwallows.some((s) => s.name.toLowerCase() === optIdentifier.toLowerCase() || s.id === optIdentifier) ||
        validatedAddons.some((a) => a.name.toLowerCase() === optIdentifier.toLowerCase() || a.id === optIdentifier)
      );
      if (alreadyHandled) continue;

      const resolvedOpt = resolveCustomOption(optIdentifier);

      if (!resolvedOpt) {
        throw new Error(`Invalid customization option "${optIdentifier}".`);
      }

      if (!resolvedOpt.isAvailable) {
        throw new Error(`Customization option "${resolvedOpt.name}" is currently unavailable.`);
      }

      if (permittedGroupIds && resolvedOpt.groupId && !permittedGroupIds.has(resolvedOpt.groupId)) {
        throw new Error(`Customization "${resolvedOpt.name}" is not valid for "${resolvedItem.name}".`);
      }

      customizationCharges += resolvedOpt.price;
      validatedOptionRecords.push({
        id: resolvedOpt.id,
        name: resolvedOpt.name,
        price: resolvedOpt.price
      });
    }

    // 3. Exact line calculations
    const unitPrice = resolvedItem.basePrice + customizationCharges;
    const lineTotal = unitPrice * qty;
    calculatedSubtotal += lineTotal;

    validatedItems.push({
      menuItemId: resolvedItem.id,
      legacyId: resolvedItem.legacyId,
      itemName: resolvedItem.name,
      basePrice: resolvedItem.basePrice,
      unitPrice,
      quantity: qty,
      lineTotal,
      customizations: {
        swallow: validatedSwallow,
        options: validatedOptionRecords,
        proteins: validatedProteins,
        swallows: validatedSwallows,
        addons: validatedAddons,
        totalCustomizationCharge: customizationCharges
      },
      notes
    });
  }

  // 4. Calculate Promotional Discount (Authoritative)
  // Strict rule: Discounts are only applied when a verified, active promotional code is provided.
  // Never apply fabricated or automatic 30% discounts.
  let discountAmount = 0;
  let appliedPromo: AuthoritativePricingResult['appliedPromo'] = undefined;

  if (promoCode && dbPromo && dbPromo.is_active) {
    if (dbPromo.discount_type === 'percentage') {
      discountAmount = Math.round(calculatedSubtotal * (Number(dbPromo.discount_value) / 100));
    } else if (dbPromo.discount_type === 'fixed_amount') {
      discountAmount = Math.min(calculatedSubtotal, Number(dbPromo.discount_value));
    }
    appliedPromo = {
      code: dbPromo.code,
      discountType: dbPromo.discount_type,
      discountValue: Number(dbPromo.discount_value)
    };
  }

  // 5. Final Payable Calculation
  let deliveryFee = dbDeliveryFee;

  if (zoneIdOrAddress) {
    const matchedZone = zoneIdOrAddress.startsWith('zone_')
      ? getEnuguZoneById(zoneIdOrAddress)
      : resolveZoneFromAddress(zoneIdOrAddress);

    if (matchedZone) {
      if (matchedZone.isActive === false) {
        throw new Error(`Delivery to ${matchedZone.name} is currently suspended.`);
      }

      if (calculatedSubtotal < matchedZone.minOrderAmount) {
        throw new Error(`Minimum food order for delivery to ${matchedZone.name} is ₦${matchedZone.minOrderAmount.toLocaleString()}.`);
      }

      deliveryFee = matchedZone.deliveryFee;
    }
  }

  const totalAmount = Math.max(0, calculatedSubtotal - discountAmount + deliveryFee);

  return {
    items: validatedItems,
    subtotal: calculatedSubtotal,
    discountAmount,
    deliveryFee,
    totalAmount,
    estimatedDeliveryTime: zoneIdOrAddress?.startsWith('zone_') ? getEnuguZoneById(zoneIdOrAddress).estimatedTime : '18 - 25 Mins',
    appliedPromo
  };
}
