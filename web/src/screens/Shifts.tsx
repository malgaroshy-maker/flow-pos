import React from 'react';
import { useData } from '../context/DataContext';
import { formatLYD } from '../lib/money';
import { Icons } from '../components/Icons';

interface ShiftsProps {
  onOpenShiftModal: () => void;
  onCloseShiftModal: () => void;
  onOpenExpenseModal: () => void;
}

export const ShiftsScreen: React.FC<ShiftsProps> = ({
  onOpenShiftModal,
  onCloseShiftModal,
  onOpenExpenseModal,
}) => {
  const { activeShift, shiftsList, expensesList } = useData();

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <span className="mono text-xs tracking-widest text-copper">إدارة الخزينة</span>
          <h1 className="text-3xl font-extrabold">التوكة والخزينة اليومية</h1>
        </div>
        <div className="flex gap-2">
          {activeShift ? (
            <>
              <button
                onClick={onOpenExpenseModal}
                className="flex items-center gap-2 px-4 py-2.5 border border-border bg-surface text-text font-bold text-sm rounded-control hover:bg-surface-2 transition-colors cursor-pointer"
              >
                + تسجيل مصروف نقدي
              </button>
              <button
                onClick={onCloseShiftModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                إغلاق وجرد التوكة 🔒
              </button>
            </>
          ) : (
            <button
              onClick={onOpenShiftModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-alert text-white font-bold text-sm rounded-control hover:bg-red-600 transition-colors cursor-pointer"
            >
              ⚡ فتح توكة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Info */}
      <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-bold mb-4">حالة الخزينة والتوكة الحالية</h2>
        {activeShift ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-control bg-jade/10 border border-jade/30">
              <span className="text-xs text-muted block mb-1">رقم التوكة النشطة</span>
              <span className="mono text-2xl font-extrabold text-jade">#{activeShift.id}</span>
            </div>
            <div className="p-4 rounded-control bg-surface-2 border border-border">
              <span className="text-xs text-muted block mb-1">المبلغ عند الافتتاح</span>
              <span className="mono text-2xl font-extrabold">{formatLYD(activeShift.openingCash)} د.ل</span>
            </div>
            <div className="p-4 rounded-control bg-surface-2 border border-border">
              <span className="text-xs text-muted block mb-1">تاريخ ووقت الفتح</span>
              <span className="mono text-sm font-bold block mt-2">
                {new Date(activeShift.openedAt).toLocaleString('ar-LY')}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">لا توجد توكة مفتوحة حالياً — يلزم فتح توكة لتمكين عمليات الكاش والمصروفات.</p>
        )}
      </div>

      {/* Expenses and Shifts Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses List */}
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold">المصروفات النقدية المسجلة</h2>
          <div className="overflow-y-auto max-h-[400px] flex flex-col gap-2">
            {expensesList.map((exp) => (
              <div
                key={exp.id}
                className="p-3 border border-line rounded-control bg-surface-2 flex justify-between items-center text-xs"
              >
                <div>
                  <div className="font-bold text-sm">{exp.reason}</div>
                  <div className="text-muted text-[10px]">
                    التصنيف: {exp.category} — {new Date(exp.createdAt).toLocaleString('ar-LY')}
                  </div>
                </div>
                <div className="mono font-extrabold text-alert text-sm">
                  -{formatLYD(exp.amount)} د.ل
                </div>
              </div>
            ))}
            {expensesList.length === 0 && (
              <p className="text-xs text-muted p-4 text-center">لا توجد مصروفات مسجلة.</p>
            )}
          </div>
        </div>

        {/* Historical Shifts */}
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold">سجل التوكات السابقة</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-surface-2 text-text font-bold border-b border-line">
                <tr>
                  <th className="p-2.5">رقم</th>
                  <th className="p-2.5">الافتتاح</th>
                  <th className="p-2.5">المتوقع</th>
                  <th className="p-2.5">الفعلي</th>
                  <th className="p-2.5">الفارق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shiftsList.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="p-2.5 mono font-bold">#{s.id}</td>
                    <td className="p-2.5 mono">{formatLYD(s.openingCash)}</td>
                    <td className="p-2.5 mono">{formatLYD(s.expectedCash)}</td>
                    <td className="p-2.5 mono">{s.actualCash ? formatLYD(s.actualCash) : '—'}</td>
                    <td className="p-2.5 mono font-bold">
                      {s.variance !== undefined ? (
                        <span className={s.variance < 0 ? 'text-alert' : s.variance > 0 ? 'text-copper' : 'text-jade'}>
                          {formatLYD(s.variance)} د.ل
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
