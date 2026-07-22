import React from 'react';
import type { Purchase, Supplier } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatLYD } from '../lib/money';
import { formatDate } from '../lib/datetime';
import { Icons } from '../components/Icons';

interface PurchasesProps {
  onOpenSupplierModal: (supplier?: Supplier) => void;
  onOpenSupplierStatementModal?: (supplier: Supplier) => void;
  onOpenPurchaseModal: () => void;
  onOpenReturnModal: (purchaseId: number) => void;
  onPrintPurchase?: (purchase: Purchase) => void;
}

export const PurchasesScreen: React.FC<PurchasesProps> = ({
  onOpenSupplierModal,
  onOpenSupplierStatementModal,
  onOpenPurchaseModal,
  onOpenReturnModal,
  onPrintPurchase,
}) => {
  const { currentUser } = useAuth();
  const { purchasesList, suppliersList } = useData();

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-xs tracking-widest text-copper">المشتريات والتوريد</span>
          <h1 className="text-3xl font-extrabold">المشتريات والموردين</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onOpenSupplierModal()}
            className="flex items-center gap-2 px-4 py-2.5 border border-border bg-surface text-text font-bold text-sm rounded-control hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <Icons.Truck className="h-4 w-4" /> مورد جديد
          </button>
          <button
            onClick={onOpenPurchaseModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
          >
            <Icons.Plus className="h-4 w-4" /> فاتورة شراء جديدة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suppliers List */}
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Icons.Truck className="h-4 w-4 text-copper" /> الموردون
          </h2>
          <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
            {suppliersList.map((s) => (
              <div
                key={s.id}
                className="p-3 border border-line rounded-control bg-surface-2 flex flex-col gap-1 text-xs"
              >
                <div className="flex justify-between items-center font-bold text-sm">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    {onOpenSupplierStatementModal && (
                      <button
                        onClick={() => onOpenSupplierStatementModal(s)}
                        className="text-jade hover:underline cursor-pointer font-bold"
                      >
                        كشف حساب
                      </button>
                    )}
                    <button
                      onClick={() => onOpenSupplierModal(s)}
                      className="text-muted hover:text-text cursor-pointer"
                    >
                      تعديل
                    </button>
                  </div>
                </div>
                {s.phone && <div className="mono text-muted">هاتف: {s.phone}</div>}
                <div className="flex justify-between items-center pt-1 border-t border-border/50">
                  <span className="text-muted">مستحقات له:</span>
                  <span className="mono font-bold text-copper">{formatLYD(s.debtBalance)} د.ل</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Purchases Invoices Table */}
        <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Icons.Receipt className="h-4 w-4 text-copper" /> سجل فواتير الشراء
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-surface-2 text-text font-bold border-b border-line">
                <tr>
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">المورد</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">المدفوع</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {purchasesList.map((p) => {
                  const remaining = p.total - p.paid;
                  return (
                    <tr key={p.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="p-3 mono font-bold text-jade">{p.invoiceNumber}</td>
                      <td className="p-3 font-semibold">{p.supplierName || '—'}</td>
                      <td className="p-3 mono text-muted">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="p-3 mono font-bold">{formatLYD(p.total)} د.ل</td>
                      <td className="p-3 mono text-jade">{formatLYD(p.paid)} د.ل</td>
                      <td className="p-3 mono text-alert">{formatLYD(remaining)} د.ل</td>
                      <td className="p-3 flex items-center gap-2">
                        {onPrintPurchase && (
                          <button
                            onClick={() => onPrintPurchase(p)}
                            title="طباعة فاتورة الشراء (A4)"
                            className="p-2.5 -m-1 text-muted hover:text-jade transition-colors cursor-pointer touch-manipulation"
                          >
                            <Icons.Printer className="h-4 w-4" />
                          </button>
                        )}
                        {currentUser?.role === 'manager' && (
                          <button
                            onClick={() => onOpenReturnModal(p.id)}
                            className="px-2.5 py-2 text-[11px] border border-alert/30 bg-alert/5 text-alert rounded font-bold hover:bg-alert/10 transition-colors cursor-pointer"
                          >
                            إرجاع للمورد
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
