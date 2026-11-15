/**
 * JAY'S FOOD COURT (JFC) - ENUGU STATE GEOLOCATION & DELIVERY PRICING ENGINE
 *
 * Provides Chowdeck-grade location-aware delivery calculations across ALL corners of Enugu State.
 * Includes kitchen hub origin, zone polygon bounding/nearest landmarks, and distance-based fees.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Kitchen Hub: Ndiagu Ugwu, Agbani, Enugu
export const JFC_KITCHEN_COORDINATES: Coordinates = {
  latitude: 6.3150,
  longitude: 7.5500
};

// Enugu State Geographic Bounding Box (Agbani, Nsukka, 9th Mile, Awgu, Udi, Oji River, Enugu Urban)
export const ENUGU_BOUNDS = {
  minLat: 5.90, // Southern Enugu border (Awgu/Aninri)
  maxLat: 7.15, // Northern Enugu border (Nsukka/Udenu)
  minLng: 7.05, // Western Enugu border (Oji River/Udi)
  maxLng: 7.85  // Eastern Enugu border (Nkanu East/Isi-Uzo)
};

export interface EnuguLocationZone {
  id: string;
  name: string;
  city: string;
  center: Coordinates;
  deliveryFee: number; // in NGN
  minOrderAmount: number; // in NGN
  estimatedTime: string;
  popularLandmarks: string[];
  isActive?: boolean;
  maxDeliveryRadiusKm?: number;
  adminNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  lastModifiedBy?: string;
  previousDeliveryFee?: number;
}

export const ENUGU_LOCATION_ZONES: EnuguLocationZone[] = [
  // 1. Agbani Core Hub (Instant Delivery)
  {
    id: 'zone_agbani_core',
    name: 'Agbani (Town & Ndiagu Ugwu)',
    city: 'Agbani',
    center: { latitude: 6.3150, longitude: 7.5500 },
    deliveryFee: 500,
    minOrderAmount: 1500,
    estimatedTime: '15 - 25 Mins',
    popularLandmarks: ['Ndiagu Ugwu', 'Eke Agbani Market', 'Umuezeakwunanaw', 'Agbani Health Centre']
  },
  {
    id: 'zone_esut_campus',
    name: 'ESUT Campus Agbani',
    city: 'Agbani',
    center: { latitude: 6.3195, longitude: 7.5570 },
    deliveryFee: 600,
    minOrderAmount: 1500,
    estimatedTime: '20 - 30 Mins',
    popularLandmarks: ['ESUT Main Gate', 'Hostel Blocks A-E', 'Faculty of Law', 'Faculty of Engineering', 'School of Postgraduate Studies']
  },
  {
    id: 'zone_agbani_periphery',
    name: 'Amodu & Akpugo Axis',
    city: 'Nkanu West',
    center: { latitude: 6.3300, longitude: 7.5700 },
    deliveryFee: 800,
    minOrderAmount: 2000,
    estimatedTime: '25 - 35 Mins',
    popularLandmarks: ['Akpugo High School', 'Amodu Junction', 'Obuoffia', 'Amagunze Link']
  },

  // 2. Enugu Urban Corridor
  {
    id: 'zone_enugu_gariki_awkunanaw',
    name: 'Gariki & Awkunanaw',
    city: 'Enugu South',
    center: { latitude: 6.3980, longitude: 7.5020 },
    deliveryFee: 1200,
    minOrderAmount: 2500,
    estimatedTime: '30 - 45 Mins',
    popularLandmarks: ['Gariki Market', 'One Day Road', 'Topland', 'Amechi Uno', 'St. Mary Catholic Church']
  },
  {
    id: 'zone_enugu_uwani_achara',
    name: 'Uwani & Achara Layout',
    city: 'Enugu South',
    center: { latitude: 6.4210, longitude: 7.5010 },
    deliveryFee: 1300,
    minOrderAmount: 2500,
    estimatedTime: '30 - 45 Mins',
    popularLandmarks: ['Robinson Street', 'Zik Avenue', 'Mayor Bus Stop', 'Idaw River', 'Ebenator St']
  },
  {
    id: 'zone_enugu_independence_layout',
    name: 'Independence Layout',
    city: 'Enugu North',
    center: { latitude: 6.4420, longitude: 7.5140 },
    deliveryFee: 1500,
    minOrderAmount: 3000,
    estimatedTime: '35 - 50 Mins',
    popularLandmarks: ['Government House (Lion Building)', 'Okpara Square', 'Bissala Road', 'ESUT Business School', 'WAEC Office']
  },
  {
    id: 'zone_enugu_gra',
    name: 'GRA (Government Reserved Area)',
    city: 'Enugu North',
    center: { latitude: 6.4520, longitude: 7.5080 },
    deliveryFee: 1800,
    minOrderAmount: 3500,
    estimatedTime: '40 - 55 Mins',
    popularLandmarks: ['Polo Park Mall', 'Park Avenue', 'Rangers Avenue', 'State Secretariat', 'Enugu Golf Course']
  },
  {
    id: 'zone_enugu_new_haven',
    name: 'New Haven',
    city: 'Enugu North',
    center: { latitude: 6.4470, longitude: 7.5250 },
    deliveryFee: 1500,
    minOrderAmount: 3000,
    estimatedTime: '35 - 50 Mins',
    popularLandmarks: ['Chime Avenue', 'Upper Chime', 'Ebeano Tunnel', 'New Haven Market', 'Dental Clinic']
  },
  {
    id: 'zone_enugu_ogui_unec',
    name: 'Ogui, Asata & UNEC Campus',
    city: 'Enugu North',
    center: { latitude: 6.4350, longitude: 7.5080 },
    deliveryFee: 1400,
    minOrderAmount: 2500,
    estimatedTime: '35 - 45 Mins',
    popularLandmarks: ['UNEC Campus Gate', 'Ogui Road', 'Nnamdi Azikiwe Stadium', 'Presidential Road', 'Holy Ghost Cathedral']
  },
  {
    id: 'zone_enugu_trans_ekulu',
    name: 'Trans-Ekulu & Thinkers Corner',
    city: 'Enugu East',
    center: { latitude: 6.4710, longitude: 7.5240 },
    deliveryFee: 1900,
    minOrderAmount: 4000,
    estimatedTime: '45 - 60 Mins',
    popularLandmarks: ['Damija Junction', 'Nowas Bus Stop', 'Godfrey Okoye University', 'Thinkers Corner', 'Phase 6']
  },
  {
    id: 'zone_enugu_abakpa',
    name: 'Abakpa Nike & Federal Housing',
    city: 'Enugu East',
    center: { latitude: 6.4780, longitude: 7.5350 },
    deliveryFee: 2000,
    minOrderAmount: 4000,
    estimatedTime: '45 - 60 Mins',
    popularLandmarks: ['Abakpa Market', 'Liberty Bus Stop', 'Federal Housing Estate', 'T-Junction', 'Nike Lake Resort Road']
  },
  {
    id: 'zone_enugu_emene',
    name: 'Emene & Airport Corridor',
    city: 'Enugu East',
    center: { latitude: 6.4670, longitude: 7.5850 },
    deliveryFee: 2200,
    minOrderAmount: 4500,
    estimatedTime: '50 - 65 Mins',
    popularLandmarks: ['Akanu Ibiam International Airport', 'PRODA', 'Eke Obinagu', 'Caritas University', 'Innoson Hub']
  },
  {
    id: 'zone_enugu_coal_camp',
    name: 'Coal Camp & Ngwo Axis',
    city: 'Enugu North',
    center: { latitude: 6.4310, longitude: 7.4850 },
    deliveryFee: 1600,
    minOrderAmount: 3000,
    estimatedTime: '40 - 55 Mins',
    popularLandmarks: ['Coal Camp Spare Parts Market', 'Onyeama Mine Rd', 'Ngwo Junction', 'St. Theresa']
  },
  {
    id: 'zone_enugu_ninth_mile',
    name: '9th Mile Corner & Ngwo',
    city: 'Udi',
    center: { latitude: 6.4250, longitude: 7.4120 },
    deliveryFee: 2500,
    minOrderAmount: 5000,
    estimatedTime: '55 - 75 Mins',
    popularLandmarks: ['9th Mile Corner', '7Up Bottling Plant', 'Ama Breweries', 'Ngwo Pine Forest']
  },
  {
    id: 'zone_enugu_nsukka',
    name: 'Nsukka Urban & UNN Campus',
    city: 'Nsukka',
    center: { latitude: 6.8560, longitude: 7.3950 },
    deliveryFee: 3500,
    minOrderAmount: 6000,
    estimatedTime: '70 - 90 Mins',
    popularLandmarks: ['UNN Main Gate', 'Odenigwe', 'Total Roundabout', 'Ogige Market', 'University Road']
  }
];

/**
 * Haversine formula: Computes great-circle distance between two GPS coordinates in kilometers.
 */
export function calculateHaversineDistanceKm(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth radius in km
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Validates whether GPS coordinates fall within Enugu State territory.
 */
export function isCoordinateWithinEnugu(coords: Coordinates): boolean {
  return (
    coords.latitude >= ENUGU_BOUNDS.minLat &&
    coords.latitude <= ENUGU_BOUNDS.maxLat &&
    coords.longitude >= ENUGU_BOUNDS.minLng &&
    coords.longitude <= ENUGU_BOUNDS.maxLng
  );
}

export interface ZoneServiceValidation {
  isServiceable: boolean;
  unserviceableReason?: string;
  matchedZone?: EnuguLocationZone;
  distanceKm?: number;
}

/**
 * Validates whether a specific location coordinate is practically serviceable
 * by Jay's Food Court couriers from the Agbani kitchen hub.
 * Max practical radius is 75km (encompassing all 15 metropolitan and regional Enugu zones).
 */
export function validateLocationServiceability(
  coords?: Coordinates | null,
  zoneId?: string | null
): ZoneServiceValidation {
  if (!coords) {
    if (zoneId) {
      const found = ENUGU_LOCATION_ZONES.find((z) => z.id === zoneId);
      if (found && found.isActive !== false) {
        return { isServiceable: true, matchedZone: found };
      }
    }
    return {
      isServiceable: false,
      unserviceableReason: 'Please select or confirm your delivery location on the map.'
    };
  }

  // 1. Strict Enugu State Geospatial Bounding
  if (!isCoordinateWithinEnugu(coords)) {
    return {
      isServiceable: false,
      unserviceableReason: 'Delivery is strictly restricted to locations within and around Enugu State.'
    };
  }

  const distanceToKitchen = calculateHaversineDistanceKm(JFC_KITCHEN_COORDINATES, coords);

  // Maximum courier radial distance from Agbani kitchen hub (75km)
  const MAX_PRACTICAL_DELIVERY_RADIUS_KM = 75;
  if (distanceToKitchen > MAX_PRACTICAL_DELIVERY_RADIUS_KM) {
    return {
      isServiceable: false,
      distanceKm: distanceToKitchen,
      unserviceableReason: `Your location is ${distanceToKitchen.toFixed(1)}km from our kitchen hub in Agbani, which exceeds our maximum delivery range of ${MAX_PRACTICAL_DELIVERY_RADIUS_KM}km.`
    };
  }

  // Find closest zone
  let closestZone = ENUGU_LOCATION_ZONES[0];
  let minZoneDist = Infinity;
  for (const z of ENUGU_LOCATION_ZONES) {
    const d = calculateHaversineDistanceKm(z.center, coords);
    if (d < minZoneDist) {
      minZoneDist = d;
      closestZone = z;
    }
  }

  if (closestZone.isActive === false) {
    return {
      isServiceable: false,
      distanceKm: distanceToKitchen,
      matchedZone: closestZone,
      unserviceableReason: `Delivery to ${closestZone.name} is currently suspended by management.`
    };
  }

  return {
    isServiceable: true,
    distanceKm: distanceToKitchen,
    matchedZone: closestZone
  };
}

/**
 * Computes authoritative delivery pricing & ETA based on customer's exact coordinates or chosen zone.
 */
export function computeEnuguDeliveryQuote(coords?: Coordinates | null, zoneId?: string | null): {
  fee: number;
  minOrder: number;
  distanceKm: number;
  estimatedTime: string;
  matchedZone: EnuguLocationZone;
} {
  // If coordinates provided, find the closest zone center
  if (coords && isCoordinateWithinEnugu(coords)) {
    const distanceToKitchen = calculateHaversineDistanceKm(JFC_KITCHEN_COORDINATES, coords);
    
    // Find closest defined zone
    let closestZone = ENUGU_LOCATION_ZONES[0];
    let minZoneDist = Infinity;
    for (const z of ENUGU_LOCATION_ZONES) {
      const d = calculateHaversineDistanceKm(z.center, coords);
      if (d < minZoneDist) {
        minZoneDist = d;
        closestZone = z;
      }
    }

    // Dynamic distance tiered pricing formula
    // Base ₦500 up to 3km (Agbani core), then graduated rate per km
    let calculatedFee = 500;
    let etaMinutesMin = 15;
    let etaMinutesMax = 25;

    if (distanceToKitchen <= 3.5) {
      calculatedFee = 500;
      etaMinutesMin = 15;
      etaMinutesMax = 25;
    } else if (distanceToKitchen <= 8) {
      calculatedFee = 700;
      etaMinutesMin = 20;
      etaMinutesMax = 35;
    } else if (distanceToKitchen <= 22) {
      // Agbani to Enugu Urban core (Gariki, Uwani, Independence Layout, GRA, New Haven)
      calculatedFee = Math.max(1200, Math.round(500 + (distanceToKitchen - 3) * 65));
      etaMinutesMin = 35;
      etaMinutesMax = 55;
    } else if (distanceToKitchen <= 35) {
      // Outer urban (Trans-Ekulu, Abakpa, Emene, 9th Mile)
      calculatedFee = Math.max(1800, Math.round(500 + (distanceToKitchen - 3) * 75));
      etaMinutesMin = 45;
      etaMinutesMax = 65;
    } else {
      // Regional Enugu (Nsukka, Oji River, Awgu)
      calculatedFee = Math.max(3000, Math.round(1000 + (distanceToKitchen - 5) * 60));
      etaMinutesMin = 60;
      etaMinutesMax = 90;
    }

    // Round fee to neat 50s
    calculatedFee = Math.ceil(calculatedFee / 50) * 50;

    return {
      fee: calculatedFee,
      minOrder: closestZone.minOrderAmount,
      distanceKm: distanceToKitchen,
      estimatedTime: `${etaMinutesMin} - ${etaMinutesMax} Mins`,
      matchedZone: closestZone
    };
  }

  // Fallback to zone ID match
  const matched = ENUGU_LOCATION_ZONES.find((z) => z.id === zoneId) || ENUGU_LOCATION_ZONES[0];
  const distance = calculateHaversineDistanceKm(JFC_KITCHEN_COORDINATES, matched.center);

  return {
    fee: matched.deliveryFee,
    minOrder: matched.minOrderAmount,
    distanceKm: distance,
    estimatedTime: matched.estimatedTime,
    matchedZone: matched
  };
}
