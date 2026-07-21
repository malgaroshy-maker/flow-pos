import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { Icons } from '../components/Icons';

// Plain fetch, not apiCall — the activation screen runs before login, so
// there is no auth token yet, and apiCall() refuses to send a request
// without one (the server-side license routes are intentionally public).
async function publicApiCall(url: string, body: any): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || data.success === false) {
      return { success: false, error: data.error || data.message || 'حدث خطأ غير متوقع' };
    }
    return { success: true, data: data.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

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
  const [mode, setMode] = useState<'pin' | 'key'>('pin');
  const [vendorPin, setVendorPin] = useState('');
  const [customerName, setCustomerName] = useState('');
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

  const handleActivateByPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!vendorPin.trim()) {
      setError('يرجى إدخال رمز الموزع المعتمد');
      return;
    }

    setSubmitting(true);
    try {
      const res = await publicApiCall('/api/license/activate-pin', {
        vendorPin: vendorPin.trim(),
        customerName: customerName.trim() || 'عميل محلي',
      });

      if (res.success) {
        triggerToast('تم تفعيل المنظومة بنجاح 🎉');
        onActivated();
      } else {
        setError(res.error || 'رمز الموزع المعتمد غير صحيح');
      }
    } catch {
      setError('خطأ أثناء التوصيل مع خادم المنظومة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateByKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!licenseKey.trim()) {
      setError('يرجى لصق نص مفتاح الترخيص المطلوب');
      return;
    }

    setSubmitting(true);
    try {
      const res = await publicApiCall('/api/license/activate', {
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
            className="h-32 w-32 object-contain mb-1 rounded-2xl drop-shadow-lg"
          />
          <h1 className="text-2xl font-extrabold font-display">منظومة Flow</h1>
          <p className="text-xs text-muted">نظام إدارة المبيعات والمخزون — تفعيل التثبيت</p>
        </div>

        {/* Status Message */}
        {reason && (
          <div className="p-3 bg-alert/10 border border-alert/30 text-alert text-xs rounded-control font-bold text-center">
            {reason}
          </div>
        )}

        {/* Tabs for Activation Mode */}
        <div className="grid grid-cols-2 p-1 bg-surface-2 rounded-control border border-line gap-1">
          <button
            type="button"
            onClick={() => { setMode('pin'); setError(''); }}
            className={`py-2 text-xs font-bold rounded-[6px] transition-all cursor-pointer ${
              mode === 'pin' ? 'bg-jade text-white shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            ⚡ تفعيل موزع سريع (Vendor PIN)
          </button>
          <button
            type="button"
            onClick={() => { setMode('key'); setError(''); }}
            className={`py-2 text-xs font-bold rounded-[6px] transition-all cursor-pointer ${
              mode === 'key' ? 'bg-jade text-white shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            🔑 إدخال مفتاح الترخيص
          </button>
        </div>

        {/* Machine Code Box */}
        <div className="bg-surface-2 p-3.5 rounded-control border border-line flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-muted block">
            كود الجهاز المولد (Machine Code):
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="mono text-base font-black tracking-widest text-jade">
              {machineCode}
            </span>
            <button
              type="button"
              onClick={handleCopyMachineCode}
              className="px-2.5 py-1 text-xs font-bold border border-jade/40 bg-jade/10 text-jade rounded-control hover:bg-jade/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Icons.Copy className="h-3.5 w-3.5" />
              {copied ? 'تم النسخ ✔' : 'نسخ'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-alert/10 border border-alert/30 text-alert text-xs rounded-control font-bold">
            {error}
          </div>
        )}

        {mode === 'pin' ? (
          /* Vendor PIN Activation Form */
          <form onSubmit={handleActivateByPin} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-muted mb-1 block">
                اسم المحل / العميل:
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full h-11 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none focus:border-jade"
                placeholder="مثال: مقهى السلام"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted mb-1 block">
                رمز الموزع المعتمد (Vendor PIN):
              </label>
              <input
                type="password"
                required
                autoFocus
                value={vendorPin}
                onChange={(e) => setVendorPin(e.target.value)}
                className="w-full h-11 rounded-control border border-line bg-surface px-3 text-sm font-mono focus-visible:outline-none focus:border-jade"
                placeholder="أدخل رمز الموزع المعتمد..."
              />
              <p className="text-[11px] text-muted mt-1">
                ادخل الرمز السري المعتمد للموزع لتفعيل المنظومة محلياً بضغط زر واحدة.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-sm shadow-md flex items-center justify-center gap-2"
            >
              {submitting ? 'جاري التحقق والتفعيل...' : '⚡ تفعيل المنظومة الآن'}
            </button>
          </form>
        ) : (
          /* License Key Form */
          <form onSubmit={handleActivateByKey} className="flex flex-col gap-4">
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
              {submitting ? 'جاري التحقق والتفعيل...' : 'تفعيل مفتاح الترخيص'}
            </button>
          </form>
        )}

        {/* Vendor Contact Footer */}
        <div className="border-t border-line pt-4 text-center text-[11px] text-muted flex flex-col gap-1">
          <span>لطلب الترخيص أو الدعم الفني:</span>
          <span className="mono font-bold text-text">Flow Dev — Intelligent Software Solutions</span>
        </div>
      </div>
    </div>
  );
};
