import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';

interface IdleLockOverlayProps {
  currentUsername: string;
  onUnlock: (token: string, user: any) => void;
  onLogout: () => void;
}

// Full-screen lock reached after Settings' configurable idle timeout. It sits
// on top of the still-mounted app (design.md §9: "the in-progress cart
// survives the lock") — unlocking never remounts or navigates, it just hides
// this overlay. Any active user's PIN unlocks, matching the same
// /api/auth/pin-switch endpoint used for shift-change fast switching.
export const IdleLockOverlay: React.FC<IdleLockOverlayProps> = ({
  currentUsername,
  onUnlock,
  onLogout,
}) => {
  const { triggerToast } = useToast();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch('/api/auth/pin-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const res = await r.json();
      if (!r.ok) {
        triggerToast(res.message || 'رمز PIN غير صحيح', 'alert');
        setPin('');
        return;
      }
      onUnlock(res.token, res.user);
      setPin('');
    } catch {
      triggerToast('فشل الاتصال بالخادم', 'alert');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 no-print"
      style={{ background: 'var(--bg)' }}
      dir="rtl"
    >
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8 shadow-xl flex flex-col items-center gap-5 text-center">
        <img src="/logo.png" alt="Flow Dev" className="h-20 w-20 object-contain rounded-2xl drop-shadow-md" />
        <div>
          <h2 className="font-display text-lg font-black mb-1">الشاشة مقفلة</h2>
          <p className="text-xs text-muted">
            مقفلة تلقائياً لعدم الاستخدام — أدخل رمز PIN للمتابعة كـ{' '}
            <span className="font-bold text-text">{currentUsername}</span> أو أي مستخدم آخر
          </p>
        </div>

        <form onSubmit={handleUnlock} className="w-full flex flex-col gap-4">
          <input
            type="password"
            maxLength={4}
            autoFocus
            autoComplete="off"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full h-12 rounded-control border border-line bg-surface text-center mono text-2xl tracking-widest focus-visible:outline-none focus:border-jade"
            placeholder="••••"
          />
          <button
            type="submit"
            disabled={pin.length < 4 || submitting}
            className="w-full py-3 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            فتح القفل
          </button>
        </form>

        <button
          type="button"
          onClick={onLogout}
          className="text-xs font-bold text-muted hover:text-alert cursor-pointer"
        >
          تسجيل الخروج بدلاً من ذلك
        </button>
      </div>
    </div>
  );
};
