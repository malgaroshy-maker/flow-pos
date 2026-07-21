import React from 'react';

// Shows a scaled-down, on-screen rendering of the actual print component —
// same InvoiceA4/ThermalReceipt/etc. used for the real print job, just
// visible and shrunk to fit a modal instead of hidden in .print-only.
export const PrintPreviewFrame: React.FC<{
  children: React.ReactNode;
  widthMm?: number;
  scale?: number;
}> = ({ children, widthMm = 210, scale = 0.55 }) => (
  <div className="rounded-xl border border-line bg-neutral-200 overflow-auto max-h-[55vh] flex justify-center py-4">
    <div style={{ width: `${widthMm}mm`, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
      {children}
    </div>
  </div>
);
