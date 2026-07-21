import React from 'react';
import type { PrintDocument } from './PrintRoot';
import type { Settings } from '../types';
import { QuotationA4 } from './QuotationA4';
import { PurchaseA4 } from './PurchaseA4';
import { StatementA4 } from './StatementA4';
import { PrintPreviewFrame } from './PrintPreviewFrame';
import { useQrDataUrl } from './useQrDataUrl';
import { triggerPrint } from '../lib/print';

// Generic preview + print modal for document types that don't need any
// pre-print editing (quotations, purchase invoices) — shows the exact same
// component that will be printed, visibly, before committing to print.
// Sale invoices/receipts keep their own modal in AppModals.tsx since that one
// also edits override fields (customer name, stamp title, warranty notes).
interface PrintPreviewModalProps {
  document: PrintDocument | null;
  settings: Settings | null;
  title: string;
  onClose: () => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  document: doc,
  settings,
  title,
  onClose,
}) => {
  const quotationQrDataUrl = useQrDataUrl(
    doc?.type === 'quotation-a4'
      ? `${doc.quotation.quoteNumber} | ${doc.quotation.total} LYD | ${doc.quotation.validUntil}`
      : null
  );

  if (!doc) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto no-print"
      dir="rtl"
    >
      <div className="w-full max-w-2xl rounded-card border border-line bg-surface p-6 shadow-xl my-8 flex flex-col gap-4">
        <div className="flex justify-between items-center pb-3 border-b border-line">
          <h3 className="font-display font-extrabold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="text-xs border border-border px-3 py-1.5 rounded hover:bg-surface-2 cursor-pointer"
          >
            إغلاق
          </button>
        </div>

        <PrintPreviewFrame>
          {doc.type === 'quotation-a4' && (
            <QuotationA4 quotation={doc.quotation} settings={settings} qrDataUrl={quotationQrDataUrl} />
          )}
          {doc.type === 'purchase-a4' && <PurchaseA4 purchase={doc.purchase} settings={settings} />}
          {doc.type === 'statement-a4' && (
            <StatementA4
              customer={doc.customer}
              party={doc.party}
              statementData={doc.statementData}
              settings={settings}
              filterStart={doc.filterStart}
              filterEnd={doc.filterEnd}
              title={doc.title}
              partyLabel={doc.partyLabel}
              signatureLabel={doc.signatureLabel}
            />
          )}
        </PrintPreviewFrame>

        <div className="flex gap-3 pt-3 border-t border-line">
          <button
            onClick={() => triggerPrint('a4')}
            className="flex-1 py-3 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-sm shadow-md flex items-center justify-center gap-2"
          >
            🖨️ طباعة الآن
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
