import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface FleetAdminAuditLog {
  id: string;
  action:
    | 'suspend_rider'
    | 'reactivate_rider'
    | 'mark_unavailable'
    | 'reassign_order'
    | 'investigate_failed_assignment'
    | 'zone_update'
    | 'courier_profile_update'
    | 'courier_archived'
    | 'courier_deleted';
  actorId: string;
  actorEmail?: string;
  actorRole: string;
  targetId?: string; // riderId or orderId
  targetType: 'rider' | 'order';
  reason: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

const AUDIT_FILE = path.join(process.cwd(), 'data', 'fleet_admin_audit_logs.json');

function readLocalAuditLogs(): FleetAdminAuditLog[] {
  try {
    if (!fs.existsSync(AUDIT_FILE)) return [];
    return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalAuditLog(log: FleetAdminAuditLog) {
  try {
    const logs = readLocalAuditLogs();
    logs.unshift(log); // newest first
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs.slice(0, 1000), null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write local audit log:', err);
  }
}

/**
 * Record an immutable administrative intervention audit entry.
 * Both writes to Supabase (order_status_history or admin audit) and persistent local storage.
 */
export async function recordFleetAuditLog(entry: Omit<FleetAdminAuditLog, 'id' | 'timestamp'>): Promise<FleetAdminAuditLog> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const fullLog: FleetAdminAuditLog = {
    id,
    timestamp,
    ...entry
  };

  // 1. Write to durable local JSON
  writeLocalAuditLog(fullLog);

  // 2. If it affects an order, also insert into Supabase order_status_history for immutable DB traceability
  if (entry.targetType === 'order' && entry.targetId) {
    try {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        // Find existing order status
        const { data: ord } = await supabase
          .from('orders')
          .select('id, status')
          .or(`id.eq.${entry.targetId},order_code.eq.${entry.targetId}`)
          .maybeSingle();

        if (ord) {
          await supabase.from('order_status_history').insert({
            order_id: ord.id,
            status: ord.status,
            from_status: entry.metadata?.fromStatus || ord.status,
            to_status: entry.metadata?.toStatus || ord.status,
            actor_type: entry.actorRole,
            actor_id: entry.actorId,
            rider_id: entry.metadata?.riderId || null,
            notes: `[ADMIN AUDIT] Action: ${entry.action} | Reason: ${entry.reason}`
          });
        }
      }
    } catch (dbErr) {
      console.warn('Could not mirror order audit to DB history:', dbErr);
    }
  }

  return fullLog;
}

export function getFleetAuditLogs(limit = 100): FleetAdminAuditLog[] {
  return readLocalAuditLogs().slice(0, limit);
}
