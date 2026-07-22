import React from 'react';
import { useData } from '../context/DataContext';
import { formatLYD } from '../lib/money';
import { Icons } from '../components/Icons';

interface DashboardProps {
  onSelectTab: (tabId: string) => void;
  onOpenShiftModal: () => void;
  onCloseShiftModal: () => void;
  onOpenNewProductModal: () => void;
  onOpenExpenseModal: () => void;
  onTriggerBackup: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectTab,
  onOpenShiftModal,
  onCloseShiftModal,
  onOpenNewProductModal,
  onOpenExpenseModal,
  onTriggerBackup,
}) => {
  const { salesList, productsList, expensesList, activeShift } = useData();
  const today = new Date().toISOString().split('T')[0] || '';

  const todaySalesTotal = salesList
    .filter((s) => s.status === 'completed' && s.createdAt.startsWith(today))
    .reduce((sum, s) => sum + s.total, 0);

  const todaySalesCount = salesList.filter(
    (s) => s.status === 'completed' && s.createdAt.startsWith(today)
  ).length;

  const lowStockProducts = productsList.filter((p) => p.quantity <= p.reorderPoint);

  const todayExpensesTotal = expensesList
    .filter((e) => e.createdAt.startsWith(today))
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-xs tracking-widest text-copper">نظرة عامة</span>
          <h1 className="text-3xl font-extrabold">لوحة التحكم</h1>
        </div>

        {/* Active Shift status pill */}
        <div>
          {activeShift ? (
            <div className="flex items-center gap-3 bg-jade/10 border border-jade/30 rounded-full px-4 py-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-jade animate-pulse" />
              <span className="text-sm font-semibold text-jade">
                التوكة مفتوحة حالياً (رقم: {activeShift.id})
              </span>
              <button
                onClick={onCloseShiftModal}
                className="text-xs bg-jade text-white px-3.5 py-2 rounded-full font-bold hover:bg-jade-2 transition-colors cursor-pointer"
              >
                إغلاق التوكة
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-alert/10 border border-alert/30 rounded-full px-4 py-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-alert" />
              <span className="text-sm font-semibold text-alert">
                الخزينة مقفلة (لا توجد توكة)
              </span>
              <button
                onClick={onOpenShiftModal}
                className="text-xs bg-alert text-white px-3.5 py-2 rounded-full font-bold hover:bg-alert-2 transition-colors cursor-pointer"
              >
                فتح التوكة
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
          <span className="text-xs text-muted block mb-1">إجمالي المبيعات اليوم</span>
          <div className="mono text-2xl font-extrabold text-jade">
            {formatLYD(todaySalesTotal)} د.ل
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
          <span className="text-xs text-muted block mb-1">فواتير اليوم المكتملة</span>
          <div className="mono text-2xl font-extrabold text-text">
            {todaySalesCount} فاتورة
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
          <span className="text-xs text-muted block mb-1">المنتجات منخفضة المخزون</span>
          <div className="mono text-2xl font-extrabold text-copper">
            {lowStockProducts.length} منتج
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
          <span className="text-xs text-muted block mb-1">إجمالي المصروفات اليوم</span>
          <div className="mono text-2xl font-extrabold text-alert">
            {formatLYD(todayExpensesTotal)} د.ل
          </div>
        </div>
      </div>

      {/* Sub-panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Alerts */}
        <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Icons.AlertTriangle />
            <span>تنبيهات انخفاض مخزون المواد والمعدات</span>
          </h2>

          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted">جميع المنتجات والمعدات متوفرة برصيد آمن.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-surface-2 text-text font-bold">
                  <tr>
                    <th className="p-3">المنتج</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">المخزون الحالي</th>
                    <th className="p-3">حد إعادة الطلب</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.slice(0, 5).map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-line hover:bg-surface-2 transition-colors"
                    >
                      <td className="p-3 font-semibold">{p.name}</td>
                      <td className="p-3 text-xs text-muted">
                        {p.type === 'equipment' ? 'معدة/جهاز' : 'مادة استهلاكية'}
                      </td>
                      <td className="p-3 mono font-bold text-alert">
                        {p.quantity} {p.baseUnit}
                      </td>
                      <td className="p-3 mono text-muted">{p.reorderPoint}</td>
                      <td className="p-3">
                        <span className="bg-red-500/10 text-alert border border-red-500/20 px-2 py-0.5 rounded-full text-xs font-bold">
                          {p.quantity === 0 ? 'نافذ' : 'منخفض'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold mb-2">إجراءات سريعة</h2>

          <button
            onClick={() => onSelectTab('POS')}
            className="w-full py-3 px-4 bg-jade text-white rounded-control font-bold shadow-md hover:bg-jade-2 transition-colors cursor-pointer text-center"
          >
            فتح شاشة نقطة البيع (POS)
          </button>

          <button
            onClick={onOpenNewProductModal}
            className="w-full py-3 px-4 bg-surface border border-border text-text rounded-control font-bold hover:bg-surface-2 transition-colors cursor-pointer text-center"
          >
            إضافة منتج أو جهاز جديد
          </button>

          <button
            onClick={onOpenExpenseModal}
            className="w-full py-3 px-4 bg-surface border border-border text-text rounded-control font-bold hover:bg-surface-2 transition-colors cursor-pointer text-center"
          >
            تسجيل مصروف نقدي يومي
          </button>

          <div className="mt-auto border-t border-line pt-4">
            <button
              onClick={onTriggerBackup}
              className="w-full py-2.5 px-4 bg-surface border border-border text-muted rounded-control text-xs font-bold hover:bg-surface-2 transition-colors cursor-pointer text-center"
            >
              إنشاء نسخة احتياطية محلية لقاعدة البيانات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
