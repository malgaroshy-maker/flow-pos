import React from 'react';
import type { Sale, Quotation, Customer, Purchase, Settings } from '../types';
import { InvoiceA4 } from './InvoiceA4';
import { ThermalReceipt } from './ThermalReceipt';
import { QuotationA4 } from './QuotationA4';
import { StatementA4 } from './StatementA4';
import { PurchaseA4 } from './PurchaseA4';
import { useQrDataUrl } from './useQrDataUrl';

export type PrintDocument =
  | { type: 'sale-a4'; sale: Sale; overrideCustomerName?: string; overrideWarrantyNotes?: string; overrideStampTitle?: string }
  | { type: 'sale-thermal'; sale: Sale }
  | { type: 'quotation-a4'; quotation: Quotation }
  | { type: 'purchase-a4'; purchase: Purchase }
  | {
      type: 'statement-a4';
      customer?: Customer | null;
      party?: { name: string; phone?: string | null; address?: string | null };
      statementData: any;
      filterStart?: string;
      filterEnd?: string;
      title?: string;
      partyLabel?: string;
      signatureLabel?: string;
    };

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
      {doc.type === 'purchase-a4' && (
        <PurchaseA4 purchase={doc.purchase} settings={settings} />
      )}
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
    </div>
  );
};
