import React from 'react';
import type { Customer } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatLYD } from '../lib/money';
import { Icons } from '../components/Icons';

interface CustomersProps {
  onOpenCustomerModal: (customer?: Customer) => void;
  onOpenPaymentModal: (customer: Customer) => void;
  onOpenStatementModal: (customer: Customer) => void;
  onOpenSpecialPricesModal: (customer: Customer) => void;
}

export const CustomersScreen: React.FC<CustomersProps> = ({
  onOpenCustomerModal,
  onOpenPaymentModal,
  onOpenStatementModal,
  onOpenSpecialPricesModal,
}) => {
  const { currentUser } = useAuth();
  const { customersList } = useData();

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-xs tracking-widest text-copper">إدارة الذمم</span>
          <h1 className="text-3xl font-extrabold">العملاء والذمم</h1>
        </div>
        <button
          onClick={() => onOpenCustomerModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
        >
          <Icons.Plus className="h-4 w-4" /> عميل جديد
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-card border border-line bg-surface p-5">
          <div className="text-xs text-muted mb-1">إجمالي العملاء</div>
          <div className="font-bold text-2xl">{customersList.length}</div>
        </div>
        <div className="rounded-card border border-line bg-surface p-5">
          <div className="text-xs text-muted mb-1">عملاء لديهم دين</div>
          <div className="font-bold text-2xl text-alert">
            {customersList.filter((c) => c.creditBalance > 0).length}
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface p-5">
          <div className="text-xs text-muted mb-1">إجمالي الذمم</div>
          <div className="font-bold text-2xl mono text-alert">
            {formatLYD(customersList.reduce((s, c) => s + c.creditBalance, 0))} د.ل
          </div>
        </div>
      </div>

      {/* Customers table */}
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-surface-2 text-text font-bold border-b border-line">
              <tr>
                <th className="p-3">الاسم</th>
                <th className="p-3">الهاتف</th>
                <th className="p-3">الفئة</th>
                <th className="p-3">سقف الدين</th>
                <th className="p-3">الدين الحالي</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customersList.map((c) => (
                <tr key={c.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="p-3 font-semibold">
                    <div>{c.name}</div>
                    {c.notes && <div className="text-xs text-muted font-normal">{c.notes}</div>}
                  </td>
                  <td className="p-3 mono">{c.phone || '—'}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        c.tier === 'wholesale'
                          ? 'bg-copper/10 text-copper border border-copper/30'
                          : 'bg-surface-2 text-muted border border-border'
                      }`}
                    >
                      {c.tier === 'wholesale' ? 'جملة' : 'تجزئة'}
                    </span>
                  </td>
                  <td className="p-3 mono">
                    {c.creditLimit > 0 ? `${formatLYD(c.creditLimit)} د.ل` : 'غير محدد'}
                  </td>
                  <td className="p-3 mono font-bold">
                    <span className={c.creditBalance > 0 ? 'text-alert' : 'text-jade'}>
                      {formatLYD(c.creditBalance)} د.ل
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onOpenPaymentModal(c)}
                        className="px-2.5 py-2 text-xs bg-jade text-white rounded font-bold hover:bg-jade-2 transition-colors cursor-pointer"
                      >
                        سداد دين
                      </button>
                      <button
                        onClick={() => onOpenStatementModal(c)}
                        className="px-2.5 py-2 text-xs border border-border rounded font-bold hover:bg-surface-2 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Icons.Receipt className="h-3.5 w-3.5" />
                        <span>كشف حساب</span>
                      </button>
                      {currentUser?.role === 'manager' && (
                        <button
                          onClick={() => onOpenSpecialPricesModal(c)}
                          className="px-2.5 py-2 text-xs border border-copper/40 bg-copper/5 text-copper rounded font-bold hover:bg-copper/10 transition-colors cursor-pointer"
                        >
                          أسعار خاصة
                        </button>
                      )}
                      <button
                        onClick={() => onOpenCustomerModal(c)}
                        className="px-2.5 py-2 text-xs border border-border rounded text-muted hover:text-text cursor-pointer"
                      >
                        تعديل
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
