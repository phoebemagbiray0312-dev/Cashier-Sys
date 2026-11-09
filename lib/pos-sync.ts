import { getSupabaseClient } from './supabase-client';
import type { DeletedPOSDraft, POS } from './data';

/**
 * v9.26 — POS & Sales are stored in Supabase (cms_sales.payload).
 * Every write goes through the cms_save_pos / cms_delete_pos_draft RPCs, which enforce
 * role, branch access, one-open-POS-per-plate across ALL branches, and optimistic
 * versioning so two devices cannot silently overwrite each other.
 */

export type POSSyncStatus = 'loading' | 'saved' | 'saving' | 'offline' | 'error';

export interface RemotePOSState {
  pos: POS[];
  deleted: DeletedPOSDraft[];
  versions: Record<string, number>;
}

interface SalesRow {
  pos_id: string;
  version: number;
  payload: POS;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
}

const PAGE = 500;

export async function loadRemotePOS(): Promise<RemotePOSState> {
  const supabase = getSupabaseClient();
  const rows: SalesRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('cms_sales')
      .select('pos_id,version,payload,deleted_at,deleted_by,delete_reason')
      .not('payload', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error('Could not load POS records from the server.');
    rows.push(...((data ?? []) as SalesRow[]));
    if (!data || data.length < PAGE) break;
  }
  const versions: Record<string, number> = {};
  const pos: POS[] = [];
  const deleted: DeletedPOSDraft[] = [];
  for (const row of rows) {
    versions[row.pos_id] = row.version;
    if (row.deleted_at) {
      const original = row.payload;
      deleted.push({
        id: original.id, no: original.no, branch: original.branch, plate: original.plate,
        deletedAt: row.deleted_at, deletedBy: row.deleted_by ? 'supabase:' + row.deleted_by : '',
        reason: row.delete_reason || '', original,
      });
    } else {
      pos.push(row.payload);
    }
  }
  return { pos, deleted, versions };
}

class RejectedError extends Error {}

function rpcFailure(error: { message?: string; code?: string }): Error {
  const message = error.message || 'Server rejected the POS save.';
  const code = error.code || '';
  // Database decisions (permission, validation, conflict) will never succeed on retry.
  if (/POS_[A-Z_]+:/.test(message) || /^(22|23|40|42)/.test(code)) {
    return new RejectedError(message.replace(/^POS_[A-Z_]+:\s*/, ''));
  }
  return new Error(message);
}

const fingerprint = (p: POS) => JSON.stringify(p);

export interface POSSyncHooks {
  /** Server refused a save; `previous` is the last server-confirmed copy (undefined = never saved). */
  onRejected(id: string, previous: POS | undefined, message: string): void;
  /** Another device changed this POS; the caller should reload from the server. */
  onConflict(message: string): void;
  onStatus(status: POSSyncStatus, detail?: string): void;
}

export class POSSyncer {
  private synced = new Map<string, string>();
  private versions: Record<string, number> = {};
  private deletedSynced = new Set<string>();
  private latest: { pos: POS[]; deleted: DeletedPOSDraft[] } | null = null;
  private running = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  constructor(private hooks: POSSyncHooks) {}

  /** Adopt the server state as the confirmed baseline. */
  reset(state: RemotePOSState) {
    this.synced = new Map(state.pos.map(p => [p.id, fingerprint(p)]));
    this.versions = { ...state.versions };
    this.deletedSynced = new Set(state.deleted.map(d => d.id));
    this.latest = null;
    this.active = true;
    this.hooks.onStatus('saved');
  }

  stop() {
    this.active = false;
    this.latest = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  /** Called with the app's current POS lists after every change; only differences are sent. */
  push(pos: POS[], deleted: DeletedPOSDraft[]) {
    if (!this.active) return;
    this.latest = { pos, deleted };
    void this.run();
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.latest && this.active) {
        const { pos, deleted } = this.latest;
        this.latest = null;
        await this.flush(pos, deleted);
      }
    } finally {
      this.running = false;
    }
  }

  private scheduleRetry(pos: POS[], deleted: DeletedPOSDraft[]) {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.active && !this.latest) this.push(pos, deleted);
    }, 15000);
  }

  private async flush(pos: POS[], deleted: DeletedPOSDraft[]) {
    const supabase = getSupabaseClient();
    const changed = pos.filter(p => this.synced.get(p.id) !== fingerprint(p));
    const removals = deleted.filter(d => !this.deletedSynced.has(d.id) && this.synced.has(d.id));
    if (!changed.length && !removals.length) return;
    this.hooks.onStatus('saving');
    try {
      for (const d of removals) {
        const { data, error } = await supabase.rpc('cms_delete_pos_draft', {
          p_pos_id: d.id, p_reason: d.reason, p_expected_version: this.versions[d.id] ?? null,
        });
        if (error) throw Object.assign(rpcFailure(error), { posId: d.id });
        this.synced.delete(d.id);
        this.deletedSynced.add(d.id);
        const version = (data as { version?: number } | null)?.version;
        if (version) this.versions[d.id] = version;
      }
      for (const p of changed) {
        const { data, error } = await supabase.rpc('cms_save_pos', {
          p_pos: p, p_expected_version: this.versions[p.id] ?? null,
        });
        if (error) throw Object.assign(rpcFailure(error), { posId: p.id });
        this.synced.set(p.id, fingerprint(p));
        const version = (data as { version?: number } | null)?.version;
        if (version) this.versions[p.id] = version;
      }
      this.hooks.onStatus('saved');
    } catch (err) {
      const posId = (err as { posId?: string }).posId || '';
      const message = err instanceof Error ? err.message : 'POS could not be saved.';
      if (err instanceof RejectedError) {
        if (/another device/i.test(message)) {
          this.hooks.onStatus('error', message);
          this.hooks.onConflict(message);
          return;
        }
        const previousRaw = this.synced.get(posId);
        this.hooks.onRejected(posId, previousRaw ? JSON.parse(previousRaw) as POS : undefined, message);
        this.hooks.onStatus('saved');
        return;
      }
      // Network / session problem: keep the local change and retry.
      this.hooks.onStatus('offline', message);
      this.scheduleRetry(pos, deleted);
    }
  }
}

/** One-time safety copy of POS records that only ever existed in this browser. */
export function backupLocalOnlyPOS(local: POS[], remote: RemotePOSState) {
  try {
    const known = new Set([...remote.pos.map(p => p.id), ...remote.deleted.map(d => d.id)]);
    const localOnly = local.filter(p => !known.has(p.id));
    if (!localOnly.length) return 0;
    const key = 'uc_local_pos_backup_v926';
    const previous = JSON.parse(localStorage.getItem(key) || '[]') as POS[];
    const merged = [...previous.filter(p => !localOnly.some(x => x.id === p.id)), ...localOnly];
    localStorage.setItem(key, JSON.stringify(merged));
    return localOnly.length;
  } catch {
    return 0;
  }
}
