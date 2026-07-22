import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
  noPrint?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidthClass = 'max-w-md',
  noPrint = true,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 ${
        noPrint ? 'no-print' : ''
      }`}
      dir="rtl"
    >
      <div
        className={`w-full ${maxWidthClass} rounded-card border border-line bg-surface p-4 sm:p-6 shadow-xl max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
          <h3 className="font-display font-extrabold text-base">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs border border-border px-3.5 h-9 rounded hover:bg-surface-2 cursor-pointer transition-colors touch-manipulation"
          >
            إغلاق
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
