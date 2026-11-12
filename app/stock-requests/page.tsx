'use client';
/** v9.35 — Stock transfers now open as a popup inside Inventory (components/StockTransferDialog.tsx).
 *  This page is kept only so old links still work. */
import StockTransferDialog from '@/components/StockTransferDialog';
import { useEffect, useState } from 'react';

export default function StockRequestsPage() {
  const [mode, setMode] = useState<'new' | 'history'>('new');
  useEffect(() => { if (new URLSearchParams(window.location.search).get('mode') === 'history') setMode('history'); }, []);
  return <StockTransferDialog key={mode} mode={mode} onClose={() => { window.location.href = '/'; }} />;
}
