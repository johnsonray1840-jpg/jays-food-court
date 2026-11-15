export type Category = 'All' | 'Soups & Swallows' | 'Rice' | 'Yam & Sides' | 'Snacks & Shawarma' | 'Drinks';

export type SwallowOption = 'Pounded Yam' | 'Eba' | 'Yellow Garri (Eba)' | 'Fufu' | 'Semovita';

export interface ExtraProtein {
  name: string;
  price: number;
}

export interface SelectedPortionItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface SelectedProteinItem extends SelectedPortionItem {}
export interface SelectedSwallowItem extends SelectedPortionItem {}
export interface SelectedAddonItem extends SelectedPortionItem {}

export interface MenuItem {
  id: number;
  name: string;
  desc: string;
  price: number;
  cat: Category;
  img: string;
  rating: string;
  swallow: boolean;
  available: boolean;
  priceLastChangedAt?: string;
  priceLastChangedBy?: string;
  // Meal customization configuration
  freeSwallowCount?: number; // E.g. 1 included with soup meals
  allowSwallow?: boolean;
}

export interface CartLineItem {
  key: string;
  id: number;
  name: string;
  img: string;
  unit: number;
  qty: number;
  swallow?: SwallowOption | null;
  extras: string[];
  proteins?: SelectedProteinItem[];
  swallows?: SelectedSwallowItem[];
  addons?: SelectedAddonItem[];
  note?: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'assigned_to_rider'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'cooking' // Legacy alias for preparing
  | 'dispatched'; // Legacy alias for out_for_delivery

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  fromStatus?: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: 'customer' | 'kitchen_staff' | 'rider' | 'manager' | 'admin' | 'system';
  actorId?: string | null;
  riderId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface StructuredDeliveryAddress {
  recipientName: string;
  phone: string;
  state: 'Enugu';
  area: string; // e.g. "Independence Layout", "Agbani", "GRA"
  streetAddress: string;
  buildingNumber?: string;
  landmark?: string;
  deliveryInstructions?: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  geocodingResult?: string;
  confirmedAt: string;
}

export interface Order {
  id: string;
  createdAt: string;
  customerName: string;
  phone: string;
  address: string;
  deliveryDetails?: StructuredDeliveryAddress;
  items: CartLineItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  paymentMode: 'online' | 'transfer' | 'card' | 'cod';
  status: OrderStatus;
  eta: string;
  deliveryOtp?: string;
  assignedRiderId?: string | null;
  estimatedPrepMinutes?: number;
  estimatedReadyTime?: string; // ISO 8601 timestamp
  prepStartedAt?: string;
  prepReadyAt?: string;
  prepDelayReason?: string;
  prepAdjustedBy?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryLandmark?: string;
  deliveryZoneId?: string;
  rider?: {
    name: string;
    phone: string;
    rating?: string;
  } | null;
}
