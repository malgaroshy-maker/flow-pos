import React from 'react';

type DocumentStatus =
  | 'completed'
  | 'paid'
  | 'open'
  | 'active'
  | 'pending'
  | 'draft'
  | 'partial'
  | 'cancelled'
  | 'expired'
  | 'shortage'
  | 'surplus';

interface StatusPillProps {
  status: DocumentStatus | string;
  label?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, label }) => {
  const getStyle = (st: string) => {
    switch (st) {
      case 'completed':
      case 'paid':
      case 'open':
      case 'active':
        return 'bg-jade/10 text-jade border-jade/30';
      case 'pending':
      case 'draft':
      case 'partial':
      case 'surplus':
        return 'bg-copper/10 text-copper border-copper/30';
      case 'cancelled':
      case 'expired':
      case 'shortage':
        return 'bg-alert/10 text-alert border-alert/30';
      default:
        return 'bg-surface-2 text-muted border-border';
    }
  };

  const getLabel = (st: string) => {
    if (label) return label;
    switch (st) {
      case 'completed':
        return 'مكتملة';
      case 'paid':
        return 'مدفوعة';
      case 'open':
        return 'مفتوحة';
      case 'active':
        return 'نشط';
      case 'pending':
        return 'معلقة';
      case 'draft':
        return 'مسودة';
      case 'partial':
        return 'دفعة جزئية';
      case 'cancelled':
        return 'ملغاة';
      case 'expired':
        return 'منتهي الصلاحية';
      default:
        return st;
    }
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${getStyle(
        status
      )}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>{getLabel(status)}</span>
    </span>
  );
};
