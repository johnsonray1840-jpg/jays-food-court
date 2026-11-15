/**
 * JAY'S FOOD COURT (JFC) - DYNAMIC KITCHEN PREPARATION TIME ENGINE
 * 
 * Accurately models and calculates culinary preparation times for Jay's Food Court kitchen.
 * 
 * Rules:
 * 1. Base preparation time per dish category and item type.
 * 2. Incremental scaling for item quantity and distinct dishes in the order.
 * 3. Concurrent kitchen queue burden (active cooking orders buffer).
 * 4. Kitchen operating status (Normal, Rush Hour, Kitchen Overloaded, Closed).
 * 5. Strictly forbids promising under 10 minutes UNLESS item is quick-serve (chilled drink/pre-steamed side)
 *    AND the kitchen workload is light.
 * 6. Explicitly distinguishes Food Preparation Time from Courier Delivery Transit Time.
 */

export interface KitchenOrderItem {
  id?: number | string;
  name?: string;
  cat?: string;
  qty: number;
}

export type KitchenOperatingStatus = 'normal' | 'rush_hour' | 'overloaded' | 'prep_only';

// Configured standard preparation baseline times in minutes
export const DISH_BASE_PREPARATION_MINUTES: Record<string, number> = {
  // Soups & Swallows: Needs fresh pot warming, swallow pounding/stirring & meat assortment plating
  'Royal Egusi Soup': 12,
  'Egusi Soup': 12,
  'Special Ogbono Soup': 12,
  'Ogbono Soup': 12,
  'Okro Draw Soup': 11,
  'Oha Soup': 12,
  'Bitter Leaf Soup': 12,
  
  // Rice Dishes: Seasoned firewood/wok portioning & protein crisping
  "Jay's Fried Rice Combo": 10,
  'Smoky Party Jollof Rice': 10,
  'Jollof Rice': 10,
  'Fried Rice': 10,
  'Basmati Rice': 12,
  'Assorted Native Rice': 12,
  'Coconut Rice': 12,
  'Spaghetti': 10,
  'White Rice & Stew': 8,

  // Yam & Sides
  'Boiled Yam & Spicy Egg Sauce': 10,
  'Yam and Egg Sauce': 10,
  'Moi Moi': 5,
  'Plantain (7 pieces)': 6,

  // Snacks & Shawarma
  'Classic Shawarma': 8,
  'Special Large Shawarma': 10,
  'Golden Meat Pie': 3,
  'Fresh Cupcake': 2,
  'Medium Celebration Cake': 5,
  'Big Celebration Cake': 5,
  'Small Crunchy Chin Chin': 2,
  'Big Crunchy Chin Chin': 2,

  // Drinks: Fast-serve cold cellar pull
  'Chilled Drinks & Zobo': 2,
  'Chilled Maltina / Soft Drinks': 2,
  'Default': 10
};

export const CATEGORY_BASE_PREPARATION_MINUTES: Record<string, number> = {
  'Soups & Swallows': 12,
  'Rice': 10,
  'Yam & Sides': 10,
  'Yam & Egg': 10,
  'Snacks & Shawarma': 6,
  'Drinks': 2,
  'Default': 10
};

export interface PrepEstimateCalculation {
  basePrepMinutes: number;
  itemVolumeBufferMinutes: number;
  activeQueueBufferMinutes: number;
  operatingStatusBufferMinutes: number;
  totalEstimatedMinutes: number;
  estimatedReadyTime: string; // ISO 8601 string
  displayEstimatedReadyTime: string; // e.g. "12 - 16 Mins"
  isFastTrack: boolean;
}

/**
 * Calculates dynamic kitchen preparation time based on configured items,
 * quantities, current concurrent active kitchen workload, and kitchen status.
 */
export function calculateDynamicPrepEstimate(
  items: KitchenOrderItem[],
  activeCookingOrdersCount: number = 0,
  operatingStatus: KitchenOperatingStatus = 'normal',
  orderPlacedAt: Date = new Date()
): PrepEstimateCalculation {
  if (!items || items.length === 0) {
    const mins = 10;
    const readyAt = new Date(orderPlacedAt.getTime() + mins * 60000);
    return {
      basePrepMinutes: mins,
      itemVolumeBufferMinutes: 0,
      activeQueueBufferMinutes: 0,
      operatingStatusBufferMinutes: 0,
      totalEstimatedMinutes: mins,
      estimatedReadyTime: readyAt.toISOString(),
      displayEstimatedReadyTime: '10 Mins',
      isFastTrack: false
    };
  }

  // 1. Calculate base prep time from highest base dish in order
  let highestBaseMinutes = 0;
  let allDrinks = true;
  let totalItemUnits = 0;

  for (const item of items) {
    totalItemUnits += Number(item.qty || 1);
    const dishName = item.name || '';
    const cat = item.cat || '';
    if (cat !== 'Drinks' && !dishName.toLowerCase().includes('drink') && !dishName.toLowerCase().includes('malt')) {
      allDrinks = false;
    }

    const dishBase = DISH_BASE_PREPARATION_MINUTES[dishName] || CATEGORY_BASE_PREPARATION_MINUTES[cat] || 10;
    if (dishBase > highestBaseMinutes) {
      highestBaseMinutes = dishBase;
    }
  }

  // 2. Incremental item volume scaling: +1.5 min per extra portion beyond 2 items
  const extraPortions = Math.max(0, totalItemUnits - 2);
  const itemVolumeBufferMinutes = Math.min(15, Math.ceil(extraPortions * 1.5));

  // 3. Concurrent kitchen queue burden: +2 mins per active order cooking currently in kitchen
  const queueLoad = Math.max(0, activeCookingOrdersCount);
  const activeQueueBufferMinutes = Math.min(20, queueLoad * 2);

  // 4. Kitchen operating status buffer
  let operatingStatusBufferMinutes = 0;
  if (operatingStatus === 'rush_hour') {
    operatingStatusBufferMinutes = 4;
  } else if (operatingStatus === 'overloaded') {
    operatingStatusBufferMinutes = 8;
  }

  let totalMinutes = highestBaseMinutes + itemVolumeBufferMinutes + activeQueueBufferMinutes + operatingStatusBufferMinutes;

  // Strict constraint: Do NOT promise under 10 minutes UNLESS it is purely chilled drinks/sides with zero queue burden
  if (totalMinutes < 10 && (!allDrinks || queueLoad > 0)) {
    totalMinutes = 10;
  } else if (allDrinks && queueLoad === 0) {
    totalMinutes = Math.max(3, highestBaseMinutes); // e.g. 3-5 mins for chilled bottled drinks
  }

  const isFastTrack = totalMinutes < 10;
  const readyAt = new Date(orderPlacedAt.getTime() + totalMinutes * 60000);
  const rangeMax = totalMinutes + Math.max(3, Math.ceil(totalMinutes * 0.25));

  return {
    basePrepMinutes: highestBaseMinutes,
    itemVolumeBufferMinutes,
    activeQueueBufferMinutes,
    operatingStatusBufferMinutes,
    totalEstimatedMinutes: totalMinutes,
    estimatedReadyTime: readyAt.toISOString(),
    displayEstimatedReadyTime: `${totalMinutes} - ${rangeMax} Mins`,
    isFastTrack
  };
}
