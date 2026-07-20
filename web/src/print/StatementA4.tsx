import React from 'react';
import type { Customer, Settings } from '../types';
import { formatLYD } from '../lib/money';
import { formatDateTime } from '../lib/datetime';

interface StatementA4Props {
  customer: Customer;
  statementData: any;
  settings: Settings | null;
  filterStart?: string;
  filterEnd?: string;
}

export const StatementA4: React.FC<StatementA4Props> = ({
  customer,
  statementData,
  settings,
  filterStart,
  filterEnd,
}) => {
  const statementView = (() => {
    const rows: any[] = statementData?.statement ?? [];
    const start = filterStart;
    const end = filterEnd;
    if (!start && !end) return { rows, opening: 0, hasOpening: false };
    let opening = 0;
    const inRange: any[] = [];
    for (const r of rows) {
      const day = String(r.date).slice(0, 10);
      if (start && day < start) {
        opening = r.runningBalance;
        continue;
      }
      if (end && day > end) continue;
      inRange.push(r);
    }
    return { rows: inRange, opening, hasOpening: Boolean(start) };
  })();

  return (
    <div className="a4-page bg-white text-black p-6" dir="rtl">
      <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
        <div>
          <h1 className="text-xl font-extrabold font-display">
            {settings?.businessName ?? ''}
          </h1>
          {settings?.businessSubtitle && (
            <p className="text-[11px] font-semibold mt-0.5">{settings.businessSubtitle}</p>
          )}
          <p className="text-[11px] mt-1">
            هاتف: <span className="mono">{settings?.businessPhone || '—'}</span>
            {settings?.businessPhone2 ? (
              <>
                {' / '}
                <span className="mono">{settings.businessPhone2}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="text-left">
          <h2 className="font-extrabold text-base">كشف حساب عميل</h2>
          <p className="mono text-[10px]">{formatDateTime(new Date())}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mb-3">
        <div>
          <span className="font-bold">العميل: </span>
          {customer.name}
        </div>
        <div>
          <span className="font-bold">الهاتف: </span>
          {customer.phone || '—'}
        </div>
        {(filterStart || filterEnd) && (
          <div className="col-span-2">
            <span className="font-bold">الفترة: </span>
            {filterStart || 'البداية'} ← {filterEnd || 'اليوم'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-[11px] mb-3 text-center">
        <div className="border border-black/40 rounded p-2">
          <div className="font-bold">إجمالي المشتريات الآجلة</div>
          <div className="mono">{formatLYD(statementData.summary.totalPurchases)} د.ل</div>
        </div>
        <div className="border border-black/40 rounded p-2">
          <div className="font-bold">إجمالي المدفوع</div>
          <div className="mono">{formatLYD(statementData.summary.totalPaid)} د.ل</div>
        </div>
        <div className="border-2 border-black rounded p-2 font-extrabold">
          <div>الرصيد المستحق حالياً</div>
          <div className="mono">{formatLYD(statementData.summary.currentBalance)} د.ل</div>
        </div>
      </div>

      <table className="w-full text-right text-[10.5px] border border-black/60">
        <thead>
          <tr className="border-b border-black/60 bg-black/5 font-bold">
            <th className="p-1.5">التاريخ</th>
            <th className="p-1.5">البيان</th>
            <th className="p-1.5">المرجع</th>
            <th className="p-1.5 text-left">مدين (عليه)</th>
            <th className="p-1.5 text-left">دائن (له)</th>
            <th className="p-1.5 text-left">الرصيد</th>
          </tr>
        </thead>
        <tbody>
          {statementView.hasOpening && (
            <tr className="border-b border-black/20 bg-black/5 font-semibold">
              <td className="p-1.5" colSpan={5}>
                رصيد سابق مُرحّل
              </td>
              <td className="p-1.5 text-left mono">{formatLYD(statementView.opening)}</td>
            </tr>
          )}
          {statementView.rows.map((row: any) => (
            <tr key={row.id} className="border-b border-black/20">
              <td className="p-1.5 mono">{String(row.date).slice(0, 10)}</td>
              <td className="p-1.5">{row.typeLabel}</td>
              <td className="p-1.5 mono">{row.reference}</td>
              <td className="p-1.5 text-left mono">{row.debit ? formatLYD(row.debit) : '—'}</td>
              <td className="p-1.5 text-left mono">{row.credit ? formatLYD(row.credit) : '—'}</td>
              <td className="p-1.5 text-left mono font-bold">{formatLYD(row.runningBalance)}</td>
            </tr>
          ))}
          {statementView.rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-4 text-center">
                لا توجد حركات في هذه الفترة.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex justify-between items-end mt-8 text-[11px]">
        <div className="text-center">
          <div className="border-t border-black/60 pt-1 px-8">توقيع العميل</div>
        </div>
        <div className="text-center">
          <div className="border-t border-black/60 pt-1 px-8">
            {settings?.stampTitle || settings?.businessName || ''}
          </div>
        </div>
      </div>
    </div>
  );
};
