import React from 'react';
import { Icons } from './Icons';

interface PinOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: string;
  pinValue: string;
  onPinChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const PinOverrideModal: React.FC<PinOverrideModalProps> = ({
  isOpen,
  onClose,
  reason,
  pinValue,
  onPinChange,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print"
      dir="rtl"
    >
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-center gap-3 text-copper mb-2">
          <Icons.AlertTriangle className="h-6 w-6" />
          <h3 className="font-display font-extrabold text-base">مطلوب موافقة المدير</h3>
        </div>
        <p className="text-xs text-muted mb-4">{reason}</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-muted mb-1 block">
              أدخل رمز PIN للمدير للموافقة
            </label>
            <input
              type="password"
              maxLength={4}
              autoFocus
              value={pinValue}
              onChange={(e) => onPinChange(e.target.value)}
              className="w-full h-12 rounded-control border border-line bg-surface text-center mono text-2xl tracking-widest focus-visible:outline-none focus:border-jade"
              placeholder="••••"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pinValue.length < 4}
              className="flex-1 py-3 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              تأكيد الموافقة
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
