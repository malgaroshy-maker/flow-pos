import React from 'react';
import type { Quotation, Settings } from '../types';
import { formatLYD } from '../lib/money';
import { tafqeetLYD } from '../lib/tafqeet';

interface QuotationA4Props {
  quotation: Quotation;
  settings: Settings | null;
  qrDataUrl: string | null;
}

export const QuotationA4: React.FC<QuotationA4Props> = ({ quotation, settings, qrDataUrl }) => {
  const quotationSubtotal = quotation.total - quotation.taxAmount + quotation.discount;

  const quotationStatusLabel = (s: Quotation['status']) =>
    s === 'active'
      ? 'نشط'
      : s === 'converted'
        ? 'تم تحويله لفاتورة'
        : s === 'expired'
          ? 'منتهي الصلاحية'
          : 'ملغى';

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
        <div className="flex flex-col items-end gap-1">
          {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-20 h-20" />}
          <span className="mono text-xs font-bold">{quotation.quoteNumber}</span>
        </div>
      </div>

      {/* Document title */}
      <div className="text-center mb-3">
        <span className="inline-block border-2 border-black rounded px-6 py-1 text-base font-extrabold font-display">
          عرض سعر
        </span>
        <p className="text-[10px] mt-1">
          عرض غير ملزم — الأسعار سارية حتى{' '}
          <span className="mono font-bold">{quotation.validUntil}</span>
        </p>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mb-3">
        <div>
          <span className="font-bold">التاريخ: </span>
          <span className="mono">
            {new Date(quotation.createdAt).toLocaleString('ar-LY')}
          </span>
        </div>
        <div>
          <span className="font-bold">الحالة: </span>
          {quotationStatusLabel(quotation.status)}
        </div>
        <div>
          <span className="font-bold">العميل: </span>
          {quotation.customerName || 'زبون نقدي'}
        </div>
        <div>
          <span className="font-bold">أعده: </span>
          {quotation.username || '—'}
        </div>
      </div>

      {/* Items */}
      <table className="w-full text-right text-[11px] mb-3 border border-black/60">
        <thead>
          <tr className="border-b border-black/60 bg-black/5 font-bold">
            <th className="p-1.5 w-6">#</th>
            <th className="p-1.5">البيان</th>
            <th className="p-1.5 text-center">الوحدة</th>
            <th className="p-1.5 text-center">الكمية</th>
            <th className="p-1.5 text-left">سعر الوحدة</th>
            <th className="p-1.5 text-left">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {quotation.items?.map((item, idx) => (
            <tr key={item.id} className="border-b border-black/20 align-top">
              <td className="p-1.5 mono">{idx + 1}</td>
              <td className="p-1.5 font-semibold">{item.productName}</td>
              <td className="p-1.5 text-center">{item.unitName || '—'}</td>
              <td className="p-1.5 text-center mono">{item.quantity}</td>
              <td className="p-1.5 text-left mono">{formatLYD(item.unitPrice)}</td>
              <td className="p-1.5 text-left mono font-bold">{formatLYD(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals + Tafqeet */}
      <div className="flex justify-between items-start gap-6 mb-3">
        <div className="flex-1 text-[11px] border border-black/40 rounded p-2">
          <span className="font-bold">الإجمالي كتابةً: </span>
          {tafqeetLYD(quotation.total)}
        </div>
        <div className="text-[11px] flex flex-col gap-1 items-end min-w-[190px]">
          <div className="flex justify-between w-full gap-6">
            <span>الإجمالي الفرعي:</span>
            <span className="mono">{formatLYD(quotationSubtotal)}</span>
          </div>
          {quotation.discount > 0 && (
            <div className="flex justify-between w-full gap-6">
              <span>الخصم:</span>
              <span className="mono">-{formatLYD(quotation.discount)}</span>
            </div>
          )}
          {quotation.taxAmount > 0 && (
            <div className="flex justify-between w-full gap-6">
              <span>الضريبة:</span>
              <span className="mono">{formatLYD(quotation.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between w-full gap-6 font-extrabold text-[13px] border-t border-black pt-1">
            <span>الإجمالي النهائي:</span>
            <span className="mono">{formatLYD(quotation.total)} د.ل</span>
          </div>
        </div>
      </div>

      {quotation.notes && (
        <div className="text-[10px] border border-black/40 rounded p-2 mb-3 whitespace-pre-line">
          <span className="font-bold block mb-0.5">ملاحظات:</span>
          {quotation.notes}
        </div>
      )}

      <p className="text-[10px] text-black/70 mb-4">
        هذا العرض لا يخصم أي مخزون ولا يشكل التزاماً بالبيع؛ يصبح فاتورة نهائية عند تأكيده داخل
        نقطة البيع قبل انتهاء صلاحيته.
      </p>

      {/* Signatures */}
      <div className="flex justify-between items-end mt-6 text-[11px]">
        <div className="text-center">
          <div className="border-t border-black/60 pt-1 px-8">اعتماد العميل</div>
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
