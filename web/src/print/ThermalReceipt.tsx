import React from 'react';
import type { Sale, Settings } from '../types';
import { formatLYD } from '../lib/money';

interface ThermalReceiptProps {
  sale: Sale;
  settings: Settings | null;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ sale, settings }) => {
  const paymentMethodLabel = (m: Sale['paymentMethod']) =>
    m === 'cash' ? 'كاش' : m === 'card' ? 'بطاقة مصرفية' : 'حوالة مصرفية';

  return (
    <div
      className="bg-white text-black mx-auto"
      dir="rtl"
      style={{ width: '72mm', fontSize: '11px', lineHeight: 1.5 }}
    >
      <div className="text-center border-b border-dashed border-black/60 pb-2 mb-2">
        <div className="font-extrabold text-[13px]">{settings?.businessName ?? ''}</div>
        {settings?.businessPhone && (
          <div>
            هاتف: <span className="mono">{settings.businessPhone}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between mono text-[10px] mb-1">
        <span>{sale.invoiceNumber}</span>
        <span>{new Date(sale.createdAt).toLocaleString('ar-LY')}</span>
      </div>
      <div className="border-b border-dashed border-black/60 mb-1" />
      {sale.items?.map((item) => (
        <div key={item.id} className="mb-1">
          <div className="font-semibold">{item.productName}</div>
          <div className="flex justify-between mono text-[10px]">
            <span>
              {item.quantity}
              {item.unitName ? ` ${item.unitName}` : ''} × {formatLYD(item.unitPrice)}
            </span>
            <span>{formatLYD(item.total)}</span>
          </div>
        </div>
      ))}
      <div className="border-b border-dashed border-black/60 my-1" />
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
      <div className="flex justify-between font-extrabold text-[13px]">
        <span>الإجمالي</span>
        <span className="mono">{formatLYD(sale.total)} د.ل</span>
      </div>
      <div className="text-center mt-2 text-[10px]">
        {sale.paymentType === 'credit'
          ? `آجل — العميل: ${sale.customerName || ''}`
          : `الدفع: ${paymentMethodLabel(sale.paymentMethod)}`}
      </div>
      <div className="text-center mt-1 font-semibold">شكراً لتعاملكم معنا</div>
    </div>
  );
};
