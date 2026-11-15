/**
 * JAY'S FOOD COURT (JFC) - ENUGU STATE DELIVERY ZONE REGISTRY
 *
 * Configurable delivery zones across the Enugu metropolitan & university corridor.
 * Allows staff to manage fees, minimum order amounts, and delivery availability
 * without rewriting the checkout engine.
 */

export interface EnuguDeliveryZone {
  id: string;
  name: string;
  city: string;
  state: 'Enugu';
  deliveryFee: number; // in NGN
  minOrderAmount: number; // in NGN
  estimatedTime: string; // e.g. "20 - 30 Mins"
  isAvailable: boolean;
  landmarks: string[];
}

export const ENUGU_DELIVERY_ZONES: EnuguDeliveryZone[] = [
  {
    id: 'zone_agbani_core',
    name: 'Agbani (Town & Ndiagu Ugwu)',
    city: 'Agbani',
    state: 'Enugu',
    deliveryFee: 500,
    minOrderAmount: 1500,
    estimatedTime: '15 - 25 Mins',
    isAvailable: true,
    landmarks: ['Ndiagu Ugwu', 'Agbani Market', 'Eke Agbani', 'Umuezeakwunanaw']
  },
  {
    id: 'zone_esut_campus',
    name: 'ESUT Agbani Campus',
    city: 'Agbani',
    state: 'Enugu',
    deliveryFee: 600,
    minOrderAmount: 1500,
    estimatedTime: '20 - 30 Mins',
    isAvailable: true,
    landmarks: ['ESUT Main Gate', 'Hostel Block A-D', 'Faculty of Law', 'Staff Quarters']
  },
  {
    id: 'zone_enugu_independence_layout',
    name: 'Independence Layout',
    city: 'Enugu Urban',
    state: 'Enugu',
    deliveryFee: 1500,
    minOrderAmount: 3000,
    estimatedTime: '35 - 50 Mins',
    isAvailable: true,
    landmarks: ['Government House', 'Bissala Road', 'Okpara Square', 'ESUT Business School']
  },
  {
    id: 'zone_enugu_gra',
    name: 'GRA (Government Reserved Area)',
    city: 'Enugu Urban',
    state: 'Enugu',
    deliveryFee: 1800,
    minOrderAmount: 3500,
    estimatedTime: '40 - 55 Mins',
    isAvailable: true,
    landmarks: ['Park Avenue', 'Polo Park Mall', 'State Secretariat', 'Rangers Avenue']
  },
  {
    id: 'zone_enugu_new_haven',
    name: 'New Haven',
    city: 'Enugu Urban',
    state: 'Enugu',
    deliveryFee: 1500,
    minOrderAmount: 3000,
    estimatedTime: '35 - 50 Mins',
    isAvailable: true,
    landmarks: ['Chime Avenue', 'Upper Chime', 'Ebeano Tunnel', 'New Haven Primary']
  },
  {
    id: 'zone_enugu_trans_ekulu',
    name: 'Trans-Ekulu & Thinkers Corner',
    city: 'Enugu Urban',
    state: 'Enugu',
    deliveryFee: 2000,
    minOrderAmount: 4000,
    estimatedTime: '45 - 60 Mins',
    isAvailable: true,
    landmarks: ['Damija', 'Nowas', 'Thinkers Corner', 'Godfrey Okoye University']
  },
  {
    id: 'zone_enugu_gariki_awkunanaw',
    name: 'Gariki & Awkunanaw',
    city: 'Enugu Urban',
    state: 'Enugu',
    deliveryFee: 1200,
    minOrderAmount: 2500,
    estimatedTime: '30 - 45 Mins',
    isAvailable: true,
    landmarks: ['Gariki Market', 'One Day Road', 'Topland', 'Amechi']
  },
  {
    id: 'zone_enugu_unec',
    name: 'UNEC & Ogui New Layout',
    city: 'Enugu Urban',
    state: 'Enugu',
    deliveryFee: 1500,
    minOrderAmount: 3000,
    estimatedTime: '35 - 50 Mins',
    isAvailable: true,
    landmarks: ['UNEC Campus Gate', 'Ogui Road', 'Stadium', 'Presidential Road']
  },
  {
    id: 'zone_enugu_emene',
    name: 'Emene & Airport Road',
    city: 'Emene',
    state: 'Enugu',
    deliveryFee: 2200,
    minOrderAmount: 4500,
    estimatedTime: '50 - 65 Mins',
    isAvailable: true,
    landmarks: ['Akanu Ibiam Airport', 'PRODA Road', 'Eke Obinagu', 'Caritas University']
  }
];

export function getDeliveryZoneById(zoneId?: string | null): EnuguDeliveryZone {
  if (!zoneId) return ENUGU_DELIVERY_ZONES[0];
  const found = ENUGU_DELIVERY_ZONES.find((z) => z.id === zoneId);
  return found || ENUGU_DELIVERY_ZONES[0];
}

export function matchDeliveryZoneByAddress(address: string): EnuguDeliveryZone {
  const normalized = address.toLowerCase();
  for (const zone of ENUGU_DELIVERY_ZONES) {
    if (normalized.includes(zone.name.toLowerCase()) || normalized.includes(zone.city.toLowerCase())) {
      return zone;
    }
    for (const lm of zone.landmarks) {
      if (normalized.includes(lm.toLowerCase())) {
        return zone;
      }
    }
  }
  // Default to primary Agbani kitchen hub
  return ENUGU_DELIVERY_ZONES[0];
}
