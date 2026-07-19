import React from 'react';

interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  onChangeValue: (val: string) => void;
  label?: string;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChangeValue,
  label,
  className = '',
  ...props
}) => {
  return (
    <div>
      {label && <label className="text-xs font-bold text-muted mb-1 block">{label}</label>}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        className={`h-10 rounded-control border border-line bg-surface px-3 mono text-sm focus-visible:outline-none focus:border-jade ${className}`}
        {...props}
      />
    </div>
  );
};
