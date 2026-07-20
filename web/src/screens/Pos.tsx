import React, { useRef, useEffect, useState } from 'react';
import type { Product, CartItem, Customer, Deposit, Quotation } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatLYD, parseLYDOrZero } from '../lib/money';
import { Icons } from '../components/Icons';

interface PosProps {
  cart: CartItem[];
  posSearch: string;
  posCategory: string;
  posDiscount: string;
  posCustomerId: number | null;
  posPaymentType: 'cash' | 'credit';
  posPaymentMethod: 'cash' | 'card' | 'transfer';
  posQuotationId: number | null;
  posDepositId: number | null;
  posSpecialPrices: Map<number, number>;
  onSearchChange: (val: string) => void;
  onCategoryChange: (val: string) => void;
  onDiscountChange: (val: string) => void;
  onCustomerChange: (id: number | null) => void;
  onPaymentTypeChange: (type: 'cash' | 'credit') => void;
  onPaymentMethodChange: (method: 'cash' | 'card' | 'transfer') => void;
  onDepositChange: (depositId: number | null) => void;
  onAddToCart: (product: Product) => void;
  onUpdateCartQuantity: (productId: number, qty: number) => void;
  onChangeCartUnit: (productId: number, unitIdVal: string) => void;
  onRemoveFromCart: (productId: number) => void;
  onClearCart: () => void;
  onSaveQuotation: () => void;
  onCheckout: () => void;
}

export const PosScreen: React.FC<PosProps> = ({
  cart,
  posSearch,
  posCategory,
  posDiscount,
  posCustomerId,
  posPaymentType,
  posPaymentMethod,
  posQuotationId,
  posDepositId,
  posSpecialPrices,
  onSearchChange,
  onCategoryChange,
  onDiscountChange,
  onCustomerChange,
  onPaymentTypeChange,
  onPaymentMethodChange,
  onDepositChange,
  onAddToCart,
  onUpdateCartQuantity,
  onChangeCartUnit,
  onRemoveFromCart,
  onClearCart,
  onSaveQuotation,
  onCheckout,
}) => {
  const { currentUser } = useAuth();
  const { productsList, customersList, depositsList, quotationsList, settingsData, activeShift } = useData();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cash Change Calculator State
  const [givenCash, setGivenCash] = useState<string>('');

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Keyboard shortcut listener (F10 checkout, F2 search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        if (cart.length > 0 && activeShift) {
          onCheckout();
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, activeShift, onCheckout]);

  const resolveClientPrice = (product: Product): number => {
    if (posCustomerId) {
      const special = posSpecialPrices.get(product.id);
      if (special !== undefined) return special;
      const customer = customersList.find((c) => c.id === posCustomerId);
      if (customer?.tier === 'wholesale' && product.wholesalePrice > 0) {
        return product.wholesalePrice;
      }
    }
    return product.retailPrice;
  };

  const categories = [
    'ALL',
    ...Array.from(new Set(productsList.map((p) => p.category.toUpperCase()))),
  ];

  const filteredProducts = productsList.filter((p) => {
    const matchesCategory =
      posCategory === 'ALL' || p.category.toLowerCase() === posCategory.toLowerCase();
    const matchesSearch =
      !posSearch ||
      p.name.toLowerCase().includes(posSearch.toLowerCase()) ||
      (p.barcode && p.barcode.includes(posSearch)) ||
      (p.serialNumber && p.serialNumber.toLowerCase().includes(posSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const cartSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountMillis = parseLYDOrZero(posDiscount);
  const isTaxEnabled = settingsData?.taxEnabled ?? false;
  const taxRatePermille = settingsData?.taxRatePermille ?? 0;
  const cartTax = isTaxEnabled
    ? Math.round(((cartSubtotal - discountMillis) * taxRatePermille) / 1000)
    : 0;

  // Active Customer held deposits
  const customerHeldDeposits = posCustomerId
    ? depositsList.filter((d) => d.customerId === posCustomerId && d.status === 'held')
    : [];

  const activeDeposit = depositsList.find((d) => d.id === posDepositId);
  const depositDeduction = activeDeposit ? activeDeposit.amount : 0;

  const cartTotal = Math.max(0, cartSubtotal + cartTax - discountMillis - depositDeduction);

  // Given cash & change calculation
  const givenCashMillis = parseLYDOrZero(givenCash);
  const changeDueMillis = givenCashMillis > cartTotal ? givenCashMillis - cartTotal : 0;

  const activeQuotation = quotationsList.find((q) => q.id === posQuotationId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 h-full" dir="rtl">
      {/* Products Grid Column */}
      <div className="flex flex-col gap-4">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-surface border border-line p-3.5 rounded-card shadow-sm">
          <div className="relative flex-1 w-full">
            <input
              ref={searchInputRef}
              type="text"
              value={posSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="امسح الباركد أو ابحث عن المنتج... (اضغط F2)"
              className="w-full h-10 pr-10 pl-3 rounded-control border border-line bg-surface text-sm focus-visible:outline-none focus:border-jade"
            />
            <div className="absolute right-3 top-2.5">
              <Icons.Search />
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  posCategory === cat
                    ? 'bg-jade text-white'
                    : 'bg-surface-2 text-muted border border-border hover:text-text'
                }`}
              >
                {cat === 'ALL' ? 'جميع الأقسام' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 overflow-y-auto max-h-[calc(100vh-230px)]">
          {filteredProducts.map((product) => {
            const price = resolveClientPrice(product);
            const isOutOfStock = product.quantity <= 0;

            return (
              <button
                key={product.id}
                onClick={() => onAddToCart(product)}
                className="flex flex-col justify-between p-3.5 rounded-card border border-line bg-surface hover:border-jade/50 hover:shadow-md transition-all text-right cursor-pointer group relative overflow-hidden"
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-24 object-cover rounded-control mb-2"
                  />
                )}
                <div>
                  <div className="text-xs text-muted mb-0.5">{product.category}</div>
                  <div className="font-bold text-sm text-text leading-tight mb-2 line-clamp-2">
                    {product.name}
                  </div>
                </div>

                <div className="flex justify-between items-end mt-2 pt-2 border-t border-line">
                  <span className="mono font-bold text-jade text-sm">{formatLYD(price)} د.ل</span>
                  <span
                    className={`text-[10px] font-bold ${
                      isOutOfStock ? 'text-alert' : 'text-muted'
                    }`}
                  >
                    {isOutOfStock ? 'نافذ' : `${product.quantity} ${product.baseUnit}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart Column */}
      <div className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-lg justify-between overflow-y-auto">
        <div>
          <div className="flex justify-between items-center pb-3 border-b border-line mb-3">
            <h2 className="font-display font-black text-base flex items-center gap-2">
              <Icons.ShoppingCart className="h-5 w-5 text-jade" />
              <span>سلة المبيعات الحالية</span>
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs mono font-bold text-muted">{cart.length} صنف</span>
              {cart.length > 0 && (
                <button
                  onClick={onClearCart}
                  className="text-xs text-alert hover:underline font-bold cursor-pointer"
                  title="إفراغ السلة بالكامل"
                >
                  إفراغ السلة 🗑️
                </button>
              )}
            </div>
          </div>

          {/* Customer, Payment Type & Method Selectors */}
          <div className="flex flex-col gap-2 mb-3 bg-surface-2 p-3 rounded-control border border-border">
            <div>
              <label className="text-[11px] font-bold text-muted mb-1 block">العميل المستهدف</label>
              <select
                value={posCustomerId || ''}
                onChange={(e) =>
                  onCustomerChange(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full h-9 rounded-control border border-line bg-surface px-2 text-xs focus-visible:outline-none"
              >
                <option value="">— زبون نقدي عام —</option>
                {customersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.tier === 'wholesale' ? '(جملة)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Held Deposit selector if available for customer */}
            {customerHeldDeposits.length > 0 && (
              <div>
                <label className="text-[11px] font-bold text-copper mb-1 block">
                  عربون / حجز مسبق متاح للعميل
                </label>
                <select
                  value={posDepositId || ''}
                  onChange={(e) =>
                    onDepositChange(e.target.value ? Number(e.target.value) : null)
                  }
                  className="w-full h-9 rounded-control border border-copper/40 bg-copper/5 text-copper font-bold px-2 text-xs focus-visible:outline-none"
                >
                  <option value="">— عدم خصم عربون —</option>
                  {customerHeldDeposits.map((d) => (
                    <option key={d.id} value={d.id}>
                      عربون #{d.id} ({formatLYD(d.amount)} د.ل) — {d.productName || 'عام'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Type: Cash vs Credit */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => onPaymentTypeChange('cash')}
                className={`py-1.5 rounded-control text-xs font-bold transition-colors cursor-pointer ${
                  posPaymentType === 'cash'
                    ? 'bg-jade text-white'
                    : 'bg-surface border border-border text-muted'
                }`}
              >
                بيع نقدي
              </button>
              <button
                type="button"
                onClick={() => onPaymentTypeChange('credit')}
                className={`py-1.5 rounded-control text-xs font-bold transition-colors cursor-pointer ${
                  posPaymentType === 'credit'
                    ? 'bg-copper text-white'
                    : 'bg-surface border border-border text-muted'
                }`}
              >
                بيع آجل (دين)
              </button>
            </div>

            {/* Payment Method Selector when Cash Payment */}
            {posPaymentType === 'cash' && (
              <div className="grid grid-cols-3 gap-1.5 mt-1 pt-2 border-t border-line/60">
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange('cash')}
                  className={`py-1 rounded-control text-[11px] font-bold transition-colors cursor-pointer ${
                    posPaymentMethod === 'cash'
                      ? 'bg-jade/20 text-jade border border-jade/40'
                      : 'bg-surface border border-border text-muted'
                  }`}
                >
                  💵 كاش
                </button>
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange('card')}
                  className={`py-1 rounded-control text-[11px] font-bold transition-colors cursor-pointer ${
                    posPaymentMethod === 'card'
                      ? 'bg-purple-600/20 text-purple-600 border border-purple-600/40'
                      : 'bg-surface border border-border text-muted'
                  }`}
                >
                  💳 بطاقة
                </button>
                <button
                  type="button"
                  onClick={() => onPaymentMethodChange('transfer')}
                  className={`py-1 rounded-control text-[11px] font-bold transition-colors cursor-pointer ${
                    posPaymentMethod === 'transfer'
                      ? 'bg-blue-600/20 text-blue-600 border border-blue-600/40'
                      : 'bg-surface border border-border text-muted'
                  }`}
                >
                  🏦 حوالة
                </button>
              </div>
            )}
          </div>

          {/* Active Quotation Notification */}
          {activeQuotation && (
            <div className="mb-2 p-2 bg-copper/10 border border-copper/30 text-copper text-xs rounded-control font-bold flex justify-between items-center">
              <span>تحويل عرض السعر: #{activeQuotation.quoteNumber}</span>
            </div>
          )}

          {/* Cart Items List */}
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[260px] mb-4">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="p-2.5 rounded-control bg-surface-2 border border-border flex justify-between items-center gap-2 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{item.product.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="mono text-muted text-[10px]">
                      {formatLYD(item.unitPrice)} د.ل
                    </span>
                    {item.product.units && item.product.units.length > 0 && (
                      <select
                        value={item.unitId || ''}
                        onChange={(e) => onChangeCartUnit(item.product.id, e.target.value)}
                        className="h-6 rounded border border-border bg-surface px-1 text-[10px] font-semibold focus-visible:outline-none"
                      >
                        <option value="">{item.product.baseUnit} (أساسية)</option>
                        {item.product.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.unitName} ({u.conversionFactor}×)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateCartQuantity(item.product.id, item.quantity - 1)}
                    className="w-6 h-6 rounded bg-surface border border-border flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="mono font-bold w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateCartQuantity(item.product.id, item.quantity + 1)}
                    className="w-6 h-6 rounded bg-surface border border-border flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>

                <div className="mono font-bold text-jade min-w-[60px] text-left">
                  {formatLYD(item.quantity * item.unitPrice)}
                </div>

                <button
                  onClick={() => onRemoveFromCart(item.product.id)}
                  className="text-alert hover:text-red-600 p-1"
                >
                  <Icons.Trash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="p-8 text-center text-muted text-xs">السلة فارغة حالياً.</div>
            )}
          </div>
        </div>

        {/* Given Cash & Change Calculator (Cash sales only) */}
        {posPaymentType === 'cash' && posPaymentMethod === 'cash' && cart.length > 0 && (
          <div className="mb-3 p-2.5 rounded-control bg-surface-2 border border-line flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-muted">المبلغ المستلم من الزبون (د.ل):</span>
              <input
                type="text"
                inputMode="decimal"
                value={givenCash}
                onChange={(e) => setGivenCash(e.target.value)}
                placeholder={(cartTotal / 1000).toFixed(3)}
                className="w-28 h-7 text-left rounded border border-border bg-surface px-2 mono text-xs font-bold focus-visible:outline-none focus:border-jade"
              />
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span>الباقي للزبون:</span>
              <span className={`mono text-sm ${changeDueMillis > 0 ? 'text-copper' : 'text-muted'}`}>
                {formatLYD(changeDueMillis)} د.ل
              </span>
            </div>
          </div>
        )}

        {/* Totals & Checkout Actions */}
        <div className="border-t border-line pt-3 flex flex-col gap-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted">الخصم (د.ل):</span>
            <input
              type="text"
              inputMode="decimal"
              value={posDiscount}
              onChange={(e) => onDiscountChange(e.target.value)}
              className="w-24 h-7 text-left rounded border border-border bg-surface px-2 mono text-xs focus-visible:outline-none"
            />
          </div>

          {activeDeposit && (
            <div className="flex justify-between items-center text-xs text-copper font-bold">
              <span>خصم عربون حجز:</span>
              <span className="mono">-{formatLYD(depositDeduction)} د.ل</span>
            </div>
          )}

          <div className="flex justify-between items-center text-base font-extrabold">
            <span>الإجمالي النهائي:</span>
            <span className="mono text-jade text-xl">{formatLYD(cartTotal)} د.ل</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              onClick={onSaveQuotation}
              disabled={cart.length === 0}
              className="py-2.5 bg-surface border border-border text-muted hover:text-text font-bold text-xs rounded-control transition-colors cursor-pointer disabled:opacity-50"
            >
              حفظ كـ عرض سعر
            </button>
            <button
              onClick={onCheckout}
              disabled={cart.length === 0 || !activeShift}
              className="py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <span>تأكيد البيع</span>
              <span className="text-[10px] opacity-80">(F10)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
