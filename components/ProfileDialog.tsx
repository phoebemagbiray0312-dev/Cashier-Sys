'use client';
import React, { useEffect, useState } from 'react';
import { Camera, Check, KeyRound, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Ui';
import { changeStaffPassword, updateMyProfile, type StaffIdentity } from '@/lib/supabase-auth';

/** v9.31 — Small round profile picture with the first letter as fallback. */
export function StaffAvatar({ name, url, className = 'avatar' }: { name: string; url?: string | null; className?: string }) {
  return url
    ? <div className={className + ' avatar-photo'}><img src={url} alt="" /></div>
    : <div className={className}>{(name || '?').charAt(0).toUpperCase()}</div>;
}

/** v9.31 — Every signed-in user can change their own display name and profile picture. */
export default function ProfileDialog({ identity, roleLabel, onClose, onSaved }: {
  identity: StaffIdentity; roleLabel: string; onClose: () => void; onSaved: (updated: StaffIdentity) => void;
}) {
  const [name, setName] = useState(identity.displayName);
  const [picture, setPicture] = useState<File | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(identity.avatarUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // v9.52: every role can change its own password here (Cashier and PB have no Settings page)
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState('');
  const [show, setShow] = useState(false); const [pwBusy, setPwBusy] = useState(false); const [pwMsg, setPwMsg] = useState(''); const [pwErr, setPwErr] = useState('');
  async function changePassword() {
    setPwErr(''); setPwMsg('');
    if (next !== again) { setPwErr('The new passwords do not match.'); return; }
    setPwBusy(true);
    try { await changeStaffPassword(cur, next); setPwMsg('Password changed. Use the new password next time you sign in.'); setCur(''); setNext(''); setAgain(''); setPwOpen(false); }
    catch (err) { setPwErr(err instanceof Error ? err.message : 'Password could not be changed.'); }
    finally { setPwBusy(false); }
  }

  useEffect(() => {
    if (!picture) return;
    const url = URL.createObjectURL(picture);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { onSaved(await updateMyProfile(name, picture)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Profile could not be saved.'); }
    finally { setBusy(false); }
  }

  const changed = name.trim() !== identity.displayName || picture !== undefined;
  return <Modal title="My Profile" subtitle={`${roleLabel}${identity.branch ? ' · ' + identity.branch : ''} · ${identity.email}`} onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={save} className="profile-form">
      <div className="profile-photo-row">
        <StaffAvatar name={name} url={preview} className="avatar profile-photo" />
        <div className="profile-photo-actions">
          <label className="button button-secondary profile-file"><Camera size={15} /> {preview ? 'Change photo' : 'Add photo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { const f = e.target.files?.[0]; if (f) setPicture(f); e.target.value = ''; }} />
          </label>
          {preview && <button type="button" className="button button-secondary" onClick={() => { setPicture(null); setPreview(null); }}><Trash2 size={15} /> Remove</button>}
          <span className="profile-hint">PNG, JPG or WebP. Cropped to a square.</span>
        </div>
      </div>
      <label className="field"><span>Display name</span><input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label>
      <p className="profile-hint">Your username, role and branch are managed by an Admin.</p>
      <div className="profile-password">
        {!pwOpen ? <button type="button" className="button button-secondary" onClick={() => { setPwOpen(true); setPwMsg(''); }}><KeyRound size={15} /> Change password</button> : <>
          <strong>Change password</strong>
          <label className="field"><span>Current password</span><input type={show ? 'text' : 'password'} autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} /></label>
          <label className="field"><span>New password (12 characters or more)</span><input type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} /></label>
          <label className="field"><span>Confirm new password</span><input type={show ? 'text' : 'password'} autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} /></label>
          <label className="profile-show"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show passwords</label>
          {pwErr && <p className="account-pw-error" role="alert">{pwErr}</p>}
          <div className="profile-pw-actions"><button type="button" className="button button-secondary" onClick={() => { setPwOpen(false); setPwErr(''); }} disabled={pwBusy}>Cancel</button><button type="button" className="button button-primary" disabled={pwBusy || !cur || next.length < 12 || !again} onClick={() => void changePassword()}>{pwBusy ? 'Changing…' : 'Change Password'}</button></div>
        </>}
        {pwMsg && <p className="profile-hint" role="status">{pwMsg}</p>}
      </div>
      {error && <p className="account-pw-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="button button-primary" type="submit" disabled={busy || !changed || name.trim().length < 2}><Check size={15} /> {busy ? 'Saving…' : 'Save Profile'}</button>
      </div>
    </form>
  </Modal>;
}
