import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { apiCall } from '../lib/api';
import type { Sale } from '../types';

interface SaleLineDetail {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  returnedQuantity: number;
  unitName: string | null;
  unitPrice: number;
}

interface SaleReturnModalProps {
  isOpen: boolean;
  sale: Sale | null;
  onClose: () => void;
  onSubmit: (items: Array<{ saleItemId: number; quantity: number }>) => void;
}

export const SaleReturnModal: React.FC<SaleReturnModalProps> = ({
  isOpen,
  sale,
  onClose,
  onSubmit,
}) => {
  const [detail, setDetail] = useState<{ items: SaleLineDetail[] } | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isOpen && sale) {
      setDetail(null);
      setQuantities({});
      apiCall(`/api/sales/${sale.id}`).then((res) => {
        if (res.success) setDetail(res.data);
      });
    }
  }, [isOpen, sale]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = Object.entries(quantities)
      .map(([saleItemId, qty]) => ({ saleItemId: Number(saleItemId), quantity: Number(qty) }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) return;
    onSubmit(items);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`مرتجع مبيعات${sale ? ` — ${sale.invoiceNumber}` : ''}`}
      maxWidthClass="max-w-lg"
    >
      {!detail ? (
        <div className="p-10 text-center text-muted text-sm">جارٍ تحميل الفاتورة…</div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            حدد كمية كل صنف تُعاد إلى المخزون. القيمة تُسترد نقداً من الدرج للفواتير النقدية، أو
            تُخصم من رصيد العميل للفواتير الآجلة.
          </p>

          <div className="max-h-60 overflow-y-auto border border-line rounded-control">
            <table className="w-full text-right text-xs">
              <thead className="bg-surface-2 border-b border-line">
                <tr className="font-bold text-muted">
                  <th className="p-2">الصنف</th>
                  <th className="p-2 text-center">المباعة</th>
                  <th className="p-2 text-center">أُرجعت سابقاً</th>
                  <th className="p-2 text-center">كمية المرتجع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.items.map((item) => {
                  const returnable = item.quantity - item.returnedQuantity;
                  return (
                    <tr key={item.id}>
                      <td className="p-2 font-semibold">
                        {item.productName}
                        {item.unitName ? ` (${item.unitName})` : ''}
                      </td>
                      <td className="p-2 text-center mono">{item.quantity}</td>
                      <td className="p-2 text-center mono">{item.returnedQuantity}</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={returnable}
                          disabled={returnable === 0}
                          value={quantities[item.id] ?? '0'}
                          onChange={(e) =>
                            setQuantities({ ...quantities, [item.id]: e.target.value })
                          }
                          className="w-16 h-8 text-center rounded border border-line bg-surface mono text-xs focus-visible:outline-none disabled:opacity-40"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
          >
            متابعة الإرجاع
          </button>
        </form>
      )}
    </Modal>
  );
};
