import React, { useState, useEffect } from 'react';
import type { Sale } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useData } from '../context/DataContext';
import { formatLYD } from '../lib/money';
import { apiCall } from '../lib/api';
import { Icons } from '../components/Icons';

interface ReportsProps {
  onOpenInvoicePrint: (sale: Sale) => void;
  onCancelInvoice: (sale: Sale) => void;
  onExportCSV: (type: 'sales' | 'products' | 'shifts') => void;
}

export const Reports: React.FC<ReportsProps> = ({
  onOpenInvoicePrint,
  onCancelInvoice,
  onExportCSV,
}) => {
  const { token, currentUser } = useAuth();
  const { triggerToast } = useToast();
  const { salesList } = useData();

  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    let startDate = '';
    const now = new Date();

    if (period === 'today') {
      startDate = now.toISOString().slice(0, 10);
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().slice(0, 10);
    } else if (period === 'month') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().slice(0, 10);
    }

    const query = startDate ? `?startDate=${startDate}&slowDays=30` : '?slowDays=30';
    const res = await apiCall(`/api/reports/analytics${query}`);
    if (res.success) {
      setAnalyticsData(res.data);
    } else {
      triggerToast(res.error || 'فشل جلب التقارير التحليلية', 'alert');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const downloadExcel = (type: string) => {
    if (!token) return;
    const url = `/api/reports/excel?type=${type}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `تقرير_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        triggerToast('تم تحميل ملف الاكسيل (.xlsx) بنجاح');
      });
  };

  const trendPoints = (() => {
    if (!analyticsData?.trendData || analyticsData.trendData.length === 0) return [];
    const arr = analyticsData.trendData;
    const maxVal = Math.max(...arr.map((p: any) => p.sales / 1000), 10);
    return arr.map((p: any, idx: number) => {
      const x = 45 + (idx * 500) / Math.max(1, arr.length - 1);
      const y = 160 - ((p.sales / 1000) / maxVal) * 120;
      return { ...p, x, y };
    });
  })();

  const linePath = trendPoints.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = trendPoints.length && trendPoints[0] && trendPoints[trendPoints.length - 1]
    ? `${linePath} L ${trendPoints[trendPoints.length - 1].x} 160 L ${trendPoints[0].x} 160 Z`
    : '';

  const summary = analyticsData?.summary;

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header & Period Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-5 rounded-card border border-line shadow-sm">
        <div>
          <span className="mono text-xs tracking-widest text-copper">التحليلات والمبيعات</span>
          <h1 className="text-2xl font-extrabold">التقارير البيانية والمالية التفاعلية</h1>
        </div>

        <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-control border border-line">
          <button
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-control text-xs font-bold transition-all cursor-pointer ${
              period === 'today' ? 'bg-jade text-white shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1.5 rounded-control text-xs font-bold transition-all cursor-pointer ${
              period === 'week' ? 'bg-jade text-white shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-control text-xs font-bold transition-all cursor-pointer ${
              period === 'month' ? 'bg-jade text-white shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            آخر 30 يوماً
          </button>
          <button
            onClick={() => setPeriod('all')}
            className={`px-3 py-1.5 rounded-control text-xs font-bold transition-all cursor-pointer ${
              period === 'all' ? 'bg-jade text-white shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            الكل
          </button>
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-card border border-line bg-surface shadow-sm">
          <span className="text-xs font-bold text-muted block mb-1">صافي المبيعات</span>
          <div className="mono font-black text-2xl text-jade">
            {formatLYD(summary?.netSales || 0)} د.ل
          </div>
          <span className="text-[11px] text-muted mt-1 block">
            {summary?.completedInvoicesCount || 0} فاتورة مكتملة
          </span>
        </div>

        <div className="p-5 rounded-card border border-line bg-surface shadow-sm">
          <span className="text-xs font-bold text-muted block mb-1">صافي الأرباح المحققة</span>
          <div className="mono font-black text-2xl text-copper">
            {formatLYD(summary?.totalProfit || 0)} د.ل
          </div>
          <span className="text-[11px] text-muted mt-1 block">
            تكلفة البضاعة: {formatLYD(summary?.totalCost || 0)} د.ل
          </span>
        </div>

        <div className="p-5 rounded-card border border-line bg-surface shadow-sm">
          <span className="text-xs font-bold text-muted block mb-1">إجمالي الخصومات الممنوحة</span>
          <div className="mono font-black text-2xl text-text">
            {formatLYD(summary?.totalDiscount || 0)} د.ل
          </div>
          <span className="text-[11px] text-muted mt-1 block">خصومات الفواتير المعتمدة</span>
        </div>

        <div className="p-5 rounded-card border border-line bg-surface shadow-sm">
          <span className="text-xs font-bold text-muted block mb-1">بضاعة بطيئة الحركة (تجميد)</span>
          <div className="mono font-black text-2xl text-alert">
            {analyticsData?.slowMovingProducts?.length || 0} أصناف
          </div>
          <span className="text-[11px] text-muted mt-1 block">لم تُباع منذ 30 يوماً</span>
        </div>
      </div>

      {/* Excel / CSV Exports Action Bar */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-base font-bold mb-3">تصدير التقارير والدفاتر (Excel / CSV)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => downloadExcel('sales')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-jade/10 text-jade border border-jade/30 rounded-control text-xs font-bold hover:bg-jade/20 transition-all cursor-pointer"
          >
            <span>📊 تصدير فواتير المبيعات (Excel .xlsx)</span>
          </button>

          <button
            onClick={() => downloadExcel('products')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-copper/10 text-copper border border-copper/30 rounded-control text-xs font-bold hover:bg-copper/20 transition-all cursor-pointer"
          >
            <span>📦 تصدير المنتجات والمخزون (Excel .xlsx)</span>
          </button>

          <button
            onClick={() => onExportCSV('shifts')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-2 border border-line text-text rounded-control text-xs font-bold hover:bg-border transition-all cursor-pointer"
          >
            <span>🧾 تصدير التوكات اليومية (CSV)</span>
          </button>
        </div>
      </div>

      {/* Interactive Sales Trend Chart */}
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">منحنى اتجاه المبيعات اليومي</h2>
        <div className="relative w-full h-[220px]">
          {trendPoints.length > 0 ? (
            <svg className="w-full h-full overflow-visible" viewBox="0 0 580 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              <path d={areaPath} fill="url(#salesGradient)" />
              <path d={linePath} fill="none" stroke="#10b981" strokeWidth="3" />

              {trendPoints.map((p: any, idx: number) => (
                <g key={idx}>
                  <circle cx={p.x} cy={p.y} r="4" fill="#10b981" />
                  <text x={p.x} y="175" textAnchor="middle" className="text-[9px] fill-muted">
                    {p.date.slice(5)}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center text-muted text-xs">
              لا توجد مبيعات مسجلة في هذه الفترة.
            </div>
          )}
        </div>
      </div>

      {/* Grid 2: Top Selling Products & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Selling Products */}
        <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-bold mb-3">الأكثر مبيعاً وتحقيقاً للإيرادات</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-surface-2 text-muted font-bold border-b border-line">
                <tr>
                  <th className="p-2.5">المنتج</th>
                  <th className="p-2.5 text-center">الكمية المباعة</th>
                  <th className="p-2.5 text-center">الإيراد</th>
                  <th className="p-2.5 text-center">الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {analyticsData?.topProducts?.map((p: any) => (
                  <tr key={p.id}>
                    <td className="p-2.5 font-bold">{p.name}</td>
                    <td className="p-2.5 text-center mono font-bold">{p.qty}</td>
                    <td className="p-2.5 text-center mono font-bold text-jade">
                      {formatLYD(p.revenue)} د.ل
                    </td>
                    <td className="p-2.5 text-center mono font-bold text-copper">
                      {formatLYD(p.profit)} د.ل
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slow Moving Stock Table */}
        <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
          <h2 className="text-base font-bold mb-3">المنتجات الراكدة (تجميد سيولة &gt; 30 يوماً)</h2>
          <div className="overflow-y-auto max-h-[300px]">
            <table className="w-full text-xs text-right">
              <thead className="bg-surface-2 text-muted font-bold border-b border-line">
                <tr>
                  <th className="p-2.5">المنتج</th>
                  <th className="p-2.5 text-center">المخزون الراكد</th>
                  <th className="p-2.5 text-center">رأس المال المجمد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {analyticsData?.slowMovingProducts?.map((p: any) => (
                  <tr key={p.id}>
                    <td className="p-2.5 font-bold">{p.name}</td>
                    <td className="p-2.5 text-center mono font-bold text-alert">
                      {p.quantity} {p.baseUnit}
                    </td>
                    <td className="p-2.5 text-center mono font-bold text-alert">
                      {formatLYD(p.tiedCapital)} د.ل
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grid 3: Sales Invoice Log */}
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">سجل الفواتير الأخيرة ومراجعة الصلاحيات</h2>

        <div className="overflow-y-auto max-h-[480px] flex flex-col gap-3">
          {salesList.map((sale) => (
            <div
              key={sale.id}
              className="p-4 border border-line rounded-[12px] bg-surface-2 flex flex-col gap-2"
            >
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-sm text-jade">
                  {sale.invoiceNumber}
                </span>
                <div className="flex items-center gap-1.5">
                  {sale.paymentType === 'credit' && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-copper/10 text-copper border border-copper/20">
                      آجل
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      sale.status === 'completed' ? 'bg-jade/10 text-jade' : 'bg-red-500/10 text-alert'
                    }`}
                  >
                    {sale.status === 'completed' ? 'مدفوعة' : 'ملغاة'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-muted">
                  المسؤول: {sale.username}
                  {sale.customerName ? ` — العميل: ${sale.customerName}` : ''}
                </span>
                <span className="text-muted">
                  طريقة الدفع:{' '}
                  <span className="font-bold text-text">
                    {sale.paymentMethod === 'cash'
                      ? 'كاش'
                      : sale.paymentMethod === 'card'
                        ? 'بطاقة مصرفية'
                        : 'حوالة مصرفية'}
                  </span>
                </span>
                <span className="mono">
                  {new Date(sale.createdAt).toLocaleString('ar-LY')}
                </span>
              </div>

              <div className="border-t border-dashed border-border pt-2 mt-1 flex justify-between items-center">
                <div className="mono font-bold text-sm">
                  الإجمالي: {formatLYD(sale.total)} د.ل
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenInvoicePrint(sale)}
                    className="text-xs bg-surface border border-border px-2.5 py-1 rounded hover:bg-surface-2 transition-all cursor-pointer"
                  >
                    عرض وطباعة
                  </button>
                  {sale.status === 'completed' && (
                    <button
                      onClick={() => onCancelInvoice(sale)}
                      className="text-xs bg-red-500/5 text-alert border border-red-500/20 px-2.5 py-1 rounded hover:bg-red-500/10 transition-all cursor-pointer"
                    >
                      إلغاء الفاتورة
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
