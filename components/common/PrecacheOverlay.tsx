'use client';

import React, { useEffect } from 'react';

type Props = {
  visible: boolean;
  done: number;
  total: number;
  onSkip: () => void;
  timeoutMs?: number;
};

export default function PrecacheOverlay({ visible, done, total, onSkip, timeoutMs = 15000 }: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      onSkip();
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [visible, timeoutMs, onSkip]);

  if (!visible) return null;

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
      }}
    >
      <div style={{ width: 360, background: '#fff', padding: 20, borderRadius: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Chuẩn bị ứng dụng...</div>
        <div style={{ fontSize: 13, color: '#444', marginBottom: 12 }}>
          Đang lưu bộ nhớ tạm: {done}/{total} ({pct}%)
        </div>
        <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#0ea5a0' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onSkip}
            style={{ padding: '6px 10px', background: 'transparent', border: '1px solid #ddd', borderRadius: 6 }}
          >
            Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
}
