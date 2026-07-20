import React from 'react';
import type { Purchase, Settings } from '../types';
import { formatLYD } from '../lib/money';
import { formatDateTime } from '../lib/datetime';

interface PurchaseA4Props {
  purchase: Purchase;
  settings: Settings | null;
}

export const PurchaseA4: React.FC<PurchaseA4Props> = ({ purchase, settings }) => {
  const supplierName = purchase.supplierName || 'مورد غير محدد';
  const remaining = purchase.total - purchase.paid;

  const statusLabel = (status: Purchase['status']) => {
    switch (status) {
      case 'paid':
        return 'مسددة بالكامل (نقدي)';
      case 'partial':
        return 'سداد جزئي';
      case 'pending':
        return 'آجل (دين كامل)';
      default:
        return status;
    }
  };

  return (
    <div className="a4-page bg-white text-black p-6" dir="rtl">
      {/* Branded header */}
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
          {settings?.businessAddress && (
            <p className="text-[11px]">{settings.businessAddress}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-left">
          <h2 className="font-extrabold text-base">فاتورة شراء بضاعة</h2>
          <span className="mono text-xs font-bold ltr">{purchase.invoiceNumber}</span>
        </div>
      </div>

      {/* Invoice metadata */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mb-3">
        <div>
          <span className="font-bold">التاريخ: </span>
          <span className="mono">{formatDateTime(purchase.createdAt)}</span>
        </div>
        <div>
          <span className="font-bold">حالة السداد: </span>
          {statusLabel(purchase.status)}
        </div>
        <div>
          <span className="font-bold">المورد: </span>
          {supplierName}
        </div>
        <div>
          <span className="font-bold">المسؤول: </span>
          {purchase.username || '—'}
        </div>
      </div>

      {/* Items table */}
      <table className="w-full text-right text-[11px] mb-3 border border-black/60">
        <thead>
          <tr className="border-b border-black/60 bg-black/5 font-bold">
            <th className="p-1.5 w-6">#</th>
            <th className="p-1.5">اسم الصنف</th>
            <th className="p-1.5 text-center">الكمية</th>
            <th className="p-1.5 text-left">تكلفة الوحدة</th>
            <th className="p-1.5 text-left">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {purchase.items?.map((item, idx) => (
            <tr key={item.productId || idx} className="border-b border-black/20 align-top">
              <td className="p-1.5 mono">{idx + 1}</td>
              <td className="p-1.5 font-semibold">{item.productName}</td>
              <td className="p-1.5 text-center mono">{item.quantity}</td>
              <td className="p-1.5 text-left mono">{formatLYD(item.unitCost)}</td>
              <td className="p-1.5 text-left mono font-semibold">{formatLYD(item.total)}</td>
            </tr>
          ))}
          {(!purchase.items || purchase.items.length === 0) && (
            <tr>
              <td colSpan={5} className="p-4 text-center">
                لا توجد عناصر بالفاتورة.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Summary calculations */}
      <div className="flex justify-between items-start gap-4 mb-4 text-[11px]">
        <div className="flex-1">
          {purchase.notes && (
            <div className="border border-black/30 p-2 rounded text-[10.5px]">
              <span className="font-bold block mb-0.5">ملاحظات:</span>
              <p className="whitespace-pre-wrap">{purchase.notes}</p>
            </div>
          )}
        </div>
        <div className="w-64 space-y-1 text-left text-[11px]">
          <div className="flex justify-between border-b border-black/30 pb-0.5">
            <span className="font-bold">إجمالي الفاتورة:</span>
            <span className="mono font-bold">{formatLYD(purchase.total)} د.ل</span>
          </div>
          <div className="flex justify-between border-b border-black/30 pb-0.5">
            <span className="font-bold">المدفوع نقداً:</span>
            <span className="mono">{formatLYD(purchase.paid)} د.ل</span>
          </div>
          <div className="flex justify-between font-extrabold text-[12px] pt-1">
            <span>المتبقي (دين للمورد):</span>
            <span className="mono">{formatLYD(remaining)} د.ل</span>
          </div>
        </div>
      </div>

      {/* Signatures & Stamp */}
      <div className="flex justify-between items-end mt-10 text-[11px]">
        <div className="text-center">
          <div className="border-t border-black/60 pt-1 px-8">توقيع المستلم (المخزن)</div>
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
