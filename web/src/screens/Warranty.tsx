import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatLYD } from '../lib/money';
import { apiCall } from '../lib/api';
import { Icons } from '../components/Icons';

export const WarrantyScreen: React.FC = () => {
  const { token } = useAuth();
  const { triggerToast } = useToast();

  const [serialQuery, setSerialQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [serviceTickets, setServiceTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // New Ticket Form State
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    serialNumber: '',
    productName: '',
    customerName: '',
    customerPhone: '',
    faultDescription: '',
    inWarranty: true,
  });

  // Edit Ticket State
  const [editingTicket, setEditingTicket] = useState<any | null>(null);
  const [ticketEditData, setTicketEditData] = useState({
    diagnosis: '',
    parts: '',
    laborCost: '',
    partsCost: '',
    status: 'open',
  });

  const fetchTickets = async () => {
    const res = await apiCall('/api/service-tickets');
    if (res.success) {
      setServiceTickets(res.data);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialQuery.trim()) return;
    setLoading(true);
    const res = await apiCall(`/api/warranties/lookup/${encodeURIComponent(serialQuery.trim())}`);
    if (res.success) {
      setLookupResult(res.data);
    } else {
      triggerToast(res.error || 'لم يتم العثور على سجلات لهذا الرقم التسلسلي', 'alert');
    }
    setLoading(false);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall('/api/service-tickets', 'POST', newTicket);

    if (res.success) {
      triggerToast(`تم فتح تذكرة الصيانة #${res.data.ticketNumber} بنجاح`);
      setShowNewTicketModal(false);
      setNewTicket({
        serialNumber: '',
        productName: '',
        customerName: '',
        customerPhone: '',
        faultDescription: '',
        inWarranty: true,
      });
      fetchTickets();
    } else {
      triggerToast(res.error || 'فشل إنشاء تذكرة الصيانة', 'alert');
    }
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;

    const res = await apiCall(`/api/service-tickets/${editingTicket.id}`, 'PUT', {
      diagnosis: ticketEditData.diagnosis,
      parts: ticketEditData.parts,
      laborCost: Math.round(parseFloat(ticketEditData.laborCost || '0') * 1000),
      partsCost: Math.round(parseFloat(ticketEditData.partsCost || '0') * 1000),
      status: ticketEditData.status,
    });

    if (res.success) {
      triggerToast(`تم تحديث تذكرة الصيانة بنجاح`);
      setEditingTicket(null);
      fetchTickets();
    } else {
      triggerToast(res.error || 'فشل تحديث تذكرة الصيانة', 'alert');
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-5 rounded-card border border-line shadow-sm">
        <div>
          <span className="mono text-xs tracking-widest text-copper">إدارة الضمان والصيانة</span>
          <h1 className="text-2xl font-extrabold">تذاكر الخدمة وتتبع الأرقام التسلسلية</h1>
        </div>

        <button
          onClick={() => setShowNewTicketModal(true)}
          className="flex items-center gap-2 py-2.5 px-4 bg-jade text-white rounded-control text-xs font-bold hover:bg-jade/90 shadow-sm transition-all cursor-pointer"
        >
          <span>🛠️ فتح تذكرة صيانة جديدة</span>
        </button>
      </div>

      {/* Serial Number Lookup Box */}
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-base font-bold mb-3">الاستعلام السريع عن الضمان برقم السيريال</h2>
        <form onSubmit={handleLookup} className="flex gap-3 max-w-xl">
          <input
            type="text"
            value={serialQuery}
            onChange={(e) => setSerialQuery(e.target.value)}
            placeholder="أدخل الرقم التسلسلي (Serial Number)..."
            className="flex-1 px-4 py-2.5 bg-surface-2 border border-line rounded-control text-xs font-mono focus:border-jade outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-copper text-white rounded-control text-xs font-bold hover:bg-copper/90 transition-all cursor-pointer"
          >
            بحث ومطابقة
          </button>
        </form>

        {lookupResult && (
          <div className="mt-4 p-4 rounded-card border border-line bg-surface-2 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-mono font-bold text-sm text-copper">
                السيريال: {serialQuery}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  lookupResult.isInWarranty
                    ? 'bg-jade/10 text-jade border border-jade/30'
                    : 'bg-alert/10 text-alert border border-alert/30'
                }`}
              >
                {lookupResult.isInWarranty ? '🛡️ ساري الضمان' : '❌ منتهي الضمان / غير مسجل'}
              </span>
            </div>

            {lookupResult.warranty ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mt-2">
                <div>المنتج: <span className="font-bold">{lookupResult.warranty.productName}</span></div>
                <div>تاريخ الشراء: <span className="mono font-bold">{lookupResult.warranty.startDate}</span></div>
                <div>تاريخ الانتهاء: <span className="mono font-bold">{lookupResult.warranty.endDate}</span></div>
              </div>
            ) : (
              <p className="text-xs text-muted">لا يوجد سجل بيع مسجل لهذا السيريال.</p>
            )}
          </div>
        )}
      </div>

      {/* Service Tickets List */}
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">سجل تذاكر الصيانة والخدمة</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-surface-2 text-muted font-bold border-b border-line">
              <tr>
                <th className="p-3">رقم التذكرة</th>
                <th className="p-3">اسم الجهاز / السيريال</th>
                <th className="p-3">العميل</th>
                <th className="p-3">وصف العطل</th>
                <th className="p-3 text-center">الضمان</th>
                <th className="p-3 text-center">التكلفة</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {serviceTickets.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 font-mono font-bold text-jade">{t.ticketNumber}</td>
                  <td className="p-3 font-bold">
                    {t.productName}
                    <span className="block text-[11px] mono text-muted">{t.serialNumber}</span>
                  </td>
                  <td className="p-3">
                    {t.customerName || 'نقدي عام'}
                    {t.customerPhone && <span className="block text-[11px] mono text-muted">{t.customerPhone}</span>}
                  </td>
                  <td className="p-3 max-w-xs truncate">{t.faultDescription}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        t.inWarranty ? 'bg-jade/10 text-jade' : 'bg-copper/10 text-copper'
                      }`}
                    >
                      {t.inWarranty ? 'ضمن الضمان' : 'خارج الضمان'}
                    </span>
                  </td>
                  <td className="p-3 text-center mono font-bold">
                    {formatLYD(t.totalCost)} د.ل
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        t.status === 'delivered'
                          ? 'bg-jade/10 text-jade'
                          : t.status === 'done'
                            ? 'bg-blue-500/10 text-blue-500'
                            : t.status === 'repairing'
                              ? 'bg-copper/10 text-copper animate-pulse'
                              : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {t.status === 'open'
                        ? 'مفتوحة'
                        : t.status === 'repairing'
                          ? 'قيد الإصلاح'
                          : t.status === 'done'
                            ? 'جاهزة للتسليم'
                            : 'تم التسليم'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => {
                        setEditingTicket(t);
                        setTicketEditData({
                          diagnosis: t.diagnosis || '',
                          parts: t.parts || '',
                          laborCost: (t.laborCost / 1000).toString(),
                          partsCost: (t.partsCost / 1000).toString(),
                          status: t.status,
                        });
                      }}
                      className="px-2.5 py-1 bg-surface border border-line rounded text-xs hover:bg-surface-2 transition-all cursor-pointer"
                    >
                      تعديل/تحديث
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-2xl flex flex-col gap-4">
            <h2 className="text-lg font-bold">فتح تذكرة صيانة واستلام جهاز جديدة</h2>
            <form onSubmit={handleCreateTicket} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">الرقم التسلسلي (Serial Number) *</label>
                <input
                  type="text"
                  required
                  value={newTicket.serialNumber}
                  onChange={(e) => setNewTicket({ ...newTicket, serialNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">اسم الجهاز / المعدة *</label>
                <input
                  type="text"
                  required
                  value={newTicket.productName}
                  onChange={(e) => setNewTicket({ ...newTicket, productName: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1">اسم العميل</label>
                  <input
                    type="text"
                    value={newTicket.customerName}
                    onChange={(e) => setNewTicket({ ...newTicket, customerName: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">هاتف العميل</label>
                  <input
                    type="text"
                    value={newTicket.customerPhone}
                    onChange={(e) => setNewTicket({ ...newTicket, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">وصف العطل / الملاحظات *</label>
                <textarea
                  required
                  rows={3}
                  value={newTicket.faultDescription}
                  onChange={(e) => setNewTicket({ ...newTicket, faultDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="inWarranty"
                  checked={newTicket.inWarranty}
                  onChange={(e) => setNewTicket({ ...newTicket, inWarranty: e.target.checked })}
                  className="rounded border-line"
                />
                <label htmlFor="inWarranty" className="text-xs font-bold cursor-pointer">
                  تغطية الصيانة ضمن فترة الضمان
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 bg-surface-2 border border-line rounded-control text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-jade text-white rounded-control text-xs font-bold hover:bg-jade/90"
                >
                  حفظ وتأكيد الاستلام
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {editingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-2xl flex flex-col gap-4">
            <h2 className="text-lg font-bold">تحديث حالة وتكاليف تذكرة الصيانة #{editingTicket.ticketNumber}</h2>
            <form onSubmit={handleUpdateTicket} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">التشخيص الفني (Diagnosis)</label>
                <textarea
                  rows={2}
                  value={ticketEditData.diagnosis}
                  onChange={(e) => setTicketEditData({ ...ticketEditData, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold block mb-1">قطع الغيار المستبدلة</label>
                <input
                  type="text"
                  value={ticketEditData.parts}
                  onChange={(e) => setTicketEditData({ ...ticketEditData, parts: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs"
                />
              </div>

              {!editingTicket.inWarranty && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold block mb-1">تكلفة المصنعية / اليد (د.ل)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={ticketEditData.laborCost}
                      onChange={(e) => setTicketEditData({ ...ticketEditData, laborCost: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">تكلفة قطع الغيار (د.ل)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={ticketEditData.partsCost}
                      onChange={(e) => setTicketEditData({ ...ticketEditData, partsCost: e.target.value })}
                      className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold block mb-1">حالة التذكرة *</label>
                <select
                  value={ticketEditData.status}
                  onChange={(e) => setTicketEditData({ ...ticketEditData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-2 border border-line rounded-control text-xs font-bold"
                >
                  <option value="open">مفتوحة</option>
                  <option value="repairing">قيد الإصلاح</option>
                  <option value="done">جاهزة للتسليم</option>
                  <option value="delivered">تم التسليم والتحصيل</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setEditingTicket(null)}
                  className="px-4 py-2 bg-surface-2 border border-line rounded-control text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-jade text-white rounded-control text-xs font-bold hover:bg-jade/90"
                >
                  حفظ التغييرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
