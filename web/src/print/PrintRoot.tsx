import React from 'react';
import type { Sale, Quotation, Customer, Settings } from '../types';
import { InvoiceA4 } from './InvoiceA4';
import { ThermalReceipt } from './ThermalReceipt';
import { QuotationA4 } from './QuotationA4';
import { StatementA4 } from './StatementA4';
import { useQrDataUrl } from './useQrDataUrl';

export type PrintDocument =
  | { type: 'sale-a4'; sale: Sale; overrideCustomerName?: string; overrideWarrantyNotes?: string; overrideStampTitle?: string }
  | { type: 'sale-thermal'; sale: Sale }
  | { type: 'quotation-a4'; quotation: Quotation }
  | { type: 'statement-a4'; customer: Customer; statementData: any; filterStart?: string; filterEnd?: string };

interface PrintRootProps {
  document: PrintDocument | null;
  settings: Settings | null;
}

export const PrintRoot: React.FC<PrintRootProps> = ({ document: doc, settings }) => {
  const saleQrDataUrl = useQrDataUrl(
    doc?.type === 'sale-a4'
      ? `${doc.sale.invoiceNumber} | ${doc.sale.total} LYD | ${doc.sale.createdAt}`
      : null
  );

  const quotationQrDataUrl = useQrDataUrl(
    doc?.type === 'quotation-a4'
      ? `${doc.quotation.quoteNumber} | ${doc.quotation.total} LYD | ${doc.quotation.validUntil}`
      : null
  );

  if (!doc) return null;

  return (
    <div className="print-only">
      {doc.type === 'sale-a4' && (
        <InvoiceA4
          sale={doc.sale}
          settings={settings}
          overrideCustomerName={doc.overrideCustomerName}
          overrideWarrantyNotes={doc.overrideWarrantyNotes}
          overrideStampTitle={doc.overrideStampTitle}
          qrDataUrl={saleQrDataUrl}
        />
      )}
      {doc.type === 'sale-thermal' && (
        <ThermalReceipt sale={doc.sale} settings={settings} />
      )}
      {doc.type === 'quotation-a4' && (
        <QuotationA4 quotation={doc.quotation} settings={settings} qrDataUrl={quotationQrDataUrl} />
      )}
      {doc.type === 'statement-a4' && (
        <StatementA4
          customer={doc.customer}
          statementData={doc.statementData}
          settings={settings}
          filterStart={doc.filterStart}
          filterEnd={doc.filterEnd}
        />
      )}
    </div>
  );
};
