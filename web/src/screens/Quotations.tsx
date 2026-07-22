import React from 'react';
import type { Quotation } from '../types';
import { useData } from '../context/DataContext';
import { formatLYD } from '../lib/money';
import { Icons } from '../components/Icons';

interface QuotationsProps {
  onSelectTab: (tabId: string) => void;
  onOpenQuotationPrint: (q: Quotation) => void;
  onLoadQuotationIntoPos: (q: Quotation) => void;
  onCancelQuotation: (q: Quotation) => void;
}

export const QuotationsScreen: React.FC<QuotationsProps> = ({
  onSelectTab,
  onOpenQuotationPrint,
  onLoadQuotationIntoPos,
  onCancelQuotation,
}) => {
  const { quotationsList } = useData();

  const quotationStatusLabel = (s: Quotation['status']) =>
    s === 'active'
      ? 'نشط'
      : s === 'converted'
        ? 'تم تحويله لفاتورة'
        : s === 'expired'
          ? 'منتهي الصلاحية'
          : 'ملغى';

  const quotationStatusBadgeClass = (s: Quotation['status']) =>
    s === 'active'
      ? 'bg-copper/10 text-copper border-copper/30'
      : s === 'converted'
        ? 'bg-jade/10 text-jade border-jade/30'
        : 'bg-alert/10 text-alert border-alert/30';

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-xs tracking-widest text-copper">عروض الأسعار</span>
          <h1 className="text-3xl font-extrabold">عروض الأسعار غير الملزمة</h1>
        </div>
        <button
          onClick={() => onSelectTab('POS')}
          className="flex items-center gap-2 px-4 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
        >
          <Icons.Plus className="h-4 w-4" /> عرض جديد من نقطة البيع
        </button>
      </div>

      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-2 text-text font-bold border-b border-line">
              <tr>
                <th className="p-3">رقم العرض</th>
                <th className="p-3">العميل</th>
                <th className="p-3">صالح حتى</th>
                <th className="p-3">الإجمالي</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">المعد</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotationsList.map((q) => (
                <tr key={q.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="p-3 mono font-bold text-copper">{q.quoteNumber}</td>
                  <td className="p-3 font-semibold">{q.customerName || 'زبون نقدي'}</td>
                  <td className="p-3 mono">{q.validUntil}</td>
                  <td className="p-3 mono font-bold">{formatLYD(q.total)} د.ل</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${quotationStatusBadgeClass(q.status)}`}>
                      {quotationStatusLabel(q.status)}
                    </span>
                  </td>
                  <td className="p-3">{q.username || '—'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenQuotationPrint(q)}
                        className="px-2.5 py-2 text-xs border border-border bg-surface hover:bg-surface-2 rounded font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Icons.Printer className="h-3.5 w-3.5" />
                        <span>طباعة A4</span>
                      </button>
                      {q.status === 'active' && (
                        <>
                          <button
                            onClick={() => onLoadQuotationIntoPos(q)}
                            className="px-2.5 py-2 text-xs bg-jade text-white rounded font-bold hover:bg-jade-2 cursor-pointer"
                          >
                            تحويل لفاتورة
                          </button>
                          <button
                            onClick={() => onCancelQuotation(q)}
                            className="px-2.5 py-2 text-xs border border-alert/30 bg-alert/5 text-alert rounded font-bold hover:bg-alert/10 cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </>
                      )}
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
