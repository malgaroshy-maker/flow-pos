import React from 'react';
import type { Sale, Settings } from '../types';
import { formatLYD } from '../lib/money';
import { formatDateTime } from '../lib/datetime';

interface ThermalReceiptProps {
  sale: Sale;
  settings: Settings | null;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ sale, settings }) => {
  const paymentMethodLabel = (m: Sale['paymentMethod']) =>
    m === 'cash' ? 'كاش' : m === 'card' ? 'بطاقة مصرفية' : 'حوالة مصرفية';

  const subtotal = (sale.items ?? []).reduce((sum, item) => sum + item.total, 0);

  return (
    <div
      className="bg-white text-black mx-auto px-1"
      dir="rtl"
      style={{ width: '72mm', fontSize: '11px', lineHeight: 1.45 }}
    >
      <div className="text-center border-b border-dashed border-black/60 pb-2 mb-2">
        <div className="font-extrabold text-[14px]">{settings?.businessName ?? ''}</div>
        {settings?.businessAddress && (
          <div className="text-[10px] mt-0.5">{settings.businessAddress}</div>
        )}
        {settings?.businessPhone && (
          <div className="text-[10px]">
            هاتف: <span className="mono">{settings.businessPhone}</span>
          </div>
        )}
      </div>

      <div className="text-[10px] mb-1">
        <div className="flex justify-between">
          <span>رقم الفاتورة</span>
          <span className="mono font-bold">{sale.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>التاريخ</span>
          <span className="mono">{formatDateTime(sale.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>الكاشير</span>
          <span>{sale.username}</span>
        </div>
      </div>
      <div className="border-b border-dashed border-black/60 mb-1.5" />

      <div className="flex justify-between text-[10px] font-bold mb-1">
        <span className="flex-1">الصنف</span>
        <span className="w-20 text-center">كمية × سعر</span>
        <span className="w-14 text-left">الإجمالي</span>
      </div>
      {sale.items?.map((item) => (
        <div key={item.id} className="mb-1.5">
          <div className="font-semibold leading-snug">{item.productName}</div>
          <div className="flex justify-between mono text-[10px]">
            <span className="flex-1" />
            <span className="w-20 text-center">
              {item.quantity}
              {item.unitName ? ` ${item.unitName}` : ''} × {formatLYD(item.unitPrice)}
            </span>
            <span className="w-14 text-left font-bold">{formatLYD(item.total)}</span>
          </div>
        </div>
      ))}
      <div className="border-b border-dashed border-black/60 my-1" />

      <div className="text-[11px]">
        <div className="flex justify-between">
          <span>المجموع الفرعي</span>
          <span className="mono">{formatLYD(subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span>الخصم</span>
            <span className="mono">-{formatLYD(sale.discount)}</span>
          </div>
        )}
        {sale.taxAmount > 0 && (
          <div className="flex justify-between">
            <span>الضريبة</span>
            <span className="mono">{formatLYD(sale.taxAmount)}</span>
          </div>
        )}
      </div>
      <div className="border-b-2 border-black my-1.5" />
      <div className="flex justify-between font-extrabold text-[15px]">
        <span>الإجمالي</span>
        <span className="mono">{formatLYD(sale.total)} د.ل</span>
      </div>
      <div className="border-b border-dashed border-black/60 mt-1.5" />

      <div className="text-center mt-2 text-[10px]">
        {sale.paymentType === 'credit'
          ? `آجل — العميل: ${sale.customerName || ''}`
          : `الدفع: ${paymentMethodLabel(sale.paymentMethod)}`}
      </div>
      <div className="text-center mt-2 font-semibold">شكراً لتعاملكم معنا</div>
    </div>
  );
};
