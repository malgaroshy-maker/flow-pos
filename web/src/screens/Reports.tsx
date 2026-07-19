import React from 'react';
import type { Sale } from '../types';
import { useData } from '../context/DataContext';
import { formatLYD } from '../lib/money';
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
  const { salesList, productsList } = useData();

  // Helper calculation for last 7 days chart
  const points = (() => {
    const arr = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0] || '';
      const daySales = salesList
        .filter((s) => s.status === 'completed' && s.createdAt.startsWith(dateStr))
        .reduce((sum, s) => sum + s.total, 0);

      const dayName = d.toLocaleDateString('ar-LY', { weekday: 'short' });
      arr.push({
        dateStr,
        dayName,
        total: daySales / 1000, // convert milli-LYD to LYD float for chart y-axis
      });
    }

    const maxVal = Math.max(...arr.map((p) => p.total), 10);
    return arr.map((p, idx) => {
      const x = 45 + idx * 70;
      const y = 160 - (p.total / maxVal) * 120;
      return { ...p, x, y };
    });
  })();

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length && points[0] && points[points.length - 1]
    ? `${linePath} L ${points[points.length - 1]!.x} 160 L ${points[0]!.x} 160 Z`
    : '';

  // Payment methods totals
  const completedSales = salesList.filter((s) => s.status === 'completed');
  const cash =
    completedSales
      .filter((s) => s.paymentMethod === 'cash')
      .reduce((sum, s) => sum + s.total, 0) / 1000;
  const card =
    completedSales
      .filter((s) => s.paymentMethod === 'card')
      .reduce((sum, s) => sum + s.total, 0) / 1000;
  const transfer =
    completedSales
      .filter((s) => s.paymentMethod === 'transfer')
      .reduce((sum, s) => sum + s.total, 0) / 1000;
  const grandTotal = cash + card + transfer || 1;

  const cashPct = Math.round((cash / grandTotal) * 100);
  const cardPct = Math.round((card / grandTotal) * 100);
  const transferPct = Math.round((transfer / grandTotal) * 100);

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div>
        <span className="mono text-xs tracking-widest text-copper">السجلات والإحصائيات</span>
        <h1 className="text-3xl font-extrabold">التقارير المكتملة وتصدير البيانات</h1>
      </div>

      {/* Quick Export Tools */}
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-3">تصدير واستخراج الدفاتر والبيانات (Excel / CSV)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => onExportCSV('sales')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-2 hover:bg-border border border-line text-text rounded-control text-xs font-bold transition-all cursor-pointer"
          >
            <Icons.Plus className="h-4 w-4 text-jade rotate-45" />
            <span>تصدير فواتير المبيعات</span>
          </button>

          <button
            onClick={() => onExportCSV('products')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-2 hover:bg-border border border-line text-text rounded-control text-xs font-bold transition-all cursor-pointer"
          >
            <Icons.Plus className="h-4 w-4 text-copper rotate-45" />
            <span>تصدير قائمة المنتجات والمخزون</span>
          </button>

          <button
            onClick={() => onExportCSV('shifts')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-2 hover:bg-border border border-line text-text rounded-control text-xs font-bold transition-all cursor-pointer"
          >
            <Icons.Plus className="h-4 w-4 text-purple-600" />
            <span>تصدير سجل التوكات اليومية</span>
          </button>
        </div>
      </div>

      {/* Grid 1: Sales log and Financial stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Invoice Log */}
        <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4">سجل الفواتير الأخيرة</h2>

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

        {/* Profitability Summary */}
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col gap-6">
          <h2 className="text-lg font-bold">أداء النشاط المالي اليومي</h2>

          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-control bg-surface-2 border border-border">
              <span className="text-xs text-muted block">صافي مبيعات كاش</span>
              <span className="mono text-xl font-bold text-jade">
                {formatLYD(
                  salesList
                    .filter((s) => s.status === 'completed' && s.paymentMethod === 'cash')
                    .reduce((sum, s) => sum + s.total, 0)
                )}{' '}
                د.ل
              </span>
            </div>

            <div className="p-4 rounded-control bg-surface-2 border border-border">
              <span className="text-xs text-muted block">صافي مبيعات بطاقة مصرفية</span>
              <span className="mono text-xl font-bold text-purple-600">
                {formatLYD(
                  salesList
                    .filter((s) => s.status === 'completed' && s.paymentMethod === 'card')
                    .reduce((sum, s) => sum + s.total, 0)
                )}{' '}
                د.ل
              </span>
            </div>

            <div className="p-4 rounded-control bg-surface-2 border border-border">
              <span className="text-xs text-muted block">صافي مبيعات حوالة مصرفية</span>
              <span className="mono text-xl font-bold text-blue-600">
                {formatLYD(
                  salesList
                    .filter((s) => s.status === 'completed' && s.paymentMethod === 'transfer')
                    .reduce((sum, s) => sum + s.total, 0)
                )}{' '}
                د.ل
              </span>
            </div>

            <div className="p-4 rounded-control bg-surface-2 border border-border">
              <span className="text-xs text-muted block">
                الربح التقريبي اليوم (تقديري من تكلفة الشراء)
              </span>
              <span className="mono text-xl font-bold text-copper">
                {formatLYD(
                  salesList
                    .filter((s) => s.status === 'completed')
                    .reduce((sum, s) => sum + s.total, 0) -
                    productsList.reduce(
                      (sum, p) => sum + p.costPrice * (p.quantity || 0),
                      0
                    ) *
                      0.05
                )}{' '}
                د.ل
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SVG Line Chart (Sales Last 7 Days) */}
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold mb-1">منحنى المبيعات اليومية</h2>
          <p className="text-xs text-muted mb-4 font-semibold">
            حركة المبيعات خلال الأيام الـ 7 الأخيرة بالدينار
          </p>

          <div className="w-full bg-surface-2 border border-line rounded-[12px] p-4 flex justify-center items-center">
            <svg viewBox="0 0 500 200" className="w-full max-h-[220px]">
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4af37" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#d4af37" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="45" y1="40" x2="480" y2="40" stroke="var(--color-line)" strokeDasharray="3,3" />
              <line x1="45" y1="100" x2="480" y2="100" stroke="var(--color-line)" strokeDasharray="3,3" />
              <line x1="45" y1="160" x2="480" y2="160" stroke="var(--color-line)" />

              {/* Area under curve */}
              {areaPath && <path d={areaPath} fill="url(#salesGrad)" />}

              {/* Main line curve */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Day Markers and labels */}
              {points.map((p, i) => (
                <g key={i}>
                  <line
                    x1={p.x}
                    y1="40"
                    x2={p.x}
                    y2="160"
                    stroke="var(--color-line)"
                    strokeDasharray="2,2"
                    opacity="0.6"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5.5"
                    fill="var(--color-paper)"
                    stroke="#d4af37"
                    strokeWidth="2.5"
                  />
                  <text
                    x={p.x}
                    y={p.y - 12}
                    textAnchor="middle"
                    className="mono font-bold text-[10px]"
                    fill="var(--color-text)"
                  >
                    {Math.round(p.total)}
                  </text>
                  <text
                    x={p.x}
                    y="180"
                    textAnchor="middle"
                    className="font-semibold text-[10px]"
                    fill="var(--color-muted)"
                  >
                    {p.dayName}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Horizontal Progress Bars Breakdown Chart (Payment Methods) */}
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold mb-1">نسب توزيع طرق الدفع</h2>
            <p className="text-xs text-muted mb-6 font-semibold">
              مقارنة نسب السداد النقدي، المصرفي، والتحويلات
            </p>

            <div className="flex flex-col gap-5">
              {/* Cash Progress */}
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-jade">
                    <span className="h-2.5 w-2.5 rounded-full bg-jade" />
                    <span>نقدًا (كاش)</span>
                  </span>
                  <span className="mono">
                    {cash.toFixed(3)} د.ل ({cashPct}%)
                  </span>
                </div>
                <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                  <div
                    className="h-full bg-jade transition-all duration-500 rounded-full"
                    style={{ width: `${cashPct}%` }}
                  />
                </div>
              </div>

              {/* Card Progress */}
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-purple-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                    <span>بطاقة مصرفية</span>
                  </span>
                  <span className="mono">
                    {card.toFixed(3)} د.ل ({cardPct}%)
                  </span>
                </div>
                <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                  <div
                    className="h-full bg-purple-600 transition-all duration-500 rounded-full"
                    style={{ width: `${cardPct}%` }}
                  />
                </div>
              </div>

              {/* Transfer Progress */}
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-blue-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    <span>حوالة مصرفية</span>
                  </span>
                  <span className="mono">
                    {transfer.toFixed(3)} د.ل ({transferPct}%)
                  </span>
                </div>
                <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                    style={{ width: `${transferPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-border pt-4 mt-6 flex justify-between items-center text-xs">
            <span className="font-semibold text-muted">إجمالي المبيعات المدفوعة:</span>
            <span className="mono font-extrabold text-base text-jade">
              {(cash + card + transfer).toFixed(3)} د.ل
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
