import fs from 'fs';
import path from 'path';
import {
  ENUGU_LOCATION_ZONES,
  EnuguLocationZone,
  Coordinates,
  calculateHaversineDistanceKm,
  JFC_KITCHEN_COORDINATES
} from './enugu-geocoding';
import { getSupabaseAdminClient } from './supabase/admin';

const ZONES_OVERRIDE_FILE = path.join(process.cwd(), 'data', 'delivery_zones_override.json');
const RIDER_ZONES_FILE = path.join(process.cwd(), 'data', 'rider_zone_assignments.json');

export interface RiderZoneAssignment {
  riderId: string;
  zoneIds: string[]; // List of assigned zone IDs (empty means all zones)
  assignedAt: string;
  assignedBy?: string;
}

// ---------------------------------------------------------------------------
// 1. Configurable Zones Storage & Synchronization
// ---------------------------------------------------------------------------

export function readZoneOverrides(): Record<string, Partial<EnuguLocationZone>> {
  try {
    if (!fs.existsSync(ZONES_OVERRIDE_FILE)) return {};
    return JSON.parse(fs.readFileSync(ZONES_OVERRIDE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function writeZoneOverrides(overrides: Record<string, Partial<EnuguLocationZone>>) {
  try {
    fs.writeFileSync(ZONES_OVERRIDE_FILE, JSON.stringify(overrides, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing delivery zones override file:', err);
  }
}

/**
 * Returns canonical Enugu delivery zones merged with live Owner/Admin configuration.
 */
export function getActiveEnuguDeliveryZones(): EnuguLocationZone[] {
  const overrides = readZoneOverrides();
  return ENUGU_LOCATION_ZONES.map((zone) => {
    if (overrides[zone.id]) {
      return {
        ...zone,
        ...overrides[zone.id],
        center: overrides[zone.id].center || zone.center
      };
    }
    return zone;
  });
}

/**
 * Matches an address string to the most appropriate Enugu delivery zone.
 */
export function resolveZoneFromAddress(address: string): EnuguLocationZone {
  const normalized = (address || '').toLowerCase();
  const zones = getActiveEnuguDeliveryZones();

  // Sort zones by specificity (longer, more specific names first to prevent "Agbani" matching before "ESUT Campus Agbani")
  const sortedZones = [...zones].sort((a, b) => b.name.length - a.name.length);

  // 1. Specific Landmark Match (highest priority)
  for (const zone of zones) {
    for (const lm of zone.popularLandmarks || []) {
      if (normalized.includes(lm.toLowerCase())) {
        return zone;
      }
    }
  }

  // 2. Specific Name Match (longest name first)
  for (const zone of sortedZones) {
    if (normalized.includes(zone.name.toLowerCase())) {
      return zone;
    }
    // Also match individual parts in composite names e.g. "Trans-Ekulu" in "Trans-Ekulu & Thinkers Corner"
    const subNames = zone.name.split(/[&,/()]/).map(s => s.trim().toLowerCase()).filter(s => s.length >= 3);
    for (const sub of subNames) {
      if (normalized.includes(sub)) {
        return zone;
      }
    }
  }

  // 3. Keyword / partial sub-name match
  if (normalized.includes('esut') || normalized.includes('hostel')) {
    const esut = zones.find(z => z.id === 'zone_esut_campus');
    if (esut) return esut;
  }
  if (normalized.includes('unn') || normalized.includes('nsukka')) {
    const nsukka = zones.find(z => z.id === 'zone_enugu_nsukka');
    if (nsukka) return nsukka;
  }
  if (normalized.includes('unec') || normalized.includes('ogui')) {
    const unec = zones.find(z => z.id === 'zone_enugu_ogui_unec');
    if (unec) return unec;
  }
  if (normalized.includes('9th mile') || normalized.includes('ninth mile')) {
    const nm = zones.find(z => z.id === 'zone_enugu_ninth_mile');
    if (nm) return nm;
  }

  // 4. Default to Primary Kitchen Hub (Agbani Core)
  return zones[0];
}

/**
 * Resolve zone by unique ID
 */
export function getEnuguZoneById(zoneId?: string | null): EnuguLocationZone {
  const zones = getActiveEnuguDeliveryZones();
  if (!zoneId) return zones[0];
  const found = zones.find((z) => z.id === zoneId);
  return found || zones[0];
}

// ---------------------------------------------------------------------------
// 2. Rider Zone Assignment Management
// ---------------------------------------------------------------------------

export function readRiderZoneAssignments(): Record<string, RiderZoneAssignment> {
  try {
    if (!fs.existsSync(RIDER_ZONES_FILE)) return {};
    return JSON.parse(fs.readFileSync(RIDER_ZONES_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function writeRiderZoneAssignments(assignments: Record<string, RiderZoneAssignment>) {
  try {
    fs.writeFileSync(RIDER_ZONES_FILE, JSON.stringify(assignments, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing rider zone assignments:', err);
  }
}

export function getRiderAssignedZones(riderId: string): string[] {
  const assignments = readRiderZoneAssignments();
  const record = assignments[riderId];
  if (!record || !record.zoneIds || record.zoneIds.length === 0) {
    // If not restricted to specific zones, rider is eligible for all Enugu zones
    return [];
  }
  return record.zoneIds;
}

export function setRiderAssignedZones(riderId: string, zoneIds: string[], assignedBy?: string) {
  const assignments = readRiderZoneAssignments();
  assignments[riderId] = {
    riderId,
    zoneIds,
    assignedAt: new Date().toISOString(),
    assignedBy
  };
  writeRiderZoneAssignments(assignments);
}

/**
 * Checks whether a given rider is eligible to be dispatched for an order in a specific zone.
 */
export function isRiderEligibleForZone(riderId: string, zoneId: string): boolean {
  const assigned = getRiderAssignedZones(riderId);
  // Empty array signifies full fleet coverage across all Enugu service zones
  if (assigned.length === 0) return true;
  return assigned.includes(zoneId);
}
