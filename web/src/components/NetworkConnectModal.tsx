import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { apiCall } from '../lib/api';
import { Icons } from './Icons';

interface NetworkConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkConnectModal: React.FC<NetworkConnectModalProps> = ({ isOpen, onClose }) => {
  const [networkUrls, setNetworkUrls] = useState<string[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOtherAddresses, setShowOtherAddresses] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setShowOtherAddresses(false);

    const fetchNetworkInfo = async () => {
      setLoading(true);
      try {
        const res: any = await apiCall('/api/network/info');
        const data = res?.success ? res.data : undefined;
        const urls: string[] = Array.isArray(data?.urls) ? data.urls : [];
        if (urls.length > 0) {
          setNetworkUrls(urls);
          // The server already filters out virtual adapters (VirtualBox,
          // VPNs, Docker…) and picks the most likely real LAN address —
          // lead with that instead of showing every candidate up front,
          // which just confuses whoever is scanning the code.
          setSelectedUrl(data.recommendedUrl && urls.includes(data.recommendedUrl) ? data.recommendedUrl : urls[0]);
        } else {
          const fallback = `http://${window.location.hostname}:3001`;
          setNetworkUrls([fallback]);
          setSelectedUrl(fallback);
        }
      } catch (err) {
        const fallback = `http://${window.location.hostname}:3001`;
        setNetworkUrls([fallback]);
        setSelectedUrl(fallback);
      } finally {
        setLoading(false);
      }
    };

    fetchNetworkInfo();
  }, [isOpen]);

  useEffect(() => {
    if (!selectedUrl) return;
    QRCode.toDataURL(selectedUrl, { width: 260, margin: 2 }, (err, url) => {
      if (!err && url) {
        setQrCodeDataUrl(url);
      }
    });
  }, [selectedUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 no-print" dir="rtl">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-line p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2 text-jade font-display text-lg font-extrabold">
            <span className="text-xl">📱</span>
            <h2>ربط أجهزة الكاشير عبر الشبكة المحليّة</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-xs text-muted leading-relaxed">
            افتح **كاميرا هاتف الكاشير أو الأيباد** ووجّهها نحو الرمز المربع للدخول المباشر إلى المنظومة بدون كتابة أي عنوان.
          </p>

          {loading ? (
            <div className="flex h-52 w-52 items-center justify-center rounded-2xl bg-surface-2 text-xs text-muted">
              جاري فحص الشبكة...
            </div>
          ) : qrCodeDataUrl ? (
            <div className="rounded-2xl p-3 bg-white border border-line shadow-md">
              <img src={qrCodeDataUrl} alt="Network QR Code" className="h-52 w-52" />
            </div>
          ) : null}

          <div className="w-full rounded-xl bg-surface-2 p-3 border border-line space-y-2">
            <div className="text-[11px] font-bold text-muted">العنوان المباشر في المتصفح:</div>
            <div className="flex items-center justify-between gap-2">
              <span className="mono font-bold text-sm text-jade truncate">{selectedUrl}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-jade/10 text-jade hover:bg-jade/20 cursor-pointer"
              >
                <Icons.Copy className="h-4 w-4" />
                <span>{copied ? 'تم النسخ ✓' : 'نسخ'}</span>
              </button>
            </div>
          </div>

          {networkUrls.length > 1 && (
            <div className="w-full text-right">
              {!showOtherAddresses ? (
                <button
                  type="button"
                  onClick={() => setShowOtherAddresses(true)}
                  className="text-[11px] font-bold text-muted hover:text-jade cursor-pointer"
                >
                  الرمز لا يعمل على الجوال؟ جرّب عنواناً آخر ▾
                </button>
              ) : (
                <>
                  <label className="text-[11px] font-bold text-muted mb-1 block">
                    هذا الجهاز متصل بأكثر من شبكة — اختر العنوان الصحيح:
                  </label>
                  <select
                    value={selectedUrl}
                    onChange={(e) => setSelectedUrl(e.target.value)}
                    className="w-full h-9 rounded-control border border-line bg-surface-2 px-3 text-xs mono font-bold focus:outline-none"
                  >
                    {networkUrls.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-surface-2 border border-line text-muted font-bold text-xs rounded-control hover:text-text cursor-pointer"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
};
