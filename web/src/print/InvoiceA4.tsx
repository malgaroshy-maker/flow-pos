import React from 'react';
import type { Sale, Settings } from '../types';
import { formatLYD } from '../lib/money';
import { formatDateTime } from '../lib/datetime';
import { tafqeetLYD } from '../lib/tafqeet';

interface InvoiceA4Props {
  sale: Sale;
  settings: Settings | null;
  overrideCustomerName?: string;
  overrideWarrantyNotes?: string;
  overrideStampTitle?: string;
  qrDataUrl: string | null;
}

export const InvoiceA4: React.FC<InvoiceA4Props> = ({
  sale,
  settings,
  overrideCustomerName,
  overrideWarrantyNotes,
  overrideStampTitle,
  qrDataUrl,
}) => {
  const customerName = overrideCustomerName || sale.customerName || '';
  const warrantyText = overrideWarrantyNotes || settings?.warrantyTerms || '';
  const hasEquipment = sale.items?.some((i) => i.productType === 'equipment') ?? false;
  const stampTitle = overrideStampTitle || settings?.stampTitle || settings?.businessName || '';

  const paymentMethodLabel = (m: Sale['paymentMethod']) =>
    m === 'cash' ? 'كاش' : m === 'card' ? 'بطاقة مصرفية' : 'حوالة مصرفية';

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
          <span className="mono text-xs font-bold ltr">{sale.invoiceNumber}</span>
        </div>
      </div>

      {/* Invoice meta */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mb-3">
        <div>
          <span className="font-bold">التاريخ: </span>
          <span className="mono">{formatDateTime(sale.createdAt)}</span>
        </div>
        <div>
          <span className="font-bold">نوع الفاتورة: </span>
          {sale.paymentType === 'credit' ? 'بيع آجل (دين)' : 'بيع نقدي'} —{' '}
          {paymentMethodLabel(sale.paymentMethod)}
        </div>
        <div>
          <span className="font-bold">العميل: </span>
          {customerName || 'زبون نقدي'}
        </div>
        <div>
          <span className="font-bold">البائع: </span>
          {sale.username || '—'}
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
          {sale.items?.map((item, idx) => (
            <tr key={item.id} className="border-b border-black/20 align-top">
              <td className="p-1.5 mono">{idx + 1}</td>
              <td className="p-1.5 font-semibold">
                {item.productName}
                {item.serialNumber && (
                  <div className="text-[10px] font-normal mono">S/N: {item.serialNumber}</div>
                )}
              </td>
              <td className="p-1.5 text-center">{item.unitName || item.baseUnit || '—'}</td>
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
          <span className="font-bold">المبلغ كتابةً: </span>
          {tafqeetLYD(sale.total)}
        </div>
        <div className="text-[11px] flex flex-col gap-1 items-end min-w-[190px]">
          <div className="flex justify-between w-full gap-6">
            <span>الإجمالي الفرعي:</span>
            <span className="mono">
              {formatLYD(sale.total - sale.taxAmount + sale.discount)}
            </span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between w-full gap-6">
              <span>الخصم:</span>
              <span className="mono">-{formatLYD(sale.discount)}</span>
            </div>
          )}
          {sale.taxAmount > 0 && (
            <div className="flex justify-between w-full gap-6">
              <span>الضريبة:</span>
              <span className="mono">{formatLYD(sale.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between w-full gap-6 font-extrabold text-[13px] border-t border-black pt-1">
            <span>الإجمالي النهائي:</span>
            <span className="mono">{formatLYD(sale.total)} د.ل</span>
          </div>
        </div>
      </div>

      {/* Warranty terms */}
      {warrantyText && (hasEquipment || overrideWarrantyNotes) && (
        <div className="text-[10px] border border-black/40 rounded p-2 mb-3 whitespace-pre-line">
          <span className="font-bold block mb-0.5">شروط الضمان:</span>
          {warrantyText}
        </div>
      )}

      {/* Stamp + signatures */}
      <div className="flex justify-between items-end mt-6 text-[11px]">
        <div className="text-center">
          <div className="border-t border-black/60 pt-1 px-8">توقيع المستلم</div>
        </div>
        <div className="w-28 h-28 rounded-full border-[2.5px] border-black/50 flex items-center justify-center text-center text-[10px] font-bold rotate-[-6deg] opacity-70 p-3">
          {stampTitle}
        </div>
        <div className="text-center">
          <div className="border-t border-black/60 pt-1 px-8">توقيع البائع</div>
        </div>
      </div>
    </div>
  );
};
