import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { apiCall } from '../lib/api';
import { Icons } from '../components/Icons';

interface LicenseActivationProps {
  machineCode: string;
  reason?: string;
  onActivated: () => void;
}

export const LicenseActivationScreen: React.FC<LicenseActivationProps> = ({
  machineCode,
  reason,
  onActivated,
}) => {
  const { triggerToast } = useToast();
  const [licenseKey, setLicenseKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleCopyMachineCode = () => {
    navigator.clipboard.writeText(machineCode);
    setCopied(true);
    triggerToast('تم نسخ كود الجهاز إلى الحافظة بنجاح');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!licenseKey.trim()) {
      setError('يرجى لصق نص مفتاح الترخيص المطلوب');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiCall('/api/license/activate', 'POST', {
        licenseKey: licenseKey.trim(),
      });

      if (res.success) {
        triggerToast('تم تفعيل المنظومة بنجاح 🎉');
        onActivated();
      } else {
        setError(res.error || 'مفتاح الترخيص غير صالح أو غير مطابق لهذا الجهاز');
      }
    } catch {
      setError('خطأ أثناء التوصيل مع خادم المنظومة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-4 bg-bg text-text"
      dir="rtl"
    >
      <div className="w-full max-w-lg rounded-card border border-line bg-surface p-8 shadow-xl flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2 border-b border-line pb-6">
          <img
            src="/logo.png"
            alt="Flow Dev Logo"
            className="h-24 w-24 object-contain mb-1 drop-shadow-lg"
          />
          <h1 className="text-2xl font-extrabold font-display">منظومة Flow</h1>
          <p className="text-xs text-muted">نظام إدارة المبيعات والمخزون — نسخة غير مفعلة</p>
        </div>

        {/* Status Message */}
        {reason && (
          <div className="p-3 bg-alert/10 border border-alert/30 text-alert text-xs rounded-control font-bold text-center">
            {reason}
          </div>
        )}

        {/* Machine Code Box */}
        <div className="bg-surface-2 p-4 rounded-control border border-line flex flex-col gap-2">
          <label className="text-xs font-bold text-muted block">
            كود تفعيل الجهاز الخاص بك (Machine Code):
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="mono text-lg font-black tracking-widest text-jade">
              {machineCode}
            </span>
            <button
              type="button"
              onClick={handleCopyMachineCode}
              className="px-3 py-1.5 text-xs font-bold border border-jade/40 bg-jade/10 text-jade rounded-control hover:bg-jade/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Icons.Copy className="h-4 w-4" />
              {copied ? 'تم النسخ ✔' : 'نسخ الكود'}
            </button>
          </div>
          <p className="text-[11px] text-muted mt-1">
            قم بإرسال هذا الكود إلى موزع المنظومة أو الدعم الفني للحصول على مفتاح الترخيص الخاص بمحلك.
          </p>
        </div>

        {/* License Form */}
        <form onSubmit={handleActivate} className="flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-alert/10 border border-alert/30 text-alert text-xs rounded-control font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted mb-1 block">
              مفتاح الترخيص (License Key):
            </label>
            <textarea
              rows={4}
              required
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="w-full rounded-control border border-line bg-surface p-3 text-xs font-mono focus-visible:outline-none focus:border-jade resize-none"
              placeholder="ألصق مفتاح الترخيص المشفر هنا..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-sm shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? 'جاري التحقق والتفعيل...' : 'تفعيل المنظومة الآن'}
          </button>
        </form>

        {/* Vendor Contact Footer */}
        <div className="border-t border-line pt-4 text-center text-[11px] text-muted flex flex-col gap-1">
          <span>لطلب الترخيص أو الحصول على الدعم الفني:</span>
          <span className="mono font-bold text-text">WhatsApp / Phone: +218-91-0000000</span>
        </div>
      </div>
    </div>
  );
};
