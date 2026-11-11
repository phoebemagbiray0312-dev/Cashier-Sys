'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import SupplierWorkspace from '@/components/SupplierWorkspace';

/** Standalone supplier page. The main app renders SupplierWorkspace directly (v9.32). */
export default function SupplierControls() {
  return <Suspense fallback={<main style={{ padding: 32 }}>Loading suppliers…</main>}><Standalone /></Suspense>;
}
function Standalone() {
  const embedded = useSearchParams().get('embedded') === '1';
  return <main style={{ maxWidth: 1180, margin: '0 auto', padding: embedded ? 0 : '24px 20px' }}><SupplierWorkspace embedded={embedded} /></main>;
}
