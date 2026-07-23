import React, { useState, useRef, useEffect } from 'react';
import type { Customer } from '../types';
import { normalizeArabic } from '../lib/arabic';

interface SearchableCustomerSelectProps {
  customers: Customer[];
  selectedCustomerId: number | null;
  onSelectCustomer: (id: number | null) => void;
}

export const SearchableCustomerSelect: React.FC<SearchableCustomerSelectProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedQuery = normalizeArabic(query);
  const filteredCustomers = customers.filter((c) => {
    if (!normalizedQuery) return true;
    const nameMatch = normalizeArabic(c.name).includes(normalizedQuery);
    const phoneMatch = c.phone ? c.phone.includes(query.trim()) : false;
    return nameMatch || phoneMatch;
  });

  const handleSelect = (customer: Customer | null) => {
    onSelectCustomer(customer ? customer.id : null);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-9 rounded-control border border-line bg-surface px-2.5 flex items-center justify-between text-xs cursor-pointer hover:border-jade/50 transition-colors"
      >
        <span className="truncate font-semibold text-text">
          {selectedCustomer ? (
            <>
              {selectedCustomer.name}{' '}
              {selectedCustomer.tier === 'wholesale' && (
                <span className="text-copper text-[10px] font-bold ms-1">(جملة)</span>
              )}
            </>
          ) : (
            <span className="text-muted">— زبون نقدي عام —</span>
          )}
        </span>
        <span className="text-muted text-[10px] ms-1">▼</span>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-surface border border-border rounded-control shadow-xl z-50 overflow-hidden flex flex-col max-h-60">
          <div className="p-1.5 border-b border-line bg-surface-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن زبون بالاسم أو الهاتف..."
              autoFocus
              className="w-full h-8 px-2 text-xs rounded border border-border bg-surface text-text focus-visible:outline-none focus:border-jade"
            />
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-line/40">
            <div
              onClick={() => handleSelect(null)}
              className={`p-2.5 text-xs cursor-pointer hover:bg-surface-2 transition-colors flex justify-between items-center ${
                selectedCustomerId === null ? 'bg-jade/10 font-bold text-jade' : 'text-muted'
              }`}
            >
              <span>— زبون نقدي عام —</span>
            </div>

            {filteredCustomers.map((c) => (
              <div
                key={c.id}
                onClick={() => handleSelect(c)}
                className={`p-2.5 text-xs cursor-pointer hover:bg-surface-2 transition-colors flex justify-between items-center ${
                  selectedCustomerId === c.id ? 'bg-jade/10 font-bold text-jade' : 'text-text'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span>{c.name}</span>
                  {c.tier === 'wholesale' && (
                    <span className="text-[10px] text-copper bg-copper/10 px-1.5 py-0.5 rounded font-bold">
                      جملة
                    </span>
                  )}
                </div>
                {c.phone && <span className="mono text-[10px] text-muted">{c.phone}</span>}
              </div>
            ))}

            {filteredCustomers.length === 0 && (
              <div className="p-3 text-center text-xs text-muted">لا يوجد زبون يطابق البحث</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
