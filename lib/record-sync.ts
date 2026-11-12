import { getSupabaseClient } from './supabase-client';
import type { Database } from './data';

/**
 * v9.28 — Every remaining browser collection is stored in Supabase (public.cms_records).
 * Writes go through cms_save_record / cms_delete_record, which enforce branch access,
 * Admin-only approvals/settings/deletes, append-only audit and version checks.
 */

export const RECORD_COLLECTIONS = [
  'fundEntries', 'disbursementRequests', 'counts', 'turnovers', 'incidents', 'requests',
  'terminalEvents', 'terminalSettlements', 'stockRequests', 'stockReceipts', 'stockIssues', 'audit',
  'rfpReceipts', // v9.41: cashier supplier receipts / PB refund reports per PO
] as const;
export type RecordCollection = typeof RECORD_COLLECTIONS[number];
type AnyRecord = { id: string } & Record<string, unknown>;
export type RecordLists = Record<RecordCollection, AnyRecord[]>;
export type Settings = Database['settings'];

export interface RemoteRecords {
  lists: RecordLists;
  settings: Settings | null;
  versions: Record<string, number>;
}

const key = (collection: string, id: string) => `${collection}:${id}`;
const fp = (value: unknown) => JSON.stringify(value);
const PAGE = 500;

function emptyLists(): RecordLists {
  return Object.fromEntries(RECORD_COLLECTIONS.map(c => [c, []])) as unknown as RecordLists;
}

export function pickRecordLists(db: Database): RecordLists {
  const source = db as unknown as Record<string, AnyRecord[] | undefined>;
  return Object.fromEntries(RECORD_COLLECTIONS.map(c => [c, source[c] || []])) as unknown as RecordLists;
}

export async function loadRemoteRecords(): Promise<RemoteRecords> {
  const supabase = getSupabaseClient();
  const lists = emptyLists();
  const versions: Record<string, number> = {};
  let settings: Settings | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('cms_records')
      .select('collection,id,version,payload')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error('Could not load records from the server.');
    for (const row of (data ?? []) as { collection: string; id: string; version: number; payload: unknown }[]) {
      versions[key(row.collection, row.id)] = row.version;
      if (row.collection === 'settings') settings = row.payload as Settings;
      else if ((RECORD_COLLECTIONS as readonly string[]).includes(row.collection)) lists[row.collection as RecordCollection].push(row.payload as AnyRecord);
    }
    if (!data || data.length < PAGE) break;
  }
  // Newest-first matches how the app prepends new records.
  for (const c of RECORD_COLLECTIONS) lists[c].reverse();
  return { lists, settings, versions };
}

class Rejected extends Error {}
function failure(error: { message?: string; code?: string }) {
  const message = error.message || 'Server rejected the change.';
  if (/REC_[A-Z_]+:/.test(message) || /^(22|23|40|42)/.test(error.code || '')) return new Rejected(message.replace(/^REC_[A-Z_]+:\s*/, ''));
  return new Error(message);
}

export interface RecordSyncHooks {
  onRejected(collection: RecordCollection | 'settings', id: string, previous: AnyRecord | Settings | undefined, message: string): void;
  onConflict(message: string): void;
  onStatus(status: 'saved' | 'saving' | 'offline' | 'error', detail?: string): void;
}

export class RecordSyncer {
  private synced = new Map<string, string>();
  private versions: Record<string, number> = {};
  private latest: { lists: RecordLists; settings: Settings } | null = null;
  private running = false;
  private active = false;
  private isAdmin = false;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(private hooks: RecordSyncHooks) {}

  reset(remote: RemoteRecords, isAdmin: boolean, settingsInUse: Settings) {
    this.synced = new Map();
    for (const c of RECORD_COLLECTIONS) for (const r of remote.lists[c]) this.synced.set(key(c, r.id), fp(r));
    // When no settings exist online yet, an Admin's first save uploads the ones in use.
    if (remote.settings || !isAdmin) this.synced.set(key('settings', 'settings'), fp(remote.settings ?? settingsInUse));
    this.versions = { ...remote.versions };
    this.isAdmin = isAdmin;
    this.latest = null;
    this.active = true;
    this.hooks.onStatus('saved');
  }

  stop() {
    this.active = false;
    this.latest = null;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
  }

  push(lists: RecordLists, settings: Settings) {
    if (!this.active) return;
    this.latest = { lists, settings };
    void this.run();
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.latest && this.active) {
        const next = this.latest;
        this.latest = null;
        await this.flush(next.lists, next.settings);
      }
    } finally {
      this.running = false;
    }
  }

  private async flush(lists: RecordLists, settings: Settings) {
    const supabase = getSupabaseClient();
    const saves: { collection: RecordCollection | 'settings'; record: AnyRecord | Settings; id: string }[] = [];
    const deletes: { collection: RecordCollection; id: string }[] = [];
    for (const c of RECORD_COLLECTIONS) {
      const present = new Set<string>();
      for (const r of lists[c]) {
        if (!r?.id) continue;
        present.add(r.id);
        if (this.synced.get(key(c, r.id)) !== fp(r)) saves.push({ collection: c, record: r, id: r.id });
      }
      if (c === 'audit') continue;
      for (const k of this.synced.keys()) {
        if (!k.startsWith(c + ':')) continue;
        const id = k.slice(c.length + 1);
        if (!present.has(id)) deletes.push({ collection: c, id });
      }
    }
    if (this.isAdmin && this.synced.get(key('settings', 'settings')) !== fp(settings)) {
      saves.push({ collection: 'settings', record: settings, id: 'settings' });
    }
    if (!saves.length && !deletes.length) return;
    this.hooks.onStatus('saving');
    let current: { collection: RecordCollection | 'settings'; id: string } | null = null;
    try {
      for (const d of deletes) {
        current = d;
        const { data, error } = await supabase.rpc('cms_delete_record', {
          p_collection: d.collection, p_id: d.id, p_expected_version: this.versions[key(d.collection, d.id)] ?? null,
        });
        if (error) throw failure(error);
        this.synced.delete(key(d.collection, d.id));
        const v = (data as { version?: number } | null)?.version;
        if (v) this.versions[key(d.collection, d.id)] = v;
      }
      for (const s of saves) {
        current = s;
        const record = s.collection === 'settings' ? { ...(s.record as Settings), id: 'settings' } : s.record;
        const { data, error } = await supabase.rpc('cms_save_record', {
          p_collection: s.collection, p_record: record, p_expected_version: this.versions[key(s.collection, s.id)] ?? null,
        });
        if (error) throw failure(error);
        this.synced.set(key(s.collection, s.id), fp(s.record));
        const v = (data as { version?: number } | null)?.version;
        if (v) this.versions[key(s.collection, s.id)] = v;
      }
      this.hooks.onStatus('saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Change could not be saved.';
      if (err instanceof Rejected && current) {
        if (/another device/i.test(message)) {
          this.hooks.onStatus('error', message);
          this.hooks.onConflict(message);
          return;
        }
        const prev = this.synced.get(key(current.collection, current.id));
        this.hooks.onRejected(current.collection, current.id, prev ? JSON.parse(prev) : undefined, message);
        this.hooks.onStatus('saved');
        return;
      }
      this.hooks.onStatus('offline', message);
      if (!this.retry) this.retry = setTimeout(() => {
        this.retry = null;
        if (this.active && !this.latest) this.push(lists, settings);
      }, 15000);
    }
  }
}

/** One-time safety copy of records that only ever existed in this browser (not uploaded). */
export function backupLocalOnlyRecords(local: RecordLists, remote: RemoteRecords) {
  try {
    let count = 0;
    const backup: Partial<Record<RecordCollection, AnyRecord[]>> = {};
    for (const c of RECORD_COLLECTIONS) {
      if (c === 'audit') continue;
      const known = new Set(remote.lists[c].map(r => r.id));
      const only = local[c].filter(r => r?.id && !known.has(r.id));
      if (only.length) { backup[c] = only; count += only.length; }
    }
    if (!count) return 0;
    const storageKey = 'uc_local_records_backup_v928';
    const previous = JSON.parse(localStorage.getItem(storageKey) || '{}') as Partial<Record<RecordCollection, AnyRecord[]>>;
    for (const c of Object.keys(backup) as RecordCollection[]) {
      const ids = new Set(backup[c]!.map(r => r.id));
      previous[c] = [...(previous[c] || []).filter(r => !ids.has(r.id)), ...backup[c]!];
    }
    localStorage.setItem(storageKey, JSON.stringify(previous));
    return count;
  } catch {
    return 0;
  }
}
