import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import { apiCall } from '../lib/api';
import { triggerPrint } from '../lib/print';
import { formatDate, formatDateTime } from '../lib/datetime';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';

export const StocktakingScreen: React.FC<{
  onOpenPinOverride: (reason: string, callback: (pin: string) => void) => void;
}> = ({ onOpenPinOverride }) => {
  const { currentUser } = useAuth();
  const { triggerToast } = useToast();
  const { productsList } = useData();

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [activeSessionItems, setActiveSessionItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Scan / Manual count form
  const [scanBarcode, setScanBarcode] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [countInput, setCountInput] = useState('1');

  // New session modal
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const fetchSessions = async () => {
    const res = await apiCall('/api/stocktaking');
    if (res.success) {
      setSessions(res.data);
    }
  };

  const fetchSessionDetails = async (id: number) => {
    setLoading(true);
    const res = await apiCall(`/api/stocktaking/${id}`);
    if (res.success) {
      setActiveSession(res.data);
      setActiveSessionItems(res.data.items || []);
    } else {
      triggerToast(res.error || 'فشل جلب تفاصيل الجلسة', 'alert');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (activeSession && activeSession.status === 'open' && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [activeSession]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall('/api/stocktaking', 'POST', { notes: sessionNotes });
    if (res.success) {
      triggerToast(`تم فتح جلسة جرد جديدة #${res.data.id}`);
      setShowNewSessionModal(false);
      setSessionNotes('');
      fetchSessions();
      fetchSessionDetails(res.data.id);
    } else {
      triggerToast(res.error || 'فشل إنشاء جلسة الجرد', 'alert');
    }
  };

  const handleRecordCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || activeSession.status !== 'open') return;

    if (!selectedProductId && !scanBarcode) {
      triggerToast('يرجى اختيار منتج أو مسح باركود', 'alert');
      return;
    }

    const payload = {
      productId: selectedProductId ? Number(selectedProductId) : undefined,
      barcode: scanBarcode || undefined,
      countedQty: Number(countInput),
    };

    const res = await apiCall(`/api/stocktaking/${activeSession.id}/count`, 'POST', payload);
    if (res.success) {
      triggerToast('تم تسجيل كمية الجرد بنجاح');
      setActiveSessionItems(res.data.items || []);
      setScanBarcode('');
      setSelectedProductId('');
      setCountInput('1');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    } else {
      triggerToast(res.error || 'فشل تسجيل كمية الجرد', 'alert');
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    const res = await apiCall(`/api/stocktaking/${activeSession.id}/close`, 'POST', {});
    if (res.success) {
      triggerToast('تم إغلاق جلسة الجرد بنجاح');
      fetchSessionDetails(activeSession.id);
      fetchSessions();
    } else {
      triggerToast(res.error || 'فشل إغلاق جلسة الجرد', 'alert');
    }
  };

  const handleApplyVariances = async () => {
    if (!activeSession) return;

    const executeApply = async (pin?: string) => {
      const res = await apiCall(`/api/stocktaking/${activeSession.id}/apply`, 'POST', {
        overridePin: pin,
      });
      if (res.success) {
        triggerToast('تم تسوية واعتماد فروقات الجرد في قاعدة البيانات والمخزون بنجاح');
        fetchSessionDetails(activeSession.id);
        fetchSessions();
      } else {
        triggerToast(res.error || 'فشل اعتماد فروقات الجرد', 'alert');
      }
    };

    if (currentUser?.role !== 'manager') {
      onOpenPinOverride(
        `تسوية واعتماد نتائج جلسة الجرد #${activeSession.id}`,
        (pin) => executeApply(pin)
      );
    } else {
      executeApply();
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-5 rounded-card border border-line shadow-sm">
        <div>
          <span className="mono text-xs tracking-widest text-copper">المخزون والجرد</span>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <span>الجرد الذكي والمطابقة بالمسبار / الباركود</span>
          </h1>
        </div>

        <button
          onClick={() => setShowNewSessionModal(true)}
          className="py-2.5 px-4 bg-jade text-white font-bold text-xs rounded-control hover:bg-jade-2 transition-all cursor-pointer flex items-center gap-2 shadow-sm"
        >
          <Icons.Plus className="h-4 w-4" />
          <span>بدء جلسة جرد جديدة</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List Column */}
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-bold pb-2 border-b border-line">جلسات الجرد الأخيرة</h2>

          <div className="flex flex-col gap-2 overflow-y-auto max-h-[500px]">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => fetchSessionDetails(s.id)}
                className={`p-3 rounded-control border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                  activeSession?.id === s.id
                    ? 'border-jade bg-jade/5 shadow-sm'
                    : 'border-line bg-surface-2 hover:border-border'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs">جلسة جرد #{s.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === 'open'
                        ? 'bg-copper/10 text-copper border border-copper/20'
                        : s.status === 'closed'
                          ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          : 'bg-jade/10 text-jade border border-jade/20'
                    }`}
                  >
                    {s.status === 'open'
                      ? 'جاري الجرد (مفتوحة)'
                      : s.status === 'closed'
                        ? 'مغلقة'
                        : 'معتمدة ومعدلة'}
                  </span>
                </div>
                <div className="text-[11px] text-muted">
                  بواسطة: {s.username} — <span className="mono">{formatDate(s.createdAt)}</span>
                </div>
                {s.notes && <div className="text-[11px] text-muted italic">"{s.notes}"</div>}
              </button>
            ))}

            {sessions.length === 0 && (
              <div className="p-8 text-center text-muted text-xs">لا توجد جلسات جرد سابقة.</div>
            )}
          </div>
        </div>

        {/* Active Session Content */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {activeSession ? (
            <div className="flex flex-col gap-4 bg-surface p-5 rounded-card border border-line shadow-sm">
              {/* Session Overview Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-line">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">تفاصيل الجلسة #{activeSession.id}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        activeSession.status === 'open'
                          ? 'bg-copper/10 text-copper'
                          : activeSession.status === 'closed'
                            ? 'bg-blue-500/10 text-blue-600'
                            : 'bg-jade/10 text-jade'
                      }`}
                    >
                      {activeSession.status === 'open'
                        ? 'مفتوحة'
                        : activeSession.status === 'closed'
                          ? 'مغلقة (في انتظار الاعتماد)'
                          : 'معتمدة ورسمية'}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    تاريخ البدء: <span className="mono">{formatDateTime(activeSession.createdAt)}</span> — القائم بالجرد: {activeSession.username}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeSession.status === 'open' && (
                    <button
                      onClick={handleCloseSession}
                      className="py-1.5 px-3 bg-copper text-white font-bold text-xs rounded-control hover:bg-copper/90 transition-all cursor-pointer"
                    >
                      إغلاق الجلسة
                    </button>
                  )}
                  {activeSession.status === 'closed' && (
                    <button
                      onClick={handleApplyVariances}
                      className="py-1.5 px-3 bg-jade text-white font-bold text-xs rounded-control hover:bg-jade-2 transition-all cursor-pointer"
                    >
                      اعتماد الفروقات وتعديل المخزون
                    </button>
                  )}
                  <button
                    onClick={() => triggerPrint()}
                    className="py-1.5 px-3 border border-border text-muted font-bold text-xs rounded-control hover:text-text cursor-pointer flex items-center gap-1"
                  >
                    <Icons.Printer className="h-3.5 w-3.5" />
                    <span>طباعة التقرير</span>
                  </button>
                </div>
              </div>

              {/* Barcode & Product Counting Input Form (Open Session Only) */}
              {activeSession.status === 'open' && (
                <form
                  onSubmit={handleRecordCount}
                  className="p-3 bg-surface-2 rounded-control border border-line flex flex-col sm:flex-row gap-3 items-end"
                >
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-muted mb-1 block">
                      امسح الباركود بالمسبار
                    </label>
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={scanBarcode}
                      onChange={(e) => {
                        setScanBarcode(e.target.value);
                        setSelectedProductId('');
                      }}
                      placeholder="امسح الباركود هنا..."
                      className="w-full h-9 rounded border border-line bg-surface px-2 text-xs mono focus-visible:outline-none focus:border-jade"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-muted mb-1 block">
                      أو اختر المنتج يدوياً
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => {
                        setSelectedProductId(e.target.value);
                        setScanBarcode('');
                      }}
                      className="w-full h-9 rounded border border-line bg-surface px-2 text-xs focus-visible:outline-none"
                    >
                      <option value="">— اختر المنتج —</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.quantity} {p.baseUnit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="text-[11px] font-bold text-muted mb-1 block">العدد المعاين</label>
                    <input
                      type="number"
                      required
                      value={countInput}
                      onChange={(e) => setCountInput(e.target.value)}
                      className="w-full h-9 rounded border border-line bg-surface px-2 text-xs mono font-bold focus-visible:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="py-2 px-4 bg-jade text-white font-bold text-xs rounded hover:bg-jade-2 transition-all cursor-pointer h-9"
                  >
                    تسجيل العدد
                  </button>
                </form>
              )}

              {/* Items Table */}
              <div className="overflow-x-auto border border-line rounded-control">
                <table className="w-full text-xs text-right">
                  <thead className="bg-surface-2 text-muted font-bold border-b border-line">
                    <tr>
                      <th className="p-3">اسم المنتج</th>
                      <th className="p-3">الباركد</th>
                      <th className="p-3 text-center">الكمية في النظام</th>
                      <th className="p-3 text-center">الكمية المعاينة (الجرد)</th>
                      <th className="p-3 text-center">الفارق (عجز / زيادة)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {activeSessionItems.map((item) => {
                      const isShortage = item.variance < 0;
                      const isOverage = item.variance > 0;

                      return (
                        <tr key={item.id} className="hover:bg-surface-2/50">
                          <td className="p-3 font-bold">{item.productName}</td>
                          <td className="p-3 mono text-muted">{item.barcode || '—'}</td>
                          <td className="p-3 text-center mono font-bold">
                            {currentUser?.role === 'sales' && activeSession.status === 'open'
                              ? '🔒 مخفي (جرد أعمى)'
                              : item.expectedQty}
                          </td>
                          <td className="p-3 text-center mono font-bold text-jade">
                            {item.countedQty}
                          </td>
                          <td className="p-3 text-center mono font-bold">
                            {currentUser?.role === 'sales' && activeSession.status === 'open' ? (
                              '—'
                            ) : item.variance === 0 ? (
                              <span className="text-muted">مطابق ✓</span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  isShortage
                                    ? 'bg-alert/10 text-alert'
                                    : 'bg-jade/10 text-jade'
                                }`}
                              >
                                {isShortage ? `عجز: ${item.variance}` : `زيادة: +${item.variance}`}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {activeSessionItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted text-xs">
                          لم يتم إدخال أو مسح أي أصناف في هذه الجلسة بعد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 border border-line rounded-card bg-surface text-center text-muted text-xs">
              اختر جلسة جرد من القائمة الجانبية أو ابدأ جلسة جديدة.
            </div>
          )}
        </div>
      </div>

      {/* New Session Modal */}
      <Modal
        isOpen={showNewSessionModal}
        onClose={() => setShowNewSessionModal(false)}
        title="بدء جلسة جرد جديدة للمخزون"
      >
        <form onSubmit={handleStartSession} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="font-bold text-muted mb-1 block">ملاحظات الجلسة (اختياري)</label>
            <input
              type="text"
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="مثال: جرد الربع الثاني، جرد قسم الأجهزة..."
              className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-jade text-white font-bold rounded-control hover:bg-jade-2 cursor-pointer"
            >
              بدء الجلسة الآن
            </button>
            <button
              type="button"
              onClick={() => setShowNewSessionModal(false)}
              className="flex-1 py-2.5 border border-border text-muted font-bold rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
