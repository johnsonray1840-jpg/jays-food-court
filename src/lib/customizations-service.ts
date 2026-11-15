import fs from 'fs';
import path from 'path';
import { getSupabaseAdminClient } from './supabase/admin';

export interface CustomizationOptionConfig {
  id: string;
  groupId: string;
  name: string;
  additionalPrice: number;
  isAvailable: boolean;
  minQuantity: number;
  maxQuantity: number;
  displayOrder: number;
  desc?: string;
}

export interface CustomizationGroupConfig {
  id: string;
  name: string;
  description?: string;
  selectionType: 'single' | 'multiple' | 'quantity'; // single choice (radio), multi-checkbox, or quantity stepper
  minSelectable: number;
  maxSelectable: number;
  includedQuantity: number; // e.g. 1 free wrap for soups
  isRequired: boolean;
  allowMultipleCombinations: boolean; // Combine multiple items in group
  displayOrder: number;
  options: CustomizationOptionConfig[];
}

export interface MealCustomizationLink {
  mealId: number; // legacy_id (or meal UUID)
  groupIds: string[];
}

const CUSTOMIZATIONS_DATA_FILE = path.join(process.cwd(), 'data', 'customizations.json');
const MEAL_GROUP_LINKS_FILE = path.join(process.cwd(), 'data', 'meal_customization_links.json');

// Initial Default Customization Groups & Options for Jay's Food Court
export const DEFAULT_CUSTOMIZATION_GROUPS: CustomizationGroupConfig[] = [
  {
    id: 'grp_swallow_selection',
    name: 'Swallow Selection',
    description: 'Hot authentic wraps freshly prepared. 1 wrap is included with soup dishes.',
    selectionType: 'quantity',
    minSelectable: 1,
    maxSelectable: 10,
    includedQuantity: 1,
    isRequired: true,
    allowMultipleCombinations: true,
    displayOrder: 1,
    options: [
      { id: 'opt_pounded_yam', groupId: 'grp_swallow_selection', name: 'Pounded Yam', additionalPrice: 500, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 1, desc: 'Smooth, stretchy authentic pounded yam' },
      { id: 'opt_eba', groupId: 'grp_swallow_selection', name: 'Eba', additionalPrice: 300, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 2, desc: 'Hot yellow garri cooked to soft perfection' },
      { id: 'opt_semovita', groupId: 'grp_swallow_selection', name: 'Semovita', additionalPrice: 400, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 3, desc: 'Fluffy golden semolina wrap' },
      { id: 'opt_fufu', groupId: 'grp_swallow_selection', name: 'Fufu', additionalPrice: 300, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 4, desc: 'Traditional fermented cassava fufu' }
    ]
  },
  {
    id: 'grp_protein_selection',
    name: 'Protein Selection',
    description: 'Slow-cooked assorted meats, fish, and savory proteins.',
    selectionType: 'quantity',
    minSelectable: 0,
    maxSelectable: 20,
    includedQuantity: 0,
    isRequired: false,
    allowMultipleCombinations: true,
    displayOrder: 2,
    options: [
      { id: 'opt_beef', groupId: 'grp_protein_selection', name: 'Beef', additionalPrice: 500, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 1, desc: 'Tender seasoned bite-sized beef' },
      { id: 'opt_stockfish', groupId: 'grp_protein_selection', name: 'Stockfish', additionalPrice: 700, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 2, desc: 'Aromatic Norwegian okporoko stockfish' },
      { id: 'opt_goat_meat', groupId: 'grp_protein_selection', name: 'Goat Meat', additionalPrice: 900, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 3, desc: 'Slow-braised spiced local chevon' },
      { id: 'opt_chicken', groupId: 'grp_protein_selection', name: 'Chicken', additionalPrice: 800, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 4, desc: 'Golden crispy fried seasoned chicken' },
      { id: 'opt_assorted_beef', groupId: 'grp_protein_selection', name: 'Extra Assorted Beef', additionalPrice: 1200, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 5, desc: 'Assorted shaki, cow leg and beef cuts' },
      { id: 'opt_fresh_catfish', groupId: 'grp_protein_selection', name: 'Fresh Catfish / Titus Fish', additionalPrice: 1800, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 6, desc: 'Fresh fish steak in rich broth' },
      { id: 'opt_fried_plantain', groupId: 'grp_protein_selection', name: 'Fried Plantain (Dodo)', additionalPrice: 500, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 7, desc: 'Sweet golden ripe plantain slices' },
      { id: 'opt_boiled_egg', groupId: 'grp_protein_selection', name: 'Boiled Egg', additionalPrice: 300, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 8, desc: 'Hard-boiled farm egg' }
    ]
  },
  {
    id: 'grp_drinks_beverages',
    name: 'Drinks & Beverages',
    description: 'Chilled spring water, juices and cold refreshments.',
    selectionType: 'quantity',
    minSelectable: 0,
    maxSelectable: 20,
    includedQuantity: 0,
    isRequired: false,
    allowMultipleCombinations: true,
    displayOrder: 3,
    options: [
      { id: 'opt_bottled_water', groupId: 'grp_drinks_beverages', name: 'Bottled Water', additionalPrice: 250, isAvailable: true, minQuantity: 0, maxQuantity: 20, displayOrder: 1, desc: 'Pure chilled 75cl bottled spring water' },
      { id: 'opt_chilled_coke', groupId: 'grp_drinks_beverages', name: 'Chilled Coca-Cola (50cl)', additionalPrice: 400, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 2, desc: 'Ice-cold classic Coca-Cola pet bottle' },
      { id: 'opt_zobo_drink', groupId: 'grp_drinks_beverages', name: 'Fresh Hibiscus Zobo Drink', additionalPrice: 600, isAvailable: true, minQuantity: 0, maxQuantity: 10, displayOrder: 3, desc: 'Spiced natural hibiscus infusion with ginger & cloves' }
    ]
  },
  {
    id: 'grp_portion_size',
    name: 'Portion Size',
    description: 'Select your preferred meal serving size.',
    selectionType: 'single',
    minSelectable: 1,
    maxSelectable: 1,
    includedQuantity: 1,
    isRequired: false,
    allowMultipleCombinations: false,
    displayOrder: 4,
    options: [
      { id: 'opt_portion_regular', groupId: 'grp_portion_size', name: 'Regular Portion', additionalPrice: 0, isAvailable: true, minQuantity: 1, maxQuantity: 1, displayOrder: 1, desc: 'Standard single satisfying serving' },
      { id: 'opt_portion_large', groupId: 'grp_portion_size', name: 'Large Double Portion', additionalPrice: 1500, isAvailable: true, minQuantity: 1, maxQuantity: 1, displayOrder: 2, desc: 'Generous double serving with extra sauce' }
    ]
  },
  {
    id: 'grp_prep_style',
    name: 'Preparation Style',
    description: 'Customize spice level and cooking preference.',
    selectionType: 'single',
    minSelectable: 0,
    maxSelectable: 1,
    includedQuantity: 1,
    isRequired: false,
    allowMultipleCombinations: false,
    displayOrder: 5,
    options: [
      { id: 'opt_prep_mild', groupId: 'grp_prep_style', name: 'Mild Spice', additionalPrice: 0, isAvailable: true, minQuantity: 1, maxQuantity: 1, displayOrder: 1, desc: 'Subtle peppers and balanced herbs' },
      { id: 'opt_prep_hot', groupId: 'grp_prep_style', name: 'Extra Spicy Firewood', additionalPrice: 0, isAvailable: true, minQuantity: 1, maxQuantity: 1, displayOrder: 2, desc: 'Traditional authentic high heat' }
    ]
  }
];

// Default Linkages:
// - Soups (1, 2, 3, 4, 5): Swallow Selection, Protein Selection, Drinks & Beverages, Prep Style
// - Rice (6, 7, 8, 9, 10, 11, 12): Protein Selection, Drinks & Beverages, Portion Size, Prep Style
// - Yam & Sides (13, 14, 15, 16): Protein Selection, Drinks & Beverages
// - Snacks & Drinks (17..24): Drinks & Beverages
export const DEFAULT_MEAL_GROUP_LINKS: MealCustomizationLink[] = [
  // Soups & Swallows
  { mealId: 1, groupIds: ['grp_swallow_selection', 'grp_protein_selection', 'grp_drinks_beverages', 'grp_prep_style'] },
  { mealId: 2, groupIds: ['grp_swallow_selection', 'grp_protein_selection', 'grp_drinks_beverages', 'grp_prep_style'] },
  { mealId: 3, groupIds: ['grp_swallow_selection', 'grp_protein_selection', 'grp_drinks_beverages', 'grp_prep_style'] },
  { mealId: 4, groupIds: ['grp_swallow_selection', 'grp_protein_selection', 'grp_drinks_beverages', 'grp_prep_style'] },
  { mealId: 5, groupIds: ['grp_swallow_selection', 'grp_protein_selection', 'grp_drinks_beverages', 'grp_prep_style'] },
  // Rice
  { mealId: 6, groupIds: ['grp_protein_selection', 'grp_drinks_beverages', 'grp_portion_size', 'grp_prep_style'] },
  { mealId: 7, groupIds: ['grp_protein_selection', 'grp_drinks_beverages', 'grp_portion_size', 'grp_prep_style'] },
  { mealId: 8, groupIds: ['grp_protein_selection', 'grp_drinks_beverages', 'grp_portion_size', 'grp_prep_style'] },
  { mealId: 9, groupIds: ['grp_protein_selection', 'grp_drinks_beverages', 'grp_portion_size', 'grp_prep_style'] },
  { mealId: 10, groupIds: ['grp_protein_selection', 'grp_drinks_beverages', 'grp_portion_size', 'grp_prep_style'] },
  { mealId: 11, groupIds: ['grp_protein_selection', 'grp_drinks_beverages', 'grp_portion_size', 'grp_prep_style'] },
  { mealId: 12, groupIds: ['grp_protein_selection', 'grp_drinks_beverages', 'grp_portion_size', 'grp_prep_style'] },
  // Yam & Sides
  { mealId: 13, groupIds: ['grp_protein_selection', 'grp_drinks_beverages'] },
  { mealId: 14, groupIds: ['grp_protein_selection', 'grp_drinks_beverages'] },
  { mealId: 15, groupIds: ['grp_protein_selection', 'grp_drinks_beverages'] },
  { mealId: 16, groupIds: ['grp_protein_selection', 'grp_drinks_beverages'] },
  // Snacks & Bakery
  { mealId: 17, groupIds: ['grp_drinks_beverages'] },
  { mealId: 18, groupIds: ['grp_drinks_beverages'] },
  { mealId: 19, groupIds: ['grp_drinks_beverages'] },
  { mealId: 20, groupIds: ['grp_drinks_beverages'] },
  { mealId: 21, groupIds: ['grp_drinks_beverages'] },
  { mealId: 22, groupIds: ['grp_drinks_beverages'] },
  { mealId: 23, groupIds: ['grp_drinks_beverages'] },
  { mealId: 24, groupIds: ['grp_drinks_beverages'] }
];

export function getCustomizationGroups(): CustomizationGroupConfig[] {
  try {
    if (fs.existsSync(CUSTOMIZATIONS_DATA_FILE)) {
      const content = fs.readFileSync(CUSTOMIZATIONS_DATA_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      }
    }
  } catch (err) {
    console.error('Error reading customizations.json:', err);
  }
  return DEFAULT_CUSTOMIZATION_GROUPS;
}

export function saveCustomizationGroups(groups: CustomizationGroupConfig[]) {
  try {
    fs.writeFileSync(CUSTOMIZATIONS_DATA_FILE, JSON.stringify(groups, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving customizations.json:', err);
    throw new Error('Failed to persist customization groups configuration.');
  }
}

export function getMealGroupLinks(): MealCustomizationLink[] {
  try {
    if (fs.existsSync(MEAL_GROUP_LINKS_FILE)) {
      const content = fs.readFileSync(MEAL_GROUP_LINKS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading meal_customization_links.json:', err);
  }
  return DEFAULT_MEAL_GROUP_LINKS;
}

export function saveMealGroupLinks(links: MealCustomizationLink[]) {
  try {
    fs.writeFileSync(MEAL_GROUP_LINKS_FILE, JSON.stringify(links, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving meal_customization_links.json:', err);
    throw new Error('Failed to persist meal customization links.');
  }
}

/**
 * Retrieves the full customization configuration for a specific meal.
 */
export function getCustomizationsForMeal(mealId: number | string): CustomizationGroupConfig[] {
  const allGroups = getCustomizationGroups();
  const allLinks = getMealGroupLinks();
  const idNum = Number(mealId);

  const matchedLink = allLinks.find((l) => l.mealId === idNum);
  if (!matchedLink || !matchedLink.groupIds || matchedLink.groupIds.length === 0) {
    // If no explicit link is registered, apply default category heuristic:
    // Soups: Swallow + Proteins + Drinks
    // Others: Proteins + Drinks
    return allGroups.filter((g) => g.id !== 'grp_swallow_selection');
  }

  const linkedSet = new Set(matchedLink.groupIds);
  return allGroups
    .filter((g) => linkedSet.has(g.id))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
}

/**
 * Updates groups attached to a meal.
 */
export function setMealGroups(mealId: number, groupIds: string[]) {
  const allLinks = getMealGroupLinks();
  const existingIndex = allLinks.findIndex((l) => l.mealId === mealId);

  if (existingIndex >= 0) {
    allLinks[existingIndex].groupIds = groupIds;
  } else {
    allLinks.push({ mealId, groupIds });
  }

  saveMealGroupLinks(allLinks);
}
