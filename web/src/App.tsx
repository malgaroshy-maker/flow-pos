import { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { currentTheme, toggleTheme, type Theme } from './theme';
import { tafqeetLYD } from './lib/tafqeet';
import { formatLYD, parseLYDOrZero } from './lib/money';

// Types
type ProductUnit = {
  id: number;
  productId: number;
  unitName: string;
  conversionFactor: number; // base units per this unit
  price: number; // milli-LYD per this unit
};

type Product = {
  id: number;
  name: string;
  type: 'equipment' | 'consumable';
  category: string;
  baseUnit: string;
  imageUrl?: string;
  barcode?: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  quantity: number; // always in base units
  reorderPoint: number;
  serialNumber?: string;
  warrantyMonths?: number;
  batchNo?: string;
  expiryDate?: string;
  taxExempt?: boolean;
  reservedQuantity?: number;
  units?: ProductUnit[];
  components?: Array<{
    id: number;
    componentProductId: number;
    quantity: number;
    componentName: string | null;
  }>;
  bundleAvailable?: number | null;
};

type Deposit = {
  id: number;
  customerId: number;
  customerName: string;
  productId?: number | null;
  productName?: string | null;
  amount: number;
  status: 'held' | 'applied' | 'refunded' | 'forfeited';
  saleId?: number | null;
  username: string;
  notes?: string | null;
  createdAt: string;
};

type CartItem = {
  product: Product;
  quantity: number; // in the selected unit
  unitPrice: number; // per selected unit
  unitId?: number; // undefined = base unit
  unitName?: string;
  conversionFactor?: number; // base units per selected unit (default 1)
  serialNumber?: string;
};

type Sale = {
  id: number;
  invoiceNumber: string;
  userId: number;
  username: string;
  shiftId: number;
  customerId?: number | null;
  customerName?: string | null;
  paymentType: 'cash' | 'credit';
  paymentMethod: 'cash' | 'card' | 'transfer';
  taxAmount: number;
  discount: number;
  qrRef?: string;
  total: number;
  status: 'completed' | 'cancelled';
  createdAt: string;
  items?: Array<{
    id: number;
    productId: number;
    productName: string;
    productType?: 'equipment' | 'consumable' | null;
    quantity: number;
    unitName?: string | null;
    conversionFactor?: number;
    unitPrice: number;
    total: number;
    baseUnit: string;
    serialNumber?: string;
  }>;
};

type Shift = {
  id: number;
  openedByUserId: number;
  openedByUsername: string;
  closedByUserId?: number;
  closedByUsername?: string | null;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  expectedCash: number;
  actualCash?: number;
  variance?: number;
  status: 'open' | 'closed';
};

type Expense = {
  id: number;
  shiftId: number;
  amount: number;
  reason: string;
  category: string;
  createdAt: string;
};

type User = {
  id: number;
  username: string;
  role: 'manager' | 'sales';
  active: boolean;
};

type Settings = {
  businessName: string;
  businessSubtitle?: string;
  businessPhone?: string;
  businessPhone2?: string;
  businessAddress?: string;
  warrantyTerms?: string;
  stampTitle?: string;
  taxEnabled: boolean;
  taxRatePermille: number;
  discountCapPercent: number;
  currency: string;
};

type Backup = {
  filename: string;
  createdAt: string;
};

type Customer = {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  tier: 'retail' | 'wholesale';
  creditLimit: number; // milli-LYD; 0 = unlimited
  creditBalance: number;
  notes?: string;
  createdAt: string;
};

type SpecialPrice = {
  id: number;
  productId: number;
  price: number;
  productName: string | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
};

type Quotation = {
  id: number;
  quoteNumber: string;
  customerId?: number | null;
  customerName?: string | null;
  userId: number;
  username?: string;
  validUntil: string;
  status: 'active' | 'converted' | 'expired' | 'cancelled';
  discount: number;
  taxAmount: number;
  total: number;
  convertedSaleId?: number | null;
  notes?: string | null;
  createdAt: string;
  items?: Array<{
    id: number;
    productId: number;
    productName: string;
    quantity: number;
    unitId?: number | null;
    unitName?: string | null;
    conversionFactor?: number;
    unitPrice: number;
    total: number;
  }>;
};

type Supplier = {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  debtBalance: number;
  notes?: string;
  createdAt: string;
};

type Purchase = {
  id: number;
  invoiceNumber: string;
  supplierId?: number;
  supplierName?: string;
  total: number;
  paid: number;
  status: 'pending' | 'partial' | 'paid';
  notes?: string;
  username?: string;
  createdAt: string;
  items?: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitCost: number;
    total: number;
  }>;
};

type StockMovement = {
  id: number;
  productId: number;
  type: string;
  quantity: number;
  balanceAfter: number;
  reason?: string;
  userId: number;
  createdAt: string;
};

// SVG Icons
const Icons = {
  Home: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  Dashboard: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"
      />
    </svg>
  ),
  POS: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  ),
  Products: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  ),
  Shifts: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  Reports: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"
      />
    </svg>
  ),
  Settings: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  User: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  ),
  Search: () => (
    <svg
      className="h-5 w-5 text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  ),
  Plus: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  Minus: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
  ),
  Trash: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-4 w-4'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  AlertTriangle: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5 text-copper'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  Power: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  ),
  Printer: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  ),
  Download: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  ),
  Truck: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
      />
    </svg>
  ),
  Users: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  ),
  ShoppingCart: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  ),
  TrendUp: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  AlertCircle: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  History: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  CheckCircle: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  Receipt: (props?: { className?: string }) => (
    <svg
      className={props?.className ?? 'h-5 w-5'}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
  ),
};

// Money parsing/formatting lives in lib/money.ts (string-based, no float rounding).

export function App() {
  const today = new Date().toISOString().split('T')[0] || '';
  const [theme, setThemeState] = useState<Theme>(() => currentTheme());
  const [activeTab, setActiveTab] = useState('Home');
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pos-token'));
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem('pos-user');
    return saved ? JSON.parse(saved) : null;
  });

  // Database Data States
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [shiftsList, setShiftsList] = useState<Shift[]>([]);
  const [expensesList, setExpensesList] = useState<Expense[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [backupsList, setBackupsList] = useState<Backup[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [settingsData, setSettingsData] = useState<Settings | null>(null);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [purchasesList, setPurchasesList] = useState<Purchase[]>([]);

  // Stock Movements
  const [stockMovementsForProduct, setStockMovementsForProduct] = useState<StockMovement[]>([]);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null);

  // Customers State
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    tier: 'retail' as 'retail' | 'wholesale',
    creditLimit: '0.000',
  });
  // Special prices management (per customer, manager only)
  const [showSpecialPricesModal, setShowSpecialPricesModal] = useState(false);
  const [specialPricesCustomer, setSpecialPricesCustomer] = useState<Customer | null>(null);
  const [specialPricesList, setSpecialPricesList] = useState<SpecialPrice[]>([]);
  const [specialPriceForm, setSpecialPriceForm] = useState({ productId: '', price: '0.000' });
  // Special prices of the customer currently selected on the POS screen
  const [posSpecialPrices, setPosSpecialPrices] = useState<Map<number, number>>(new Map());
  const [showCustomerPaymentModal, setShowCustomerPaymentModal] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('0.000');

  // Customer Account Statement Modal State
  const [showCustomerStatementModal, setShowCustomerStatementModal] = useState(false);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [statementData, setStatementData] = useState<any | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementFilterStart, setStatementFilterStart] = useState('');
  const [statementFilterEnd, setStatementFilterEnd] = useState('');

  // Suppliers State
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '', notes: '' });

  // Purchases State
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    supplierName: '',
    items: [{ productId: '', quantity: '1', unitCost: '0.000' }] as Array<{
      productId: string;
      quantity: string;
      unitCost: string;
    }>,
    paid: '0.000',
    notes: '',
  });

  // Supplier return (against an existing purchase)
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState<any | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({});
  const [returnRefundMethod, setReturnRefundMethod] = useState<'debt' | 'cash'>('debt');

  // Print Mode (A4 invoice vs 80mm thermal receipt) & per-print overrides
  const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');
  const [overrideCustomerName, setOverrideCustomerName] = useState('');
  const [overrideWarrantyNotes, setOverrideWarrantyNotes] = useState('');
  const [overrideStampTitle, setOverrideStampTitle] = useState('');
  const [showInvoiceControls, setShowInvoiceControls] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // Quotation A4 print preview
  const [printingQuotation, setPrintingQuotation] = useState<Quotation | null>(null);
  const [showQuotationPrintModal, setShowQuotationPrintModal] = useState(false);
  const [quotationQrDataUrl, setQuotationQrDataUrl] = useState<string | null>(null);

  // Shift close summary
  const [shiftCloseSummary, setShiftCloseSummary] = useState<any>(null);
  const [showShiftSummaryModal, setShowShiftSummaryModal] = useState(false);

  // POS Customer selection
  const [posCustomerId, setPosCustomerId] = useState<number | null>(null);
  const [posPaymentType, setPosPaymentType] = useState<'cash' | 'credit'>('cash');

  // Quotations
  const [quotationsList, setQuotationsList] = useState<Quotation[]>([]);
  // When set, checkout converts this quotation instead of creating a plain sale
  const [posQuotationId, setPosQuotationId] = useState<number | null>(null);

  // Deposits (عربون)
  const [depositsList, setDepositsList] = useState<Deposit[]>([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositCustomer, setDepositCustomer] = useState<Customer | null>(null);
  const [depositForm, setDepositForm] = useState({ amount: '0.000', productId: '', notes: '' });
  // When set, checkout applies this held deposit against the invoice
  const [posDepositId, setPosDepositId] = useState<number | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState('ALL');
  const [posDiscount, setPosDiscount] = useState('0');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [checkoutOverridePin, setCheckoutOverridePin] = useState('');

  // UI state overlays
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideModalReason, setOverrideModalReason] = useState('');
  const [overrideModalCallback, setOverrideModalCallback] = useState<any>(null);

  // Create / Edit Product Overlay
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    type: 'consumable' as 'equipment' | 'consumable',
    category: '',
    baseUnit: 'piece',
    barcode: '',
    costPrice: '0.000',
    retailPrice: '0.000',
    wholesalePrice: '0.000',
    quantity: '0',
    reorderPoint: '0',
    serialNumber: '',
    warrantyMonths: '0',
    batchNo: '',
    expiryDate: '',
    taxExempt: false,
  });
  // Packaging units editor rows (multi-unit is opt-in per product)
  const [productUnitsForm, setProductUnitsForm] = useState<
    Array<{ unitName: string; conversionFactor: string; price: string }>
  >([]);
  // Bundle components editor rows (a product with components sells as a bundle)
  const [productComponentsForm, setProductComponentsForm] = useState<
    Array<{ componentProductId: string; quantity: string }>
  >([]);

  // Adjust Stock Overlay
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    quantity: '0',
    reason: '',
  });

  // Expense Overlay
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    amount: '0.000',
    reason: '',
    category: 'supplies',
  });

  // Shift Drawer Opening Overlay
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openShiftForm, setOpenShiftForm] = useState({
    openingCash: '0.000',
  });

  // Shift Drawer Closing Overlay
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [closeShiftForm, setCloseShiftForm] = useState({
    actualCash: '0.000',
  });

  // Print Invoice Overlay
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printingSale, setPrintingSale] = useState<Sale | null>(null);

  // Authentication Fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // User switcher PIN overlay
  const [showUserPinModal, setShowUserPinModal] = useState(false);
  const [switchPinValue, setSwitchPinValue] = useState('');

  // Create User Overlay
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    password: '',
    pin: '',
    role: 'sales' as 'manager' | 'sales',
  });

  // Edit User Overlay
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    password: '',
    pin: '',
    role: 'sales' as 'manager' | 'sales',
    active: true,
  });

  // Toast System
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'alert'>('success');
  const triggerToast = (msg: string, type: 'success' | 'alert' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const posSearchInputRef = useRef<HTMLInputElement>(null);

  // Fetch settings & health
  const loadBaseData = () => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then(setSettingsData)
      .catch(() => {});
  };

  // Fetch all DB records
  const refreshAllData = () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const handleFetchResponse = (res: Response, fallback: any = []) => {
      if (res.status === 401) {
        handleLogout();
        throw new Error('Unauthorized');
      }
      return res.ok ? res.json() : fallback;
    };

    fetch('/api/products', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setProductsList)
      .catch(() => {});

    fetch('/api/sales', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setSalesList)
      .catch(() => {});

    fetch('/api/shifts/active', { headers })
      .then((r) => handleFetchResponse(r, { active: null }))
      .then((data) => setActiveShift(data?.active ?? null))
      .catch(() => {});

    fetch('/api/shifts', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setShiftsList)
      .catch(() => {});

    fetch('/api/expenses', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setExpensesList)
      .catch(() => {});

    fetch('/api/users', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setUsersList)
      .catch(() => {});

    fetch('/api/backup/list', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setBackupsList)
      .catch(() => {});

    if (currentUser && currentUser.role === 'manager') {
      fetch('/api/audit-logs', { headers })
        .then((r) => handleFetchResponse(r, []))
        .then(setAuditLogsList)
        .catch(() => {});
    }

    fetch('/api/customers', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setCustomersList)
      .catch(() => {});

    fetch('/api/suppliers', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setSuppliersList)
      .catch(() => {});

    fetch('/api/purchases', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setPurchasesList)
      .catch(() => {});

    fetch('/api/quotations', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setQuotationsList)
      .catch(() => {});

    fetch('/api/deposits', { headers })
      .then((r) => handleFetchResponse(r, []))
      .then(setDepositsList)
      .catch(() => {});
  };

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [token]);

  // Handle focus on scanner field on POS screen
  useEffect(() => {
    if (activeTab === 'POS' && posSearchInputRef.current) {
      posSearchInputRef.current.focus();
    }
  }, [activeTab]);

  // API Call Wrapper for Mutations & Queries
  const apiCall = async (url: string, method: string = 'GET', body?: any) => {
    if (!token) return { success: false, error: 'no_token' };
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (response.status === 401) {
        handleLogout();
        throw new Error('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول');
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'حدث خطأ غير متوقع');
      }
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Auth Operations
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const res = await r.json();
      if (!r.ok) {
        setLoginError(res.message || 'بيانات الدخول غير صحيحة');
        return;
      }
      localStorage.setItem('pos-token', res.token);
      localStorage.setItem('pos-user', JSON.stringify(res.user));
      setToken(res.token);
      setCurrentUser(res.user);
      triggerToast(`مرحباً بك، ${res.user.username}`);
    } catch {
      setLoginError('فشل الاتصال بالخادم');
    }
  };

  const handlePinSwitch = async (pinStr: string) => {
    setLoginError('');
    try {
      const r = await fetch('/api/auth/pin-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinStr }),
      });
      const res = await r.json();
      if (!r.ok) {
        triggerToast(res.message || 'رمز PIN غير صحيح', 'alert');
        return;
      }
      localStorage.setItem('pos-token', res.token);
      localStorage.setItem('pos-user', JSON.stringify(res.user));
      setToken(res.token);
      setCurrentUser(res.user);
      setShowUserPinModal(false);
      setSwitchPinValue('');
      triggerToast(`تم التبديل إلى: ${res.user.username}`);
    } catch {
      triggerToast('فشل الاتصال بالخادم', 'alert');
    }
  };

  const handleLogout = () => {
    // Invalidate the server-side session; local cleanup happens regardless.
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('pos-token');
    localStorage.removeItem('pos-user');
    setToken(null);
    setCurrentUser(null);
    setCart([]);
  };

  // Create User (Manager Only)
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall('/api/users', 'POST', createUserForm);
    if (res.success) {
      triggerToast('تم تسجيل المستخدم الجديد بنجاح');
      setShowCreateUserModal(false);
      setCreateUserForm({ username: '', password: '', pin: '', role: 'sales' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إضافة المستخدم', 'alert');
    }
  };

  // Edit User (Manager Only)
  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const res = await apiCall(`/api/users/${editingUser.id}`, 'PUT', {
      password: editUserForm.password,
      pin: editUserForm.pin,
      role: editUserForm.role,
      active: editUserForm.active,
    });
    if (res.success) {
      triggerToast('تم تحديث بيانات المستخدم بنجاح');
      setShowEditUserModal(false);
      setEditingUser(null);
      setEditUserForm({ password: '', pin: '', role: 'sales', active: true });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تحديث المستخدم', 'alert');
    }
  };

  // POS operations
  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      updateCartQuantity(product.id, existing.quantity + 1);
    } else {
      const unitPrice = resolveClientPrice(product, posCustomerId, posSpecialPrices);
      if (product.quantity <= 0) {
        // Trigger PIN override modal or check if manager
        if (currentUser.role !== 'manager') {
          triggerPinOverride(
            `السماح ببيع منتج نافذ من المخزون: ${product.name}`,
            (overridePin: string) => {
              setCart([...cart, { product, quantity: 1, unitPrice }]);
              triggerToast(`تمت إضافة منتج بموافقة إدارية: ${product.name}`);
            },
          );
          return;
        }
      }
      setCart([...cart, { product, quantity: 1, unitPrice }]);
    }
  };

  const updateCartQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      setCart(cart.filter((item) => item.product.id !== productId));
      return;
    }

    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    // Stock is tracked in base units; packaging units consume factor × qty.
    const baseNeeded = newQty * (item.conversionFactor || 1);
    if (item.product.quantity < baseNeeded && currentUser.role !== 'manager') {
      triggerPinOverride(
        `تخطي الكمية المتاحة لـ ${item.product.name} (المخزون: ${item.product.quantity} ${item.product.baseUnit})`,
        (overridePin: string) => {
          setCart(cart.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i)));
        },
      );
      return;
    }

    setCart(cart.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i)));
  };

  // Switch a cart line between the base unit and a packaging unit
  const changeCartUnit = (productId: number, unitIdValue: string) => {
    setCart(
      cart.map((i) => {
        if (i.product.id !== productId) return i;
        if (!unitIdValue) {
          return {
            ...i,
            unitId: undefined,
            unitName: undefined,
            conversionFactor: 1,
            unitPrice: resolveClientPrice(i.product, posCustomerId, posSpecialPrices),
          };
        }
        const unit = i.product.units?.find((u) => u.id === Number(unitIdValue));
        if (!unit) return i;
        return {
          ...i,
          unitId: unit.id,
          unitName: unit.unitName,
          conversionFactor: unit.conversionFactor,
          unitPrice: unit.price,
        };
      }),
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((i) => i.product.id !== productId));
  };

  // PIN Override Mechanism
  const triggerPinOverride = (reason: string, callback: (pin: string) => void) => {
    setOverrideModalReason(reason);
    setOverrideModalCallback(() => callback);
    setCheckoutOverridePin('');
    setShowOverrideModal(true);
  };

  const handleVerifyOverridePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/auth/manager-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: checkoutOverridePin, reason: overrideModalReason }),
      });
      if (r.status === 401) {
        handleLogout();
        triggerToast('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول', 'alert');
        return;
      }
      const res = await r.json();
      if (!r.ok) {
        triggerToast(res.message || 'رمز الموافقة غير صحيح', 'alert');
        return;
      }
      setShowOverrideModal(false);
      if (overrideModalCallback) {
        overrideModalCallback(checkoutOverridePin);
      }
    } catch {
      triggerToast('خطأ في الاتصال بالخادم', 'alert');
    }
  };

  // Submit Sale Checkout
  const handleCheckout = async () => {
    if (!activeShift) {
      triggerToast('يرجى فتح التوكة أولاً لتسجيل المبيعات', 'alert');
      return;
    }

    if (posPaymentType === 'credit' && !posCustomerId) {
      triggerToast('يرجى اختيار العميل أولاً لتسجيل فاتورة بيع آجل (دين)', 'alert');
      return;
    }

    const discountMillis = parseLYDOrZero(posDiscount);
    const cartItems = cart.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      unitId: i.unitId,
      serialNumber: i.serialNumber,
    }));

    // If discount exceeds the configured cap, prompt for PIN override beforehand if not manager
    const capPercent = settingsData?.discountCapPercent ?? 10;
    let subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discountCap = Math.floor((subtotal * capPercent) / 100);
    if (discountMillis > discountCap && currentUser.role !== 'manager') {
      triggerPinOverride(
        `تجاوز نسبة الخصم المسموحة (${capPercent}%): خصم بقيمة ${posDiscount} د.ل`,
        async (pin) => {
          submitCheckoutApi(cartItems, discountMillis, pin);
        },
      );
    } else {
      submitCheckoutApi(cartItems, discountMillis);
    }
  };

  const submitCheckoutApi = async (cartItems: any[], discountMillis: number, pin?: string) => {
    const selectedCustomer = customersList.find((c) => c.id === posCustomerId);
    const payload = {
      items: cartItems,
      discount: discountMillis,
      paymentType: posPaymentType,
      paymentMethod: posPaymentMethod,
      customerId: posCustomerId || undefined,
      customerName: selectedCustomer?.name,
      overridePin: pin,
      quotationId: posQuotationId || undefined,
      depositId: posDepositId || undefined,
    };

    const res = await apiCall('/api/sales', 'POST', payload);
    if (res.success) {
      triggerToast(`تم تسجيل الفاتورة بنجاح: ${res.data.invoiceNumber}`);
      setCart([]);
      setPosDiscount('0');
      setPosCustomerId(null);
      setPosPaymentType('cash');
      setPosQuotationId(null);
      setPosDepositId(null);

      // Load detailed invoice and show printing overlay
      fetch(`/api/sales/${res.data.id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => {
          if (r.status === 401) {
            handleLogout();
            throw new Error('Unauthorized');
          }
          return r.ok ? r.json() : null;
        })
        .then((invoice) => {
          if (invoice) {
            setPrintingSale(invoice);
            setShowPrintModal(true);
          }
        })
        .catch(() => {});

      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إتمام العملية', 'alert');
    }
  };

  // Open the print preview for an existing invoice. Always fetch the full
  // sale first — list rows have no items, and printing them would produce an
  // empty invoice.
  const openInvoicePrint = async (sale: Sale) => {
    const res = await apiCall(`/api/sales/${sale.id}`);
    if (!res.success) {
      triggerToast(res.error || 'فشل جلب تفاصيل الفاتورة', 'alert');
      return;
    }
    setPrintingSale(res.data);
    setShowPrintModal(true);
  };

  // Cancel/Refund Invoice
  const handleCancelInvoice = (sale: Sale) => {
    const action = () => {
      triggerPinOverride(
        `إلغاء الفاتورة ${sale.invoiceNumber} بقيمة ${formatLYD(sale.total)} د.ل`,
        async (pin) => {
          const res = await apiCall(`/api/sales/${sale.id}/cancel`, 'POST', { overridePin: pin });
          if (res.success) {
            triggerToast('تم إلغاء الفاتورة وإرجاع الكميات للمخزون بنجاح');
            refreshAllData();
          } else {
            triggerToast(res.error || 'فشل إلغاء الفاتورة', 'alert');
          }
        },
      );
    };

    if (currentUser.role !== 'manager') {
      action();
    } else {
      // Direct execute if manager (or ask for simple validation)
      triggerPinOverride(`تأكيد إلغاء الفاتورة ${sale.invoiceNumber}`, async (pin) => {
        const res = await apiCall(`/api/sales/${sale.id}/cancel`, 'POST', { overridePin: pin });
        if (res.success) {
          triggerToast('تم إلغاء الفاتورة بنجاح');
          refreshAllData();
        } else {
          triggerToast(res.error || 'فشل إلغاء الفاتورة', 'alert');
        }
      });
    }
  };

  // Excel (CSV) Export Utility
  const handleExportCSV = (type: 'sales' | 'products' | 'shifts') => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (type === 'sales') {
      headers = [
        'رقم الفاتورة',
        'تاريخ البيع',
        'المسؤول',
        'طريقة الدفع',
        'حالة الفاتورة',
        'الخصم (د.ل)',
        'الضريبة (د.ل)',
        'الإجمالي (د.ل)',
      ];
      rows = salesList.map((s) => [
        s.invoiceNumber,
        new Date(s.createdAt).toLocaleString('ar-LY'),
        s.username,
        s.paymentMethod === 'cash'
          ? 'كاش'
          : s.paymentMethod === 'card'
            ? 'بطاقة مصرفية'
            : 'حوالة مصرفية',
        s.status === 'completed' ? 'مدفوعة' : 'ملغاة',
        formatLYD(s.discount),
        formatLYD(s.taxAmount),
        formatLYD(s.total),
      ]);
    } else if (type === 'products') {
      headers = [
        'اسم المنتج',
        'النوع',
        'القسم',
        'الوحدة الأساسية',
        'سعر الشراء',
        'سعر التجزئة',
        'سعر الجملة',
        'الكمية المتاحة',
        'حد إعادة الطلب',
      ];
      rows = productsList.map((p) => [
        p.name,
        p.type === 'equipment' ? 'معدة/جهاز' : 'استهلاكي',
        p.category,
        p.baseUnit,
        formatLYD(p.costPrice),
        formatLYD(p.retailPrice),
        formatLYD(p.wholesalePrice),
        p.quantity.toString(),
        p.reorderPoint.toString(),
      ]);
    } else if (type === 'shifts') {
      headers = [
        'رقم التوكة',
        'المسؤول عن الفتح',
        'تاريخ الافتتاح',
        'رصيد الفتح (د.ل)',
        'الرصيد المتوقع (د.ل)',
        'الرصيد الفعلي (د.ل)',
        'الفارق (عجز/زيادة)',
        'الحالة',
      ];
      rows = shiftsList.map((s) => [
        `#${s.id}`,
        s.openedByUsername || '—',
        new Date(s.openedAt).toLocaleString('ar-LY'),
        formatLYD(s.openingCash),
        formatLYD(s.expectedCash),
        s.actualCash ? formatLYD(s.actualCash) : '—',
        s.variance !== undefined ? `${formatLYD(s.variance)} د.ل` : '—',
        s.status === 'open' ? 'نشطة حالياً' : 'مغلقة',
      ]);
    }

    // Helper to format values safely with quotes to handle commas inside text
    const formatCSVRow = (arr: string[]) =>
      arr.map((val) => `"${val.replace(/"/g, '""')}"`).join(',');

    const csvContent =
      '\uFEFF' + [formatCSVRow(headers), ...rows.map((r) => formatCSVRow(r))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `تقرير_${type === 'sales' ? 'المبيعات' : type === 'products' ? 'المنتجات' : 'التوكات'}_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('تم تصدير ملف الاكسيل (CSV) بنجاح');
  };

  // Product CRUD Operations
  const openNewProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      type: 'consumable',
      category: '',
      baseUnit: 'piece',
      barcode: '',
      costPrice: '0.000',
      retailPrice: '0.000',
      wholesalePrice: '0.000',
      quantity: '0',
      reorderPoint: '0',
      serialNumber: '',
      warrantyMonths: '0',
      batchNo: '',
      expiryDate: '',
      taxExempt: false,
    });
    setProductUnitsForm([]);
    setProductComponentsForm([]);
    setProductImageFile(null);
    setShowProductModal(true);
  };

  const uploadProductImage = async (productId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch(`/api/products/${productId}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      triggerToast(data.message || 'فشل رفع صورة المنتج', 'alert');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const costPrice = parseLYDOrZero(productForm.costPrice);
    const retailPrice = parseLYDOrZero(productForm.retailPrice);
    const wholesalePrice = parseLYDOrZero(productForm.wholesalePrice);

    const payload = {
      ...productForm,
      costPrice,
      retailPrice,
      wholesalePrice,
      quantity: Number(productForm.quantity),
      reorderPoint: Number(productForm.reorderPoint),
      warrantyMonths: Number(productForm.warrantyMonths),
    };

    let url = '/api/products';
    let method = 'POST';
    if (editingProduct) {
      url = `/api/products/${editingProduct.id}`;
      method = 'PUT';
    }

    const res = await apiCall(url, method, payload);
    if (res.success) {
      const productId = editingProduct ? editingProduct.id : res.data?.id;
      if (productImageFile && productId) {
        await uploadProductImage(productId, productImageFile);
      }
      // Persist packaging units (manager only; replace-all)
      if (productId && currentUser?.role === 'manager') {
        const units = productUnitsForm
          .filter((u) => u.unitName.trim() !== '')
          .map((u) => ({
            unitName: u.unitName.trim(),
            conversionFactor: Number(u.conversionFactor),
            price: parseLYDOrZero(u.price),
          }));
        const unitsRes = await apiCall(`/api/products/${productId}/units`, 'PUT', { units });
        if (!unitsRes.success) {
          triggerToast(unitsRes.error || 'فشل حفظ وحدات التعبئة', 'alert');
        }
        const components = productComponentsForm
          .filter((c) => c.componentProductId !== '')
          .map((c) => ({
            componentProductId: Number(c.componentProductId),
            quantity: Number(c.quantity),
          }));
        const compRes = await apiCall(`/api/products/${productId}/components`, 'PUT', {
          components,
        });
        if (!compRes.success) {
          triggerToast(compRes.error || 'فشل حفظ مكونات الباقة', 'alert');
        }
      }
      triggerToast(editingProduct ? 'تم تعديل المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
      setShowProductModal(false);
      setEditingProduct(null);
      setProductImageFile(null);
      setProductUnitsForm([]);
      setProductComponentsForm([]);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل حفظ المنتج', 'alert');
    }
  };

  const startEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      type: p.type,
      category: p.category,
      baseUnit: p.baseUnit,
      barcode: p.barcode || '',
      costPrice: (p.costPrice / 1000).toFixed(3),
      retailPrice: (p.retailPrice / 1000).toFixed(3),
      wholesalePrice: (p.wholesalePrice / 1000).toFixed(3),
      quantity: p.quantity.toString(),
      reorderPoint: p.reorderPoint.toString(),
      serialNumber: p.serialNumber || '',
      warrantyMonths: (p.warrantyMonths || 0).toString(),
      batchNo: p.batchNo || '',
      expiryDate: p.expiryDate || '',
      taxExempt: Boolean(p.taxExempt),
    });
    setProductUnitsForm(
      (p.units || []).map((u) => ({
        unitName: u.unitName,
        conversionFactor: String(u.conversionFactor),
        price: (u.price / 1000).toFixed(3),
      })),
    );
    setProductComponentsForm(
      (p.components || []).map((c) => ({
        componentProductId: String(c.componentProductId),
        quantity: String(c.quantity),
      })),
    );
    setProductImageFile(null);
    setShowProductModal(true);
  };

  // Stock Adjustment Operation
  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const qty = Number(adjustForm.quantity);
    const res = await apiCall(`/api/products/${adjustingProduct.id}/adjust`, 'POST', {
      adjustmentQuantity: qty,
      reason: adjustForm.reason,
    });

    if (res.success) {
      triggerToast('تم تسجيل حركة تسوية المخزون');
      setShowAdjustModal(false);
      setAdjustingProduct(null);
      setAdjustForm({ quantity: '0', reason: '' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسوية المخزون', 'alert');
    }
  };

  // Open Shift
  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseLYDOrZero(openShiftForm.openingCash);
    const res = await apiCall('/api/shifts/open', 'POST', { openingCash: cash });
    if (res.success) {
      triggerToast('تم فتح التوكة وبدء التشغيل الفعلي للخزينة');
      setShowOpenShiftModal(false);
      setOpenShiftForm({ openingCash: '0.000' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل فتح التوكة', 'alert');
    }
  };

  // Close Shift
  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseLYDOrZero(closeShiftForm.actualCash);
    const res = await apiCall('/api/shifts/close', 'POST', { actualCash: cash });
    if (res.success) {
      const closedShift = res.data;
      // Build shift summary for modal
      const shiftSales = salesList.filter(
        (s) => s.shiftId === activeShift?.id && s.status === 'completed',
      );
      const shiftExpenses = expensesList.filter((e) => e.shiftId === activeShift?.id);
      const cashSales = shiftSales
        .filter((s) => s.paymentMethod === 'cash')
        .reduce((sum, s) => sum + s.total, 0);
      const cardSales = shiftSales
        .filter((s) => s.paymentMethod === 'card')
        .reduce((sum, s) => sum + s.total, 0);
      const transferSales = shiftSales
        .filter((s) => s.paymentMethod === 'transfer')
        .reduce((sum, s) => sum + s.total, 0);
      const totalExpenses = shiftExpenses.reduce((sum, e) => sum + e.amount, 0);
      setShiftCloseSummary({
        invoiceCount: shiftSales.length,
        cashSales,
        cardSales,
        transferSales,
        totalSales: shiftSales.reduce((sum, s) => sum + s.total, 0),
        totalExpenses,
        openingCash: activeShift?.openingCash ?? 0,
        expectedCash: closedShift.expectedCash ?? 0,
        actualCash: cash,
        variance: closedShift.variance ?? 0,
      });
      setShowCloseShiftModal(false);
      setCloseShiftForm({ actualCash: '0.000' });
      setShowShiftSummaryModal(true);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إغلاق التوكة', 'alert');
    }
  };

  // Record Expense
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseLYDOrZero(expenseForm.amount);
    const res = await apiCall('/api/expenses', 'POST', {
      amount,
      reason: expenseForm.reason,
      category: expenseForm.category,
    });
    if (res.success) {
      triggerToast('تم تسجيل المصروف النقدي من الخزينة بنجاح');
      setShowExpenseModal(false);
      setExpenseForm({ amount: '0.000', reason: '', category: 'supplies' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسجيل المصروف', 'alert');
    }
  };

  // Customer Handlers
  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingCustomer ? 'PUT' : 'POST';
    const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
    const res = await apiCall(url, method, {
      ...customerForm,
      creditLimit: parseLYDOrZero(customerForm.creditLimit),
    });
    if (res.success) {
      triggerToast(editingCustomer ? 'تم تعديل بيانات العميل' : 'تم إضافة العميل بنجاح');
      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerForm({
        name: '',
        phone: '',
        address: '',
        notes: '',
        tier: 'retail',
        creditLimit: '0.000',
      });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل حفظ بيانات العميل', 'alert');
    }
  };

  const handleCustomerPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer) return;
    const amount = parseLYDOrZero(customerPaymentAmount);
    const res = await apiCall(`/api/customers/${payingCustomer.id}/payment`, 'POST', { amount });
    if (res.success) {
      triggerToast(`تم تسجيل سداد ${customerPaymentAmount} د.ل من ${payingCustomer.name}`);
      setShowCustomerPaymentModal(false);
      setPayingCustomer(null);
      setCustomerPaymentAmount('0.000');
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسجيل السداد', 'alert');
    }
  };

  // ── Special prices (per customer, manager only) ──
  const fetchSpecialPrices = async (customerId: number): Promise<SpecialPrice[]> => {
    const res = await apiCall(`/api/customers/${customerId}/special-prices`);
    return res.success ? res.data : [];
  };

  const openSpecialPrices = async (c: Customer) => {
    setSpecialPricesCustomer(c);
    setSpecialPriceForm({ productId: '', price: '0.000' });
    setSpecialPricesList(await fetchSpecialPrices(c.id));
    setShowSpecialPricesModal(true);
  };

  const handleSpecialPriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialPricesCustomer || !specialPriceForm.productId) return;
    const res = await apiCall(`/api/customers/${specialPricesCustomer.id}/special-prices`, 'PUT', {
      productId: Number(specialPriceForm.productId),
      price: parseLYDOrZero(specialPriceForm.price),
    });
    if (res.success) {
      triggerToast('تم حفظ السعر الخاص');
      setSpecialPriceForm({ productId: '', price: '0.000' });
      setSpecialPricesList(await fetchSpecialPrices(specialPricesCustomer.id));
    } else {
      triggerToast(res.error || 'فشل حفظ السعر الخاص', 'alert');
    }
  };

  const handleSpecialPriceDelete = async (productId: number) => {
    if (!specialPricesCustomer) return;
    const res = await apiCall(
      `/api/customers/${specialPricesCustomer.id}/special-prices/${productId}`,
      'DELETE',
    );
    if (res.success) {
      triggerToast('تم حذف السعر الخاص');
      setSpecialPricesList(await fetchSpecialPrices(specialPricesCustomer.id));
    } else {
      triggerToast(res.error || 'فشل حذف السعر الخاص', 'alert');
    }
  };

  // Client-side mirror of the server's pricing precedence:
  // special price → wholesale tier price (when set) → retail price.
  const resolveClientPrice = (
    product: Product,
    customerId: number | null,
    specials: Map<number, number>,
  ): number => {
    if (customerId) {
      const special = specials.get(product.id);
      if (special !== undefined) return special;
      const customer = customersList.find((c) => c.id === customerId);
      if (customer?.tier === 'wholesale' && product.wholesalePrice > 0) {
        return product.wholesalePrice;
      }
    }
    return product.retailPrice;
  };

  // When the POS customer changes, load their special prices and re-price the cart.
  useEffect(() => {
    let cancelled = false;
    const applyPricing = async () => {
      let specials = new Map<number, number>();
      if (posCustomerId) {
        const list = await fetchSpecialPrices(posCustomerId);
        specials = new Map(list.map((sp) => [sp.productId, sp.price]));
      }
      if (cancelled) return;
      setPosSpecialPrices(specials);
      // Deposits belong to a specific customer — deselect on change.
      setPosDepositId(null);
      // Re-price base-unit lines only; packaging units keep their own price.
      setCart((prev) =>
        prev.map((item) =>
          item.unitId
            ? item
            : { ...item, unitPrice: resolveClientPrice(item.product, posCustomerId, specials) },
        ),
      );
    };
    applyPricing();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posCustomerId]);

  // Fetch & Open Customer Account Statement
  const openCustomerStatement = async (c: Customer) => {
    setStatementCustomer(c);
    setStatementLoading(true);
    setShowCustomerStatementModal(true);
    setStatementFilterStart('');
    setStatementFilterEnd('');
    try {
      const res = await apiCall(`/api/customers/${c.id}/statement`, 'GET');
      if (res && res.success && res.data) {
        setStatementData(res.data);
      }
    } catch (e) {
      console.error(e);
      triggerToast('فشل جلب كشف حساب العميل', 'alert');
    } finally {
      setStatementLoading(false);
    }
  };

  // Supplier Handlers
  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingSupplier ? 'PUT' : 'POST';
    const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
    const res = await apiCall(url, method, supplierForm);
    if (res.success) {
      triggerToast(editingSupplier ? 'تم تعديل بيانات المورد' : 'تم إضافة المورد بنجاح');
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({ name: '', phone: '', address: '', notes: '' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل حفظ بيانات المورد', 'alert');
    }
  };

  // Purchase Handler
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = purchaseForm.items
      .filter((i) => i.productId && Number(i.quantity) > 0)
      .map((i) => ({
        productId: Number(i.productId),
        quantity: Number(i.quantity),
        unitCost: parseLYDOrZero(i.unitCost),
      }));
    if (items.length === 0) {
      triggerToast('يجب إضافة منتج واحد على الأقل', 'alert');
      return;
    }
    const payload = {
      supplierId: purchaseForm.supplierId ? Number(purchaseForm.supplierId) : undefined,
      supplierName: purchaseForm.supplierName || undefined,
      items,
      paid: parseLYDOrZero(purchaseForm.paid),
      notes: purchaseForm.notes || undefined,
    };
    const res = await apiCall('/api/purchases', 'POST', payload);
    if (res.success) {
      triggerToast(`تم تسجيل فاتورة المشتريات: ${res.data.invoiceNumber}`);
      setShowPurchaseModal(false);
      setPurchaseForm({
        supplierId: '',
        supplierName: '',
        items: [{ productId: '', quantity: '1', unitCost: '0.000' }],
        paid: '0.000',
        notes: '',
      });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسجيل المشتريات', 'alert');
    }
  };

  // ── Quotations ──
  const handleSaveQuotation = async () => {
    if (cart.length === 0) {
      triggerToast('السلة فارغة — أضف أصنافاً أولاً', 'alert');
      return;
    }
    const selectedCustomer = customersList.find((c) => c.id === posCustomerId);
    const res = await apiCall('/api/quotations', 'POST', {
      items: cart.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        unitId: i.unitId,
      })),
      discount: parseLYDOrZero(posDiscount),
      customerId: posCustomerId || undefined,
      customerName: selectedCustomer?.name,
    });
    if (res.success) {
      triggerToast(
        `تم حفظ عرض السعر ${res.data.quoteNumber} (صالح حتى ${res.data.validUntil}) — لم يتم خصم أي مخزون`,
      );
      setCart([]);
      setPosDiscount('0');
      setPosCustomerId(null);
      setPosQuotationId(null);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل حفظ عرض السعر', 'alert');
    }
  };

  const loadQuotationIntoPos = async (q: Quotation) => {
    const res = await apiCall(`/api/quotations/${q.id}`);
    if (!res.success) {
      triggerToast(res.error || 'فشل جلب عرض السعر', 'alert');
      return;
    }
    const detail: Quotation = res.data;
    const newCart: CartItem[] = [];
    for (const item of detail.items || []) {
      const product = productsList.find((p) => p.id === item.productId);
      if (!product) {
        triggerToast(`المنتج "${item.productName}" لم يعد موجوداً — لا يمكن تحويل العرض`, 'alert');
        return;
      }
      if (item.unitId && !product.units?.some((u) => u.id === item.unitId)) {
        triggerToast(
          `وحدة التعبئة "${item.unitName}" للمنتج "${item.productName}" لم تعد موجودة — لا يمكن تحويل العرض`,
          'alert',
        );
        return;
      }
      newCart.push({
        product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitId: item.unitId ?? undefined,
        unitName: item.unitName ?? undefined,
        conversionFactor: item.conversionFactor ?? 1,
      });
    }
    setCart(newCart);
    setPosCustomerId(detail.customerId || null);
    setPosDiscount(detail.discount ? (detail.discount / 1000).toFixed(3) : '0');
    setPosQuotationId(detail.id);
    setActiveTab('POS');
    triggerToast(`تم تحميل عرض السعر ${detail.quoteNumber} في نقطة البيع — أكمل الدفع لتحويله`);
  };

  const handleCancelQuotation = async (q: Quotation) => {
    const res = await apiCall(`/api/quotations/${q.id}/cancel`, 'POST', {});
    if (res.success) {
      triggerToast(`تم إلغاء عرض السعر ${q.quoteNumber}`);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إلغاء عرض السعر', 'alert');
    }
  };

  // ── Deposits (عربون) ──
  const openDepositModal = (c: Customer) => {
    setDepositCustomer(c);
    setDepositForm({ amount: '0.000', productId: '', notes: '' });
    setShowDepositModal(true);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositCustomer) return;
    const res = await apiCall('/api/deposits', 'POST', {
      customerId: depositCustomer.id,
      productId: depositForm.productId ? Number(depositForm.productId) : undefined,
      amount: parseLYDOrZero(depositForm.amount),
      notes: depositForm.notes || undefined,
    });
    if (res.success) {
      triggerToast(`تم استلام العربون من ${depositCustomer.name} وتسجيله في الدرج`);
      setShowDepositModal(false);
      setDepositCustomer(null);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسجيل العربون', 'alert');
    }
  };

  const handleDepositAction = async (d: Deposit, action: 'refund' | 'forfeit') => {
    const res = await apiCall(`/api/deposits/${d.id}/${action}`, 'POST', {});
    if (res.success) {
      triggerToast(action === 'refund' ? 'تم استرداد العربون نقداً' : 'تمت مصادرة العربون');
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشلت العملية', 'alert');
    }
  };

  // Supplier return flow
  const openPurchaseReturn = async (purchaseId: number) => {
    const res = await apiCall(`/api/purchases/${purchaseId}`);
    if (!res.success) {
      triggerToast(res.error || 'فشل جلب تفاصيل فاتورة الشراء', 'alert');
      return;
    }
    setReturnPurchase(res.data);
    setReturnQuantities({});
    setReturnRefundMethod(res.data.supplierId ? 'debt' : 'cash');
    setShowReturnModal(true);
  };

  const handlePurchaseReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnPurchase) return;
    const items = Object.entries(returnQuantities)
      .map(([productId, qty]) => ({ productId: Number(productId), quantity: Number(qty) }))
      .filter((i) => i.quantity > 0);
    if (items.length === 0) {
      triggerToast('حدد كمية مرتجعة لصنف واحد على الأقل', 'alert');
      return;
    }
    const res = await apiCall(`/api/purchases/${returnPurchase.id}/return`, 'POST', {
      items,
      refundMethod: returnRefundMethod,
    });
    if (res.success) {
      triggerToast(
        `تم تسجيل المرتجع بقيمة ${formatLYD(res.data.returnValue)} د.ل (${returnRefundMethod === 'debt' ? 'خصم من دين المورد' : 'استرداد نقدي'})`,
      );
      setShowReturnModal(false);
      setReturnPurchase(null);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسجيل المرتجع', 'alert');
    }
  };

  // View Stock Movements for a product
  const handleViewMovements = async (product: Product) => {
    setMovementsProduct(product);
    setStockMovementsForProduct([]);
    setShowMovementsModal(true);
    const r = await fetch(`/api/products/${product.id}/movements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const data = await r.json();
      setStockMovementsForProduct(data);
    }
  };

  // Barcode scan sound
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      /* ignore */
    }
  };

  // Backup Trigger
  const triggerManualBackup = async () => {
    const res = await apiCall('/api/backup', 'POST', {});
    if (res.success) {
      triggerToast(`تم إنشاء النسخة الاحتياطية بنجاح: ${res.data.filename}`);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إنشاء النسخة الاحتياطية', 'alert');
    }
  };

  const handleRestoreDb = async (filename: string) => {
    if (
      !confirm(
        `هل أنت متأكد من استرجاع البيانات للملف ${filename}؟ سيتم استبدال كامل البيانات الحالية بقاعدة البيانات المحددة.`,
      )
    )
      return;
    const res = await apiCall('/api/backup/restore', 'POST', { filename });
    if (res.success) {
      triggerToast('تمت استعادة قاعدة البيانات وجارٍ إعادة تحميل التطبيق...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      triggerToast(res.error || 'فشل استرجاع البيانات', 'alert');
    }
  };

  // Filter Products for POS Grid
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

  // Calculate POS running totals
  const cartSubtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountMillis = parseLYDOrZero(posDiscount);
  const isTaxEnabled = settingsData?.taxEnabled ?? false;
  const taxRatePermille = settingsData?.taxRatePermille ?? 0;
  const cartTax = isTaxEnabled
    ? Math.round(((cartSubtotal - discountMillis) * taxRatePermille) / 1000)
    : 0;
  const cartTotal = cartSubtotal + cartTax - discountMillis;

  // ── Invoice printing ──
  // Generate the invoice QR and reset per-print overrides whenever a new
  // invoice enters the print preview.
  useEffect(() => {
    if (!printingSale) {
      setQrDataUrl(null);
      return;
    }
    setOverrideCustomerName(printingSale.customerName || '');
    setOverrideWarrantyNotes('');
    setOverrideStampTitle('');
    setShowInvoiceControls(false);
    QRCode.toDataURL(
      `${printingSale.invoiceNumber} | ${formatLYD(printingSale.total)} LYD | ${printingSale.createdAt}`,
      { margin: 0, width: 160 },
    )
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [printingSale]);

  const paymentMethodLabel = (m: Sale['paymentMethod']) =>
    m === 'cash' ? 'كاش' : m === 'card' ? 'بطاقة مصرفية' : 'حوالة مصرفية';

  // Quotation QR mirrors the invoice QR
  useEffect(() => {
    if (!printingQuotation) {
      setQuotationQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(
      `${printingQuotation.quoteNumber} | ${formatLYD(printingQuotation.total)} LYD | صالح حتى ${printingQuotation.validUntil}`,
      { margin: 0, width: 160 },
    )
      .then(setQuotationQrDataUrl)
      .catch(() => setQuotationQrDataUrl(null));
  }, [printingQuotation]);

  // Open the A4 view/print preview for a quotation (fetches its items)
  const openQuotationPrint = async (q: Quotation) => {
    const res = await apiCall(`/api/quotations/${q.id}`);
    if (!res.success) {
      triggerToast(res.error || 'فشل جلب تفاصيل عرض السعر', 'alert');
      return;
    }
    setPrintingQuotation(res.data);
    setShowQuotationPrintModal(true);
  };

  const quotationStatusLabel = (s: Quotation['status']) =>
    s === 'active'
      ? 'نشط'
      : s === 'converted'
        ? 'تم تحويله لفاتورة'
        : s === 'expired'
          ? 'منتهي الصلاحية'
          : 'ملغى';

  // A4 quotation document (عرض سعر): branded, non-binding, with validity
  const renderQuotationA4 = () => {
    if (!printingQuotation) return null;
    const quotationSubtotal =
      printingQuotation.total - printingQuotation.taxAmount + printingQuotation.discount;
    return (
      <div className="a4-page bg-white text-black p-6" dir="rtl">
        {/* Branded header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
          <div>
            <h1 className="text-xl font-extrabold font-display">
              {settingsData?.businessName ?? ''}
            </h1>
            {settingsData?.businessSubtitle && (
              <p className="text-[11px] font-semibold mt-0.5">{settingsData.businessSubtitle}</p>
            )}
            <p className="text-[11px] mt-1">
              هاتف: <span className="mono">{settingsData?.businessPhone || '—'}</span>
              {settingsData?.businessPhone2 ? (
                <>
                  {' / '}
                  <span className="mono">{settingsData.businessPhone2}</span>
                </>
              ) : null}
            </p>
            {settingsData?.businessAddress && (
              <p className="text-[11px]">{settingsData.businessAddress}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {quotationQrDataUrl && <img src={quotationQrDataUrl} alt="QR" className="w-20 h-20" />}
            <span className="mono text-xs font-bold">{printingQuotation.quoteNumber}</span>
          </div>
        </div>

        {/* Document title */}
        <div className="text-center mb-3">
          <span className="inline-block border-2 border-black rounded px-6 py-1 text-base font-extrabold font-display">
            عرض سعر
          </span>
          <p className="text-[10px] mt-1">
            عرض غير ملزم — الأسعار سارية حتى{' '}
            <span className="mono font-bold">{printingQuotation.validUntil}</span>
          </p>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mb-3">
          <div>
            <span className="font-bold">التاريخ: </span>
            <span className="mono">
              {new Date(printingQuotation.createdAt).toLocaleString('ar-LY')}
            </span>
          </div>
          <div>
            <span className="font-bold">الحالة: </span>
            {quotationStatusLabel(printingQuotation.status)}
          </div>
          <div>
            <span className="font-bold">العميل: </span>
            {printingQuotation.customerName || 'زبون نقدي'}
          </div>
          <div>
            <span className="font-bold">أعده: </span>
            {printingQuotation.username || '—'}
          </div>
        </div>

        {/* Items */}
        <table className="w-full text-right text-[11px] mb-3 border border-black/60">
          <thead>
            <tr className="border-b border-black/60 bg-black/5 font-bold">
              <th className="p-1.5 w-6">#</th>
              <th className="p-1.5">البيان</th>
              <th className="p-1.5 text-center">الوحدة</th>
              <th className="p-1.5 text-center">الكمية</th>
              <th className="p-1.5 text-left">سعر الوحدة</th>
              <th className="p-1.5 text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {printingQuotation.items?.map((item, idx) => (
              <tr key={item.id} className="border-b border-black/20 align-top">
                <td className="p-1.5 mono">{idx + 1}</td>
                <td className="p-1.5 font-semibold">{item.productName}</td>
                <td className="p-1.5 text-center">{item.unitName || '—'}</td>
                <td className="p-1.5 text-center mono">{item.quantity}</td>
                <td className="p-1.5 text-left mono">{formatLYD(item.unitPrice)}</td>
                <td className="p-1.5 text-left mono font-bold">{formatLYD(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + Tafqeet */}
        <div className="flex justify-between items-start gap-6 mb-3">
          <div className="flex-1 text-[11px] border border-black/40 rounded p-2">
            <span className="font-bold">الإجمالي كتابةً: </span>
            {tafqeetLYD(printingQuotation.total)}
          </div>
          <div className="text-[11px] flex flex-col gap-1 items-end min-w-[190px]">
            <div className="flex justify-between w-full gap-6">
              <span>الإجمالي الفرعي:</span>
              <span className="mono">{formatLYD(quotationSubtotal)}</span>
            </div>
            {printingQuotation.discount > 0 && (
              <div className="flex justify-between w-full gap-6">
                <span>الخصم:</span>
                <span className="mono">-{formatLYD(printingQuotation.discount)}</span>
              </div>
            )}
            {printingQuotation.taxAmount > 0 && (
              <div className="flex justify-between w-full gap-6">
                <span>الضريبة:</span>
                <span className="mono">{formatLYD(printingQuotation.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between w-full gap-6 font-extrabold text-[13px] border-t border-black pt-1">
              <span>الإجمالي النهائي:</span>
              <span className="mono">{formatLYD(printingQuotation.total)} د.ل</span>
            </div>
          </div>
        </div>

        {printingQuotation.notes && (
          <div className="text-[10px] border border-black/40 rounded p-2 mb-3 whitespace-pre-line">
            <span className="font-bold block mb-0.5">ملاحظات:</span>
            {printingQuotation.notes}
          </div>
        )}

        <p className="text-[10px] text-black/70 mb-4">
          هذا العرض لا يخصم أي مخزون ولا يشكل التزاماً بالبيع؛ يصبح فاتورة نهائية عند تأكيده داخل
          نقطة البيع قبل انتهاء صلاحيته.
        </p>

        {/* Signatures */}
        <div className="flex justify-between items-end mt-6 text-[11px]">
          <div className="text-center">
            <div className="border-t border-black/60 pt-1 px-8">اعتماد العميل</div>
          </div>
          <div className="text-center">
            <div className="border-t border-black/60 pt-1 px-8">
              {settingsData?.stampTitle || settingsData?.businessName || ''}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Full A4 invoice (equipment-aware: serials, warranty terms, stamp, Tafqeet)
  const renderA4Invoice = () => {
    if (!printingSale) return null;
    const customerName = overrideCustomerName || printingSale.customerName || '';
    const warrantyText = overrideWarrantyNotes || settingsData?.warrantyTerms || '';
    const hasEquipment = printingSale.items?.some((i) => i.productType === 'equipment') ?? false;
    const stampTitle =
      overrideStampTitle || settingsData?.stampTitle || settingsData?.businessName || '';
    return (
      <div className="a4-page bg-white text-black p-6" dir="rtl">
        {/* Branded header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
          <div>
            <h1 className="text-xl font-extrabold font-display">
              {settingsData?.businessName ?? ''}
            </h1>
            {settingsData?.businessSubtitle && (
              <p className="text-[11px] font-semibold mt-0.5">{settingsData.businessSubtitle}</p>
            )}
            <p className="text-[11px] mt-1">
              هاتف: <span className="mono">{settingsData?.businessPhone || '—'}</span>
              {settingsData?.businessPhone2 ? (
                <>
                  {' / '}
                  <span className="mono">{settingsData.businessPhone2}</span>
                </>
              ) : null}
            </p>
            {settingsData?.businessAddress && (
              <p className="text-[11px]">{settingsData.businessAddress}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-20 h-20" />}
            <span className="mono text-xs font-bold ltr">{printingSale.invoiceNumber}</span>
          </div>
        </div>

        {/* Invoice meta */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mb-3">
          <div>
            <span className="font-bold">التاريخ: </span>
            <span className="mono">{new Date(printingSale.createdAt).toLocaleString('ar-LY')}</span>
          </div>
          <div>
            <span className="font-bold">نوع الفاتورة: </span>
            {printingSale.paymentType === 'credit' ? 'بيع آجل (دين)' : 'بيع نقدي'} —{' '}
            {paymentMethodLabel(printingSale.paymentMethod)}
          </div>
          <div>
            <span className="font-bold">العميل: </span>
            {customerName || 'زبون نقدي'}
          </div>
          <div>
            <span className="font-bold">البائع: </span>
            {printingSale.username || '—'}
          </div>
        </div>

        {/* Items */}
        <table className="w-full text-right text-[11px] mb-3 border border-black/60">
          <thead>
            <tr className="border-b border-black/60 bg-black/5 font-bold">
              <th className="p-1.5 w-6">#</th>
              <th className="p-1.5">البيان</th>
              <th className="p-1.5 text-center">الوحدة</th>
              <th className="p-1.5 text-center">الكمية</th>
              <th className="p-1.5 text-left">سعر الوحدة</th>
              <th className="p-1.5 text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {printingSale.items?.map((item, idx) => (
              <tr key={item.id} className="border-b border-black/20 align-top">
                <td className="p-1.5 mono">{idx + 1}</td>
                <td className="p-1.5 font-semibold">
                  {item.productName}
                  {item.serialNumber && (
                    <div className="text-[10px] font-normal mono">S/N: {item.serialNumber}</div>
                  )}
                </td>
                <td className="p-1.5 text-center">{item.unitName || item.baseUnit || '—'}</td>
                <td className="p-1.5 text-center mono">{item.quantity}</td>
                <td className="p-1.5 text-left mono">{formatLYD(item.unitPrice)}</td>
                <td className="p-1.5 text-left mono font-bold">{formatLYD(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals + Tafqeet */}
        <div className="flex justify-between items-start gap-6 mb-3">
          <div className="flex-1 text-[11px] border border-black/40 rounded p-2">
            <span className="font-bold">المبلغ كتابةً: </span>
            {tafqeetLYD(printingSale.total)}
          </div>
          <div className="text-[11px] flex flex-col gap-1 items-end min-w-[190px]">
            <div className="flex justify-between w-full gap-6">
              <span>الإجمالي الفرعي:</span>
              <span className="mono">
                {formatLYD(printingSale.total - printingSale.taxAmount + printingSale.discount)}
              </span>
            </div>
            {printingSale.discount > 0 && (
              <div className="flex justify-between w-full gap-6">
                <span>الخصم:</span>
                <span className="mono">-{formatLYD(printingSale.discount)}</span>
              </div>
            )}
            {printingSale.taxAmount > 0 && (
              <div className="flex justify-between w-full gap-6">
                <span>الضريبة:</span>
                <span className="mono">{formatLYD(printingSale.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between w-full gap-6 font-extrabold text-[13px] border-t border-black pt-1">
              <span>الإجمالي النهائي:</span>
              <span className="mono">{formatLYD(printingSale.total)} د.ل</span>
            </div>
          </div>
        </div>

        {/* Warranty terms (equipment invoices, or when overridden) */}
        {warrantyText && (hasEquipment || overrideWarrantyNotes) && (
          <div className="text-[10px] border border-black/40 rounded p-2 mb-3 whitespace-pre-line">
            <span className="font-bold block mb-0.5">شروط الضمان:</span>
            {warrantyText}
          </div>
        )}

        {/* Stamp + signatures */}
        <div className="flex justify-between items-end mt-6 text-[11px]">
          <div className="text-center">
            <div className="border-t border-black/60 pt-1 px-8">توقيع المستلم</div>
          </div>
          <div className="w-28 h-28 rounded-full border-[2.5px] border-black/50 flex items-center justify-center text-center text-[10px] font-bold rotate-[-6deg] opacity-70 p-3">
            {stampTitle}
          </div>
          <div className="text-center">
            <div className="border-t border-black/60 pt-1 px-8">توقيع البائع</div>
          </div>
        </div>
      </div>
    );
  };

  // Compact 80mm thermal receipt for quick sales
  const renderThermalReceipt = () => {
    if (!printingSale) return null;
    return (
      <div
        className="bg-white text-black mx-auto"
        dir="rtl"
        style={{ width: '72mm', fontSize: '11px', lineHeight: 1.5 }}
      >
        <div className="text-center border-b border-dashed border-black/60 pb-2 mb-2">
          <div className="font-extrabold text-[13px]">{settingsData?.businessName ?? ''}</div>
          {settingsData?.businessPhone && (
            <div>
              هاتف: <span className="mono">{settingsData.businessPhone}</span>
            </div>
          )}
        </div>
        <div className="flex justify-between mono text-[10px] mb-1">
          <span>{printingSale.invoiceNumber}</span>
          <span>{new Date(printingSale.createdAt).toLocaleString('ar-LY')}</span>
        </div>
        <div className="border-b border-dashed border-black/60 mb-1" />
        {printingSale.items?.map((item) => (
          <div key={item.id} className="mb-1">
            <div className="font-semibold">{item.productName}</div>
            <div className="flex justify-between mono text-[10px]">
              <span>
                {item.quantity}
                {item.unitName ? ` ${item.unitName}` : ''} × {formatLYD(item.unitPrice)}
              </span>
              <span>{formatLYD(item.total)}</span>
            </div>
          </div>
        ))}
        <div className="border-b border-dashed border-black/60 my-1" />
        {printingSale.discount > 0 && (
          <div className="flex justify-between">
            <span>الخصم</span>
            <span className="mono">-{formatLYD(printingSale.discount)}</span>
          </div>
        )}
        {printingSale.taxAmount > 0 && (
          <div className="flex justify-between">
            <span>الضريبة</span>
            <span className="mono">{formatLYD(printingSale.taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-[13px]">
          <span>الإجمالي</span>
          <span className="mono">{formatLYD(printingSale.total)} د.ل</span>
        </div>
        <div className="text-center mt-2 text-[10px]">
          {printingSale.paymentType === 'credit'
            ? `آجل — العميل: ${printingSale.customerName || ''}`
            : `الدفع: ${paymentMethodLabel(printingSale.paymentMethod)}`}
        </div>
        <div className="text-center mt-1 font-semibold">شكراً لتعاملكم معنا</div>
      </div>
    );
  };

  // Statement rows within the selected date range, plus the balance carried
  // forward from everything before the range.
  const statementView = (() => {
    const rows: any[] = statementData?.statement ?? [];
    const start = statementFilterStart;
    const end = statementFilterEnd;
    if (!start && !end) return { rows, opening: 0, hasOpening: false };
    let opening = 0;
    const inRange: any[] = [];
    for (const r of rows) {
      const day = String(r.date).slice(0, 10);
      if (start && day < start) {
        opening = r.runningBalance;
        continue;
      }
      if (end && day > end) continue;
      inRange.push(r);
    }
    return { rows: inRange, opening, hasOpening: Boolean(start) };
  })();

  // A4 customer statement of account (running balance ledger)
  const renderStatementA4 = () => {
    if (!statementCustomer || !statementData) return null;
    return (
      <div className="a4-page bg-white text-black p-6" dir="rtl">
        <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
          <div>
            <h1 className="text-xl font-extrabold font-display">
              {settingsData?.businessName ?? ''}
            </h1>
            {settingsData?.businessSubtitle && (
              <p className="text-[11px] font-semibold mt-0.5">{settingsData.businessSubtitle}</p>
            )}
            <p className="text-[11px] mt-1">
              هاتف: <span className="mono">{settingsData?.businessPhone || '—'}</span>
              {settingsData?.businessPhone2 ? (
                <>
                  {' / '}
                  <span className="mono">{settingsData.businessPhone2}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="text-left">
            <h2 className="font-extrabold text-base">كشف حساب عميل</h2>
            <p className="mono text-[10px]">{new Date().toLocaleString('ar-LY')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px] mb-3">
          <div>
            <span className="font-bold">العميل: </span>
            {statementCustomer.name}
          </div>
          <div>
            <span className="font-bold">الهاتف: </span>
            {statementCustomer.phone || '—'}
          </div>
          {(statementFilterStart || statementFilterEnd) && (
            <div className="col-span-2">
              <span className="font-bold">الفترة: </span>
              {statementFilterStart || 'البداية'} ← {statementFilterEnd || 'اليوم'}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-[11px] mb-3 text-center">
          <div className="border border-black/40 rounded p-2">
            <div className="font-bold">إجمالي المشتريات الآجلة</div>
            <div className="mono">{formatLYD(statementData.summary.totalPurchases)} د.ل</div>
          </div>
          <div className="border border-black/40 rounded p-2">
            <div className="font-bold">إجمالي المدفوع</div>
            <div className="mono">{formatLYD(statementData.summary.totalPaid)} د.ل</div>
          </div>
          <div className="border-2 border-black rounded p-2 font-extrabold">
            <div>الرصيد المستحق حالياً</div>
            <div className="mono">{formatLYD(statementData.summary.currentBalance)} د.ل</div>
          </div>
        </div>

        <table className="w-full text-right text-[10.5px] border border-black/60">
          <thead>
            <tr className="border-b border-black/60 bg-black/5 font-bold">
              <th className="p-1.5">التاريخ</th>
              <th className="p-1.5">البيان</th>
              <th className="p-1.5">المرجع</th>
              <th className="p-1.5 text-left">مدين (عليه)</th>
              <th className="p-1.5 text-left">دائن (له)</th>
              <th className="p-1.5 text-left">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {statementView.hasOpening && (
              <tr className="border-b border-black/20 bg-black/5 font-semibold">
                <td className="p-1.5" colSpan={5}>
                  رصيد سابق مُرحّل
                </td>
                <td className="p-1.5 text-left mono">{formatLYD(statementView.opening)}</td>
              </tr>
            )}
            {statementView.rows.map((row: any) => (
              <tr key={row.id} className="border-b border-black/20">
                <td className="p-1.5 mono">{String(row.date).slice(0, 10)}</td>
                <td className="p-1.5">{row.typeLabel}</td>
                <td className="p-1.5 mono">{row.reference}</td>
                <td className="p-1.5 text-left mono">{row.debit ? formatLYD(row.debit) : '—'}</td>
                <td className="p-1.5 text-left mono">{row.credit ? formatLYD(row.credit) : '—'}</td>
                <td className="p-1.5 text-left mono font-bold">{formatLYD(row.runningBalance)}</td>
              </tr>
            ))}
            {statementView.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center">
                  لا توجد حركات في هذه الفترة.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-between items-end mt-8 text-[11px]">
          <div className="text-center">
            <div className="border-t border-black/60 pt-1 px-8">توقيع العميل</div>
          </div>
          <div className="text-center">
            <div className="border-t border-black/60 pt-1 px-8">
              {settingsData?.stampTitle || settingsData?.businessName || ''}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Categories list derived from products
  const categories = [
    'ALL',
    ...Array.from(new Set(productsList.map((p) => p.category.toUpperCase()))),
  ];

  // Login view if not logged in or user data is missing
  if (!token || !currentUser) {
    return (
      <div className="flex min-h-dvh" dir="rtl">
        {/* Left decorative panel */}
        <div
          className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
          style={{ background: 'var(--gradient-warm)' }}
        >
          {/* Background pattern */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, var(--jade) 0, var(--jade) 1px, transparent 0, transparent 50%)`,
              backgroundSize: '24px 24px',
            }}
          />
          {/* Brand mark */}
          <div className="relative z-10">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl font-mono text-2xl font-black text-white mb-8"
              style={{ background: 'var(--gradient-jade)', boxShadow: 'var(--shadow-jade)' }}
            >
              POS
            </div>
            <h1
              className="text-4xl font-black leading-tight mb-4"
              style={{ color: '#F0EBE0', fontFamily: 'Cairo, sans-serif' }}
            >
              منظومة المبيعات
              <br />
              والمخزون
            </h1>
            <p className="text-base leading-relaxed" style={{ color: '#8C8070' }}>
              نظام متكامل لإدارة مستلزمات المقاهي والمطاعم —<br />
              مبيعات، مخزون، خزينة، وموردين في مكان واحد.
            </p>
          </div>

          {/* Stats decorative */}
          <div className="relative z-10 grid grid-cols-2 gap-4">
            {[
              { label: 'إدارة المخزون', icon: '📦' },
              { label: 'نقطة البيع', icon: '🧾' },
              { label: 'إدارة الموردين', icon: '🚚' },
              { label: 'تقارير مالية', icon: '📊' },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-3 rounded-xl p-3"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span className="text-xl">{f.icon}</span>
                <span className="text-xs font-bold" style={{ color: '#C8C0B0' }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="relative z-10 text-xs" style={{ color: '#4A4440' }}>
            © {new Date().getFullYear()} — نظام إدارة متكامل · نسخة محلية بدون إنترنت
          </div>
        </div>

        {/* Right form panel */}
        <div
          className="flex flex-1 items-center justify-center p-8"
          style={{ background: 'var(--bg)' }}
        >
          <div className="w-full max-w-[400px]">
            {/* Mobile logo */}
            <div className="lg:hidden flex justify-center mb-8">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl font-mono text-xl font-black text-white"
                style={{ background: 'var(--gradient-jade)', boxShadow: 'var(--shadow-jade)' }}
              >
                POS
              </div>
            </div>

            <div className="mb-8">
              <h2
                className="font-display text-2xl font-black mb-1.5"
                style={{ color: 'var(--text)' }}
              >
                مرحباً بك 👋
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                سجّل دخولك للبدء بإدارة المنظومة
              </p>
            </div>

            {/* Quick PIN shortcuts */}
            <div
              className="mb-6 rounded-2xl p-4"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>
                دخول سريع بالـ PIN
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handlePinSwitch('1111')}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:-translate-y-0.5"
                  style={{
                    background: 'var(--jade-glow)',
                    color: 'var(--jade)',
                    border: '1px solid color-mix(in srgb, var(--jade) 30%, transparent)',
                  }}
                >
                  🔐 المدير (١١١١)
                </button>
                <button
                  onClick={() => handlePinSwitch('2222')}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:-translate-y-0.5"
                  style={{
                    background: 'var(--copper-glow)',
                    color: 'var(--copper)',
                    border: '1px solid color-mix(in srgb, var(--copper) 30%, transparent)',
                  }}
                >
                  👤 الكاشير (٢٢٢٢)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                أو بالاسم وكلمة المرور
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label
                  className="mb-1.5 block text-sm font-bold"
                  style={{ color: 'var(--text)', fontFamily: 'Cairo, sans-serif' }}
                >
                  اسم المستخدم
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                  className="w-full h-12 rounded-xl px-4 text-sm transition-all focus-visible:outline-none"
                  style={{
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--jade)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--jade-glow)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-sm font-bold"
                  style={{ color: 'var(--text)', fontFamily: 'Cairo, sans-serif' }}
                >
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-12 rounded-xl px-4 text-sm transition-all focus-visible:outline-none"
                  style={{
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--jade)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--jade-glow)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {loginError && (
                <div
                  className="flex items-center gap-2 rounded-xl p-3 text-sm font-bold"
                  style={{
                    background: 'var(--alert-glow)',
                    color: 'var(--alert)',
                    border: '1px solid color-mix(in srgb, var(--alert) 30%, transparent)',
                  }}
                >
                  <span>⚠️</span> {loginError}
                </div>
              )}

              <button
                type="submit"
                className="mt-2 h-13 rounded-xl text-sm font-bold text-white transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                style={{ background: 'var(--gradient-jade)', boxShadow: 'var(--shadow-jade)' }}
              >
                تسجيل الدخول ←
              </button>
            </form>

            <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              نظام محلي · يعمل بدون إنترنت · {new Date().toLocaleDateString('ar-LY')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main Selection Grid View (Home)
  if (activeTab === 'Home') {
    const tabsList = [
      {
        id: 'Dashboard',
        label: 'لوحة التحكم',
        desc: 'إحصائيات المبيعات، الأرباح، وأداء المتجر اليومي والشهري',
        icon: Icons.Dashboard,
        managerOnly: true,
      },
      {
        id: 'POS',
        label: 'نقطة البيع (الكاشير)',
        desc: 'تسجيل المبيعات المباشرة وإصدار فواتير كاش وبطاقة',
        icon: Icons.POS,
        managerOnly: false,
      },
      {
        id: 'Products',
        label: 'المنتجات والمخازن',
        desc: 'إدارة جرد البضائع والمعدات ومتابعة حالة المخازن',
        icon: Icons.Products,
        managerOnly: false,
      },
      {
        id: 'Shifts',
        label: 'التوكات والخزينة',
        desc: 'متابعة التوكات، المبالغ المستلمة، وتسجيل المصروفات',
        icon: Icons.Shifts,
        managerOnly: false,
      },
      {
        id: 'Purchases',
        label: 'المشتريات والموردين',
        desc: 'تسجيل فواتير الشراء، استلام البضاعة، ومتابعة الموردين',
        icon: Icons.Truck,
        managerOnly: true,
      },
      {
        id: 'Customers',
        label: 'العملاء والذمم',
        desc: 'إدارة بيانات العملاء، متابعة الدين، وتسجيل المدفوعات',
        icon: Icons.Users,
        managerOnly: true,
      },
      {
        id: 'Reports',
        label: 'التقارير المالية',
        desc: 'سجل الفواتير وتفاصيل المبيعات والأرباح والضرائب',
        icon: Icons.Reports,
        managerOnly: true,
      },
      {
        id: 'Settings',
        label: 'الإعدادات العامة',
        desc: 'تهيئة اسم المحل، الهاتف، نسبة الضريبة، والنسخ الاحتياطية',
        icon: Icons.Settings,
        managerOnly: true,
      },
    ].filter((t) => !t.managerOnly || currentUser.role === 'manager');

    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-start py-10 px-6 sm:px-10 select-none overflow-y-auto"
        style={{ background: 'var(--bg)' }}
        dir="rtl"
      >
        <div className="w-full max-w-[1060px] flex flex-col gap-8">
          {/* Header */}
          <div
            className="flex justify-between items-center p-5 rounded-2xl"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl font-mono text-lg font-black text-white shadow-md flex-shrink-0"
                style={{ background: 'var(--gradient-jade)', boxShadow: 'var(--shadow-jade)' }}
              >
                POS
              </div>
              <div>
                <h1 className="font-display text-2xl font-black" style={{ color: 'var(--text)' }}>
                  {settingsData?.businessName ?? 'منظومة مستلزمات المقاهي والمطاعم'}
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  اختر القسم للبدء بالعمل
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-left">
                <div
                  className="text-xs mb-0.5"
                  style={{ color: 'var(--text-muted)', fontFamily: 'Cairo, sans-serif' }}
                >
                  مرحباً،
                </div>
                <div
                  className="text-sm font-black"
                  style={{ color: 'var(--text)', fontFamily: 'Cairo, sans-serif' }}
                >
                  {currentUser.username}
                </div>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-black"
                style={
                  currentUser.role === 'manager'
                    ? {
                        background: 'var(--jade-glow)',
                        color: 'var(--jade)',
                        border: '1px solid color-mix(in srgb, var(--jade) 30%, transparent)',
                      }
                    : {
                        background: 'var(--copper-glow)',
                        color: 'var(--copper)',
                        border: '1px solid color-mix(in srgb, var(--copper) 30%, transparent)',
                      }
                }
              >
                {currentUser.role === 'manager' ? '★ مدير' : 'كاشير'}
              </span>
              <button
                type="button"
                onClick={() => setThemeState(toggleTheme())}
                className="h-9 w-9 flex items-center justify-center rounded-xl text-base transition-all cursor-pointer hover:-translate-y-0.5"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                }}
                title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button
                onClick={handleLogout}
                className="h-9 w-9 flex items-center justify-center rounded-xl transition-all cursor-pointer hover:-translate-y-0.5"
                style={{
                  border: '1px solid color-mix(in srgb, var(--alert) 25%, transparent)',
                  background: 'var(--alert-glow)',
                  color: 'var(--alert)',
                }}
                title="تسجيل الخروج"
              >
                <Icons.Power className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Active Shift Banner */}
          {activeShift ? (
            <div
              className="flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold"
              style={{
                background: 'var(--jade-glow)',
                color: 'var(--jade)',
                border: '1px solid color-mix(in srgb, var(--jade) 25%, transparent)',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full animate-pulse"
                  style={{ background: 'var(--jade)' }}
                />
                <span>
                  التوكة مفتوحة: #{activeShift.id} — بدأت الساعة{' '}
                  {new Date(activeShift.openedAt).toLocaleTimeString('ar-LY')}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveTab('Shifts');
                  setShowCloseShiftModal(true);
                }}
                className="px-3.5 py-1 text-xs font-bold rounded-xl bg-white/20 hover:bg-white/30 transition-all cursor-pointer"
              >
                إغلاق وجرد التوكة 🔒
              </button>
            </div>
          ) : (
            <div
              className="flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold"
              style={{
                background: 'var(--alert-glow)',
                color: 'var(--alert)',
                border: '1px solid color-mix(in srgb, var(--alert) 25%, transparent)',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--alert)' }} />
                <span>لا توجد توكة مفتوحة حالياً — يلزم فتح توكة لتمكين عمليات البيع</span>
              </div>
              <button
                onClick={() => setShowOpenShiftModal(true)}
                className="px-4 py-1.5 text-xs font-black rounded-xl text-white shadow-sm transition-all cursor-pointer hover:scale-105"
                style={{ background: 'var(--gradient-jade)' }}
              >
                ⚡ فتح توكة جديدة
              </button>
            </div>
          )}

          {/* Grid Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tabsList.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col text-right p-6 rounded-2xl transition-all cursor-pointer group hover:-translate-y-1"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor =
                    'color-mix(in srgb, var(--jade) 40%, transparent)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-jade)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div
                  className="flex h-13 w-13 items-center justify-center rounded-xl mb-5 transition-all group-hover:scale-110"
                  style={{
                    background: 'var(--surface-2)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <tab.icon />
                </div>
                <h3
                  className="font-display text-lg font-black mb-2 transition-colors"
                  style={{ color: 'var(--text)' }}
                >
                  {tab.label}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {tab.desc}
                </p>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div
            className="flex justify-between items-center py-2 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="mono">
              {new Date().toLocaleDateString('ar-LY', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span>نظام إدارة محلي · v2.0</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh grid-cols-[272px_1fr] max-[900px]:grid-cols-1" dir="rtl">
      {/* Sidebar Navigation */}
      <aside
        className="sticky top-0 hidden h-dvh flex-col gap-5 border-e p-5 min-[901px]:flex overflow-y-auto"
        style={{ background: 'var(--gradient-sidebar)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3 pt-1">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl font-mono text-sm font-black text-white shadow-md flex-shrink-0"
            style={{ background: 'var(--gradient-jade)', boxShadow: 'var(--shadow-jade)' }}
          >
            POS
          </div>
          <div className="min-w-0">
            <div
              className="font-display text-sm font-extrabold leading-tight truncate"
              style={{ color: 'var(--text)' }}
            >
              {settingsData?.businessName ?? 'سوق المذاق للمستلزمات'}
            </div>
            <div className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
              المستلزمات والمعدات
            </div>
          </div>
        </div>

        {/* Current Active User Status */}
        <div
          className="rounded-2xl p-3.5"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              المستخدم الحالي
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black"
              style={
                currentUser.role === 'manager'
                  ? {
                      background: 'var(--jade-glow)',
                      color: 'var(--jade)',
                      border: '1px solid color-mix(in srgb, var(--jade) 30%, transparent)',
                    }
                  : {
                      background: 'var(--copper-glow)',
                      color: 'var(--copper)',
                      border: '1px solid color-mix(in srgb, var(--copper) 30%, transparent)',
                    }
              }
            >
              {currentUser.role === 'manager' ? '★ مدير' : 'كاشير'}
            </span>
          </div>
          <div className="font-display text-base font-black mb-3" style={{ color: 'var(--text)' }}>
            {currentUser.username}
          </div>
          <button
            onClick={() => {
              setSwitchPinValue('');
              setShowUserPinModal(true);
            }}
            className="w-full py-2 text-xs font-bold rounded-xl transition-all cursor-pointer hover:-translate-y-0.5"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            تبديل المستخدم (PIN) 🔄
          </button>
        </div>

        {/* Navigation Menus */}
        <nav className="flex flex-col gap-1 text-sm flex-1">
          <button
            onClick={() => setActiveTab('Home')}
            className="flex items-center gap-3 min-h-10 rounded-xl px-3.5 py-2 transition-all cursor-pointer text-right mb-2 font-bold text-xs hover:-translate-x-0.5"
            style={{
              background: 'var(--jade-glow)',
              color: 'var(--jade)',
              border: '1px dashed color-mix(in srgb, var(--jade) 35%, transparent)',
            }}
          >
            <Icons.Home />
            <span>القائمة الرئيسية</span>
          </button>

          {[
            { id: 'Dashboard', label: 'لوحة التحكم', icon: Icons.Dashboard, managerOnly: true },
            { id: 'POS', label: 'نقطة البيع', icon: Icons.POS, managerOnly: false },
            {
              id: 'Products',
              label: 'المنتجات والمخزون',
              icon: Icons.Products,
              managerOnly: false,
            },
            { id: 'Shifts', label: 'التوكة والخزينة', icon: Icons.Shifts, managerOnly: false },
            { id: 'Quotations', label: 'عروض الأسعار', icon: Icons.Receipt, managerOnly: false },
            { id: 'Purchases', label: 'المشتريات والموردين', icon: Icons.Truck, managerOnly: true },
            { id: 'Customers', label: 'العملاء والذمم', icon: Icons.Users, managerOnly: true },
            { id: 'Reports', label: 'التقارير المالية', icon: Icons.Reports, managerOnly: true },
            { id: 'Settings', label: 'الإعدادات العامة', icon: Icons.Settings, managerOnly: true },
          ]
            .filter((item) => !item.managerOnly || currentUser.role === 'manager')
            .map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex items-center gap-3 min-h-10 rounded-xl px-3.5 py-2 transition-all cursor-pointer text-right text-xs font-semibold hover:-translate-x-0.5"
                style={
                  activeTab === item.id
                    ? {
                        background: 'var(--surface-2)',
                        color: 'var(--jade)',
                        fontWeight: 700,
                        border: '1px solid var(--border)',
                      }
                    : { color: 'var(--text-muted)', border: '1px solid transparent' }
                }
              >
                <item.icon />
                <span>{item.label}</span>
                {activeTab === item.id && (
                  <span
                    className="mr-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--jade)' }}
                  />
                )}
              </button>
            ))}
        </nav>

        {/* System Theme / Power Toggle */}
        <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={() => setThemeState(toggleTheme())}
            className="flex min-h-9 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:-translate-y-0.5"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
            }}
          >
            {theme === 'dark' ? '☀️ الوضع الفاتح' : '🌙 الوضع الليلي'}
          </button>

          <button
            onClick={handleLogout}
            className="flex min-h-9 items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer hover:-translate-y-0.5"
            style={{
              border: '1px solid color-mix(in srgb, var(--alert) 25%, transparent)',
              background: 'var(--alert-glow)',
              color: 'var(--alert)',
            }}
          >
            <Icons.Power />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="p-6 md:p-8 bg-bg min-h-dvh flex flex-col gap-6 overflow-y-auto">
        {/* Unified Top Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border border-line bg-surface/95 backdrop-blur-md p-4 rounded-card shadow-sm">
          {/* Right Section: App Title & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-gradient-to-tr from-jade to-copper font-mono text-xs font-bold text-white shadow-sm border border-line">
              FD
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm leading-tight text-fg">
                {settingsData?.businessName ?? 'فلو ديف للمستلزمات'}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted leading-tight mt-0.5">
                <span>الرئيسية</span>
                <span>/</span>
                <span className="text-copper font-bold">
                  {activeTab === 'Home'
                    ? 'شاشة الاختيار'
                    : activeTab === 'Dashboard'
                      ? 'لوحة التحكم'
                      : activeTab === 'POS'
                        ? 'شاشة الكاشير'
                        : activeTab === 'Products'
                          ? 'إدارة المنتجات'
                          : activeTab === 'Shifts'
                            ? 'التوكات والخزينة'
                            : activeTab === 'Purchases'
                              ? 'المشتريات والموردين'
                              : activeTab === 'Customers'
                                ? 'العملاء والذمم'
                                : activeTab === 'Reports'
                                  ? 'التقارير والإحصائيات'
                                  : 'الإعدادات'}
                </span>
              </div>
            </div>
          </div>

          {/* Center Section: Active Shift Status (Desktop Only) */}
          <div className="hidden sm:flex items-center gap-2">
            {activeShift ? (
              <div className="flex items-center gap-2 rounded-full bg-jade/10 text-jade border border-jade/30 px-3.5 py-1 text-xs font-bold shadow-sm">
                <span className="h-2 w-2 rounded-full bg-jade animate-pulse"></span>
                <span>التوكة مفتوحة: {activeShift.id}#</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-alert/10 text-alert border border-alert/30 px-3.5 py-1 text-xs font-bold shadow-sm">
                <span className="h-2 w-2 rounded-full bg-alert"></span>
                <span>التوكة مغلقة حالياً</span>
              </div>
            )}
          </div>

          {/* Left Section: User Actions & System controls */}
          <div className="flex items-center gap-2">
            {/* User Badge */}
            <div className="hidden md:flex flex-col items-end pl-2">
              <span className="text-xs font-bold text-fg leading-none">{currentUser.username}</span>
              <span className="text-[9px] text-copper font-semibold mt-1">
                {currentUser.role === 'manager' ? 'مدير النظام' : 'كاشير مبيعات'}
              </span>
            </div>

            {/* Fast PIN Switch */}
            <button
              onClick={() => {
                setSwitchPinValue('');
                setShowUserPinModal(true);
              }}
              className="rounded-control bg-surface-2 p-2.5 text-muted hover:text-fg hover:bg-border transition-all border border-line cursor-pointer flex items-center justify-center"
              title="تبديل سريع للمستخدم"
            >
              <Icons.User />
            </button>

            {/* Settings Shortcut (Visible to managers only) */}
            {currentUser.role === 'manager' && (
              <button
                onClick={() => setActiveTab('Settings')}
                className="rounded-control bg-surface-2 p-2.5 text-muted hover:text-fg hover:bg-border transition-all border border-line cursor-pointer flex items-center justify-center"
                title="الإعدادات"
              >
                <Icons.Settings />
              </button>
            )}

            {/* Theme Toggle (Mobile Quick Access) */}
            <button
              onClick={() => setThemeState(toggleTheme())}
              className="rounded-control bg-surface-2 p-2.5 text-muted hover:text-fg hover:bg-border transition-all border border-line cursor-pointer flex items-center justify-center"
              title="تغيير المظهر"
            >
              {theme === 'dark' ? (
                <svg
                  className="h-4.5 w-4.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 7a5 5 0 100 10 5 5 0 000-10z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4.5 w-4.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="rounded-control bg-red-500/5 hover:bg-red-500/10 p-2.5 text-red-500 border border-red-500/20 transition-all cursor-pointer flex items-center justify-center"
              title="تسجيل الخروج"
            >
              <Icons.Power />
            </button>
          </div>
        </header>

        {/* Active View Container */}
        {activeTab === 'Dashboard' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="mono text-xs tracking-widest text-copper">نظرة عامة</span>
                <h1 className="text-3xl font-extrabold">لوحة التحكم</h1>
              </div>

              {/* Active Shift status pill */}
              <div>
                {activeShift ? (
                  <div className="flex items-center gap-3 bg-jade/10 border border-jade/30 rounded-full px-4 py-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-jade animate-pulse"></span>
                    <span className="text-sm font-semibold text-jade">
                      التوكة مفتوحة حالياً (رقم: {activeShift.id})
                    </span>
                    <button
                      onClick={() => setShowCloseShiftModal(true)}
                      className="text-xs bg-jade text-white px-3 py-1 rounded-full font-bold hover:bg-jade-2 transition-colors"
                    >
                      إغلاق التوكة
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-alert/10 border border-alert/30 rounded-full px-4 py-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-alert"></span>
                    <span className="text-sm font-semibold text-alert">
                      الخزينة مقفلة (لا توجد توكة)
                    </span>
                    <button
                      onClick={() => setShowOpenShiftModal(true)}
                      className="text-xs bg-alert text-white px-3 py-1 rounded-full font-bold hover:bg-alert-2 transition-colors"
                    >
                      فتح التوكة
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
                <span className="text-xs text-muted block mb-1">إجمالي المبيعات اليوم</span>
                <div className="mono text-2xl font-extrabold text-jade">
                  {formatLYD(
                    salesList
                      .filter((s) => s.status === 'completed' && s.createdAt.startsWith(today))
                      .reduce((sum, s) => sum + s.total, 0),
                  )}{' '}
                  د.ل
                </div>
              </div>
              <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
                <span className="text-xs text-muted block mb-1">فواتير اليوم المكتملة</span>
                <div className="mono text-2xl font-extrabold text-text">
                  {
                    salesList.filter(
                      (s) => s.status === 'completed' && s.createdAt.startsWith(today),
                    ).length
                  }{' '}
                  فاتورة
                </div>
              </div>
              <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
                <span className="text-xs text-muted block mb-1">المنتجات منخفضة المخزون</span>
                <div className="mono text-2xl font-extrabold text-copper">
                  {productsList.filter((p) => p.quantity <= p.reorderPoint).length} منتج
                </div>
              </div>
              <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
                <span className="text-xs text-muted block mb-1">إجمالي المصروفات اليوم</span>
                <div className="mono text-2xl font-extrabold text-alert">
                  {formatLYD(
                    expensesList
                      .filter((e) => e.createdAt.startsWith(today))
                      .reduce((sum, e) => sum + e.amount, 0),
                  )}{' '}
                  د.ل
                </div>
              </div>
            </div>

            {/* Sub-panels Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Product Alerts */}
              <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Icons.AlertTriangle />
                  <span>تنبيهات انخفاض مخزون المواد والمعدات</span>
                </h2>

                {productsList.filter((p) => p.quantity <= p.reorderPoint).length === 0 ? (
                  <p className="text-sm text-muted">جميع المنتجات والمعدات متوفرة برصيد آمن.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-surface-2 text-text font-bold">
                        <tr>
                          <th className="p-3">المنتج</th>
                          <th className="p-3">النوع</th>
                          <th className="p-3">المخزون الحالي</th>
                          <th className="p-3">حد إعادة الطلب</th>
                          <th className="p-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productsList
                          .filter((p) => p.quantity <= p.reorderPoint)
                          .slice(0, 5)
                          .map((p) => (
                            <tr
                              key={p.id}
                              className="border-b border-line hover:bg-surface-2 transition-colors"
                            >
                              <td className="p-3 font-semibold">{p.name}</td>
                              <td className="p-3 text-xs text-muted">
                                {p.type === 'equipment' ? 'معدة/جهاز' : 'مادة استهلاكية'}
                              </td>
                              <td className="p-3 mono font-bold text-alert">
                                {p.quantity} {p.baseUnit}
                              </td>
                              <td className="p-3 mono text-muted">{p.reorderPoint}</td>
                              <td className="p-3">
                                <span className="bg-red-500/10 text-alert border border-red-500/20 px-2 py-0.5 rounded-full text-xs font-bold">
                                  {p.quantity === 0 ? 'نافذ' : 'منخفض'}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Quick Actions Panel */}
              <div className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
                <h2 className="text-lg font-bold mb-2">إجراءات سريعة</h2>

                <button
                  onClick={() => setActiveTab('POS')}
                  className="w-full py-3 px-4 bg-jade text-white rounded-control font-bold shadow-md hover:bg-jade-2 transition-colors cursor-pointer text-center"
                >
                  فتح شاشة نقطة البيع (POS)
                </button>

                <button
                  onClick={openNewProductModal}
                  className="w-full py-3 px-4 bg-surface border border-border text-text rounded-control font-bold hover:bg-surface-2 transition-colors cursor-pointer text-center"
                >
                  إضافة منتج أو جهاز جديد
                </button>

                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="w-full py-3 px-4 bg-surface border border-border text-text rounded-control font-bold hover:bg-surface-2 transition-colors cursor-pointer text-center"
                >
                  تسجيل مصروف نقدي يومي
                </button>

                <div className="mt-auto border-t border-line pt-4">
                  <button
                    onClick={triggerManualBackup}
                    className="w-full py-2.5 px-4 bg-surface border border-border text-muted rounded-control text-xs font-bold hover:bg-surface-2 transition-colors cursor-pointer text-center"
                  >
                    إنشاء نسخة احتياطية محلية لقاعدة البيانات
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Customers Tab ─── */}
        {activeTab === 'Customers' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="mono text-xs tracking-widest text-copper">إدارة الذمم</span>
                <h1 className="text-3xl font-extrabold">العملاء والذمم</h1>
              </div>
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setCustomerForm({
                    name: '',
                    phone: '',
                    address: '',
                    notes: '',
                    tier: 'retail',
                    creditLimit: '0.000',
                  });
                  setShowCustomerModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                <Icons.Plus className="h-4 w-4" /> عميل جديد
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-card border border-line bg-surface p-5">
                <div className="text-xs text-muted mb-1">إجمالي العملاء</div>
                <div className="font-bold text-2xl">{customersList.length}</div>
              </div>
              <div className="rounded-card border border-line bg-surface p-5">
                <div className="text-xs text-muted mb-1">عملاء لديهم دين</div>
                <div className="font-bold text-2xl text-alert">
                  {customersList.filter((c) => c.creditBalance > 0).length}
                </div>
              </div>
              <div className="rounded-card border border-line bg-surface p-5">
                <div className="text-xs text-muted mb-1">إجمالي الذمم</div>
                <div className="font-bold text-2xl mono text-alert">
                  {formatLYD(customersList.reduce((s, c) => s + c.creditBalance, 0))} د.ل
                </div>
              </div>
            </div>

            <div className="rounded-card border border-line bg-surface overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-surface-2 border-b border-line">
                  <tr className="text-xs font-bold text-muted">
                    <th className="p-3">الاسم</th>
                    <th className="p-3">الهاتف</th>
                    <th className="p-3">الفئة</th>
                    <th className="p-3">رصيد الدين</th>
                    <th className="p-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        لا يوجد عملاء مسجلون. ابدأ بإضافة عميل.
                      </td>
                    </tr>
                  ) : (
                    customersList.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-2/40">
                        <td className="p-3 font-semibold">{c.name}</td>
                        <td className="p-3 text-muted mono">{c.phone || '—'}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.tier === 'wholesale'
                                ? 'bg-copper/10 text-copper border border-copper/30'
                                : 'bg-surface-2 text-muted border border-border'
                            }`}
                          >
                            {c.tier === 'wholesale' ? 'جملة' : 'تجزئة'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-bold mono ${c.creditBalance > 0 ? 'text-alert' : 'text-jade'}`}
                          >
                            {formatLYD(c.creditBalance)} د.ل
                          </span>
                        </td>
                        <td className="p-3 flex gap-2">
                          <button
                            onClick={() => openCustomerStatement(c)}
                            className="px-2.5 py-1 text-xs bg-purple-600/10 text-purple-700 border border-purple-600/30 rounded font-bold hover:bg-purple-600/20 cursor-pointer flex items-center gap-1"
                            title="سحب كشف حساب تفصيلي بمقياس A4"
                          >
                            <Icons.Receipt className="h-3.5 w-3.5" />
                            <span>كشف حساب (A4)</span>
                          </button>
                          {c.creditBalance > 0 && (
                            <button
                              onClick={() => {
                                setPayingCustomer(c);
                                setCustomerPaymentAmount((c.creditBalance / 1000).toFixed(3));
                                setShowCustomerPaymentModal(true);
                              }}
                              className="px-2.5 py-1 text-xs bg-jade/10 text-jade border border-jade/30 rounded font-bold hover:bg-jade/20 cursor-pointer"
                            >
                              تسجيل سداد
                            </button>
                          )}
                          <button
                            onClick={() => openDepositModal(c)}
                            className="px-2.5 py-1 text-xs bg-blue-500/10 text-blue-600 border border-blue-500/30 rounded font-bold hover:bg-blue-500/20 cursor-pointer"
                            title="استلام عربون مع حجز اختياري لجهاز"
                          >
                            عربون
                          </button>
                          {currentUser?.role === 'manager' && (
                            <button
                              onClick={() => openSpecialPrices(c)}
                              className="px-2.5 py-1 text-xs bg-copper/10 text-copper border border-copper/30 rounded font-bold hover:bg-copper/20 cursor-pointer"
                              title="أسعار خاصة لهذا العميل تتجاوز فئة التسعير"
                            >
                              أسعار خاصة
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingCustomer(c);
                              setCustomerForm({
                                name: c.name,
                                phone: c.phone || '',
                                address: c.address || '',
                                notes: c.notes || '',
                                tier: c.tier || 'retail',
                                creditLimit: ((c.creditLimit || 0) / 1000).toFixed(3),
                              });
                              setShowCustomerModal(true);
                            }}
                            className="px-2.5 py-1 text-xs border border-border bg-surface hover:bg-border rounded font-bold cursor-pointer text-muted"
                          >
                            تعديل
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Deposits ledger */}
            <div className="rounded-card border border-line bg-surface overflow-hidden">
              <div className="p-4 border-b border-line flex items-center justify-between">
                <h3 className="font-bold text-sm">العرابين والحجوزات</h3>
                <span className="text-xs text-muted">
                  {depositsList.filter((d) => d.status === 'held').length} عربون قائم
                </span>
              </div>
              <table className="w-full text-right text-sm">
                <thead className="bg-surface-2 border-b border-line">
                  <tr className="text-xs font-bold text-muted">
                    <th className="p-3">#</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">الحجز</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {depositsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted">
                        لا توجد عرابين مسجلة.
                      </td>
                    </tr>
                  ) : (
                    depositsList.map((d) => (
                      <tr key={d.id} className="hover:bg-surface-2/40">
                        <td className="p-3 mono">#{d.id}</td>
                        <td className="p-3 font-semibold">{d.customerName}</td>
                        <td className="p-3 mono font-bold">{formatLYD(d.amount)} د.ل</td>
                        <td className="p-3 text-xs">{d.productName || '—'}</td>
                        <td className="p-3 text-muted text-xs">
                          {new Date(d.createdAt).toLocaleDateString('ar-LY')}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              d.status === 'held'
                                ? 'bg-jade/10 text-jade'
                                : d.status === 'applied'
                                  ? 'bg-blue-500/10 text-blue-600'
                                  : d.status === 'refunded'
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {d.status === 'held'
                              ? 'قائم'
                              : d.status === 'applied'
                                ? `خُصم من فاتورة #${d.saleId ?? ''}`
                                : d.status === 'refunded'
                                  ? 'مسترد'
                                  : 'مصادَر'}
                          </span>
                        </td>
                        <td className="p-3 flex gap-2">
                          {d.status === 'held' && (
                            <>
                              <button
                                onClick={() => handleDepositAction(d, 'refund')}
                                className="px-2.5 py-1 text-xs text-amber-600 border border-amber-500/30 bg-amber-500/5 rounded font-bold hover:bg-amber-500/10 cursor-pointer"
                              >
                                استرداد نقدي
                              </button>
                              {currentUser?.role === 'manager' && (
                                <button
                                  onClick={() => handleDepositAction(d, 'forfeit')}
                                  className="px-2.5 py-1 text-xs text-alert border border-alert/30 bg-alert/5 rounded font-bold hover:bg-alert/10 cursor-pointer"
                                >
                                  مصادرة
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Purchases Tab ─── */}
        {activeTab === 'Purchases' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="mono text-xs tracking-widest text-copper">دورة المشتريات</span>
                <h1 className="text-3xl font-extrabold">المشتريات والموردين</h1>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupplierForm({ name: '', phone: '', address: '', notes: '' });
                    setShowSupplierModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border text-muted font-bold text-sm rounded-control hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <Icons.Truck className="h-4 w-4" /> مورد جديد
                </button>
                <button
                  onClick={() => {
                    setPurchaseForm({
                      supplierId: '',
                      supplierName: '',
                      items: [{ productId: '', quantity: '1', unitCost: '0.000' }],
                      paid: '0.000',
                      notes: '',
                    });
                    setShowPurchaseModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
                >
                  <Icons.Plus className="h-4 w-4" /> فاتورة شراء جديدة
                </button>
              </div>
            </div>

            {/* Suppliers section */}
            <div className="rounded-card border border-line bg-surface p-5">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Icons.Truck className="h-4 w-4 text-copper" /> الموردون
              </h3>
              {suppliersList.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">لا يوجد موردون مسجلون بعد.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {suppliersList.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 border border-border rounded-control bg-surface-2 flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-sm">{s.name}</div>
                        <button
                          onClick={() => {
                            setEditingSupplier(s);
                            setSupplierForm({
                              name: s.name,
                              phone: s.phone || '',
                              address: s.address || '',
                              notes: s.notes || '',
                            });
                            setShowSupplierModal(true);
                          }}
                          className="text-[10px] border border-border px-2 py-0.5 rounded text-muted hover:text-text cursor-pointer"
                        >
                          تعديل
                        </button>
                      </div>
                      <div className="text-xs text-muted">{s.phone || 'لا يوجد هاتف'}</div>
                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="text-xs text-muted">ما علينا له:</span>
                        <span
                          className={`font-bold mono text-sm ${s.debtBalance > 0 ? 'text-alert' : 'text-jade'}`}
                        >
                          {formatLYD(s.debtBalance)} د.ل
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Purchases history */}
            <div className="rounded-card border border-line bg-surface overflow-hidden">
              <div className="p-4 border-b border-line flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Icons.Receipt className="h-4 w-4 text-copper" /> سجل فواتير الشراء
                </h3>
                <span className="text-xs text-muted">{purchasesList.length} فاتورة</span>
              </div>
              <table className="w-full text-right text-sm">
                <thead className="bg-surface-2 border-b border-line">
                  <tr className="text-xs font-bold text-muted">
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">المورد</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">المدفوع</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchasesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        لا توجد فواتير شراء مسجلة.
                      </td>
                    </tr>
                  ) : (
                    purchasesList.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-2/40">
                        <td className="p-3 mono font-bold text-jade">{p.invoiceNumber}</td>
                        <td className="p-3 font-semibold">{p.supplierName || '—'}</td>
                        <td className="p-3 text-muted text-xs">
                          {new Date(p.createdAt).toLocaleDateString('ar-LY')}
                        </td>
                        <td className="p-3 mono font-bold">{formatLYD(p.total)} د.ل</td>
                        <td className="p-3 mono">{formatLYD(p.paid)} د.ل</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'paid' ? 'bg-jade/10 text-jade' : p.status === 'partial' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'}`}
                          >
                            {p.status === 'paid'
                              ? 'مدفوعة'
                              : p.status === 'partial'
                                ? 'مدفوعة جزئياً'
                                : 'غير مدفوعة'}
                          </span>
                        </td>
                        <td className="p-3">
                          {currentUser?.role === 'manager' && (
                            <button
                              onClick={() => openPurchaseReturn(p.id)}
                              className="px-2.5 py-1 text-xs bg-alert/5 text-alert border border-alert/30 rounded font-bold hover:bg-alert/10 cursor-pointer"
                              title="إرجاع أصناف من هذه الفاتورة للمورد"
                            >
                              مرتجع
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* POS Tab */}
        {activeTab === 'POS' && (
          <div className="flex flex-col gap-4">
            {!activeShift && (
              <div
                className="flex flex-wrap items-center justify-between p-4 rounded-2xl border text-sm font-bold gap-3"
                style={{
                  background: 'var(--alert-glow)',
                  borderColor: 'color-mix(in srgb, var(--alert) 30%, transparent)',
                  color: 'var(--alert)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <div>تنبيه: لا توجد توكة مفتوحة في الخزينة حالياً!</div>
                    <div className="text-xs font-normal opacity-80">
                      لا يمكنك إتمام المبيعات وتأكيد الفواتير حتى يتم فتح توكة جديدة وتحديد المبلغ
                      الافتتاحي للدرج.
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowOpenShiftModal(true)}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white shadow-md transition-all cursor-pointer hover:scale-105"
                  style={{ background: 'var(--gradient-jade)' }}
                >
                  ⚡ فتح توكة جديدة الآن
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
              {/* Products Selection Grid */}
              <div className="flex flex-col gap-4">
                {/* Scanner Search & Filters */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 bg-surface p-4 rounded-card border border-line">
                  <div className="relative">
                    <span className="absolute inset-y-0 right-3 flex items-center">
                      <Icons.Search />
                    </span>
                    <input
                      ref={posSearchInputRef}
                      type="text"
                      value={posSearch}
                      onChange={(e) => setPosSearch(e.target.value)}
                      placeholder="ابحث بالاسم أو امسح الباركود مباشرة..."
                      className="w-full h-11 rounded-control border border-line bg-surface pr-10 pl-3 text-sm focus-visible:outline-none font-display font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Exact barcode match first
                          const exactMatch = productsList.find(
                            (p) => p.barcode === posSearch.trim(),
                          );
                          const target =
                            exactMatch ??
                            (filteredProducts.length === 1 ? filteredProducts[0] : null);
                          if (target) {
                            addToCart(target);
                            playBeep();
                            setPosSearch('');
                            e.preventDefault();
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Category selectors */}
                  <div className="flex gap-1.5 overflow-x-auto py-1">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setPosCategory(cat)}
                        className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${posCategory === cat ? 'bg-jade text-white border-jade' : 'bg-surface-2 text-muted border-border hover:bg-surface hover:text-text'}`}
                      >
                        {cat === 'ALL' ? 'الكل' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Products list grid */}
                {filteredProducts.length === 0 ? (
                  <div className="bg-surface border border-line rounded-card p-12 text-center text-muted">
                    لا توجد منتجات مطابقة لعملية البحث الحالية.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="flex flex-col text-right bg-surface border border-line rounded-card p-4 hover:border-jade hover:shadow-sm transition-all relative overflow-hidden group cursor-pointer"
                      >
                        {/* Stock badge (bundles show assemblable count) */}
                        {(p.components?.length ?? 0) > 0 ? (
                          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-copper/10 text-copper border border-copper/20">
                            باقة × {p.bundleAvailable ?? 0}
                          </span>
                        ) : (
                          <span
                            className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.quantity <= p.reorderPoint ? 'bg-red-500/10 text-alert border border-red-500/10' : 'bg-jade/10 text-jade border border-jade/10'}`}
                          >
                            {p.quantity} {p.baseUnit}
                          </span>
                        )}

                        {p.imageUrl && (
                          <img
                            src={p.imageUrl}
                            alt=""
                            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                            className="mt-3 h-16 w-16 object-cover rounded self-center border border-line"
                          />
                        )}
                        <div className="mt-4 font-display text-sm font-extrabold text-text line-clamp-2">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-muted mb-3">{p.category}</div>

                        <div className="mt-auto pt-2 border-t border-line flex items-center justify-between">
                          <span className="mono font-bold text-jade text-sm">
                            {formatLYD(resolveClientPrice(p, posCustomerId, posSpecialPrices))} د.ل
                          </span>
                          <span className="text-[10px] font-bold text-muted bg-surface-2 px-1.5 py-0.5 rounded">
                            {p.type === 'equipment' ? 'جهاز' : 'استهلاكي'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Receipt Cart Sidebar */}
              <div className="sticky top-6 rounded-card border border-line bg-paper shadow-md overflow-hidden flex flex-col max-h-[calc(100vh-100px)] text-ink">
                {/* Store Branded Header */}
                <div className="p-4 border-b border-dashed border-border text-center bg-paper">
                  <h3 className="font-display font-extrabold text-base leading-tight">
                    {settingsData?.businessName ?? 'سوق المذاق للمستلزمات'}
                  </h3>
                  <p className="text-[10px] text-muted">
                    هاتف:{' '}
                    <span className="mono">{settingsData?.businessPhone ?? '091-XXXXXXX'}</span>
                  </p>
                  <div className="text-[10px] text-muted mt-1">
                    التاريخ: <span className="mono">{new Date().toLocaleDateString('ar-LY')}</span>
                  </div>
                </div>

                {/* Receipt Cart items List */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[100px] bg-paper">
                  {cart.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-center text-xs text-muted italic">
                      السلة فارغة. أضف منتجات للبدء.
                    </div>
                  ) : (
                    cart.map((item, idx) => (
                      <div key={item.product.id} className="flex flex-col gap-1 text-xs">
                        <div className="flex justify-between items-start">
                          <span className="font-bold font-display text-text">
                            {item.product.name}
                          </span>
                          <button
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-alert hover:text-red-700 transition-colors p-1"
                          >
                            <Icons.Trash />
                          </button>
                        </div>

                        {(item.product.units?.length ?? 0) > 0 && (
                          <div className="flex items-center gap-2 text-[10px] text-muted">
                            <span>الوحدة:</span>
                            <select
                              value={item.unitId ?? ''}
                              onChange={(e) => changeCartUnit(item.product.id, e.target.value)}
                              className="h-7 rounded border border-line bg-white text-ink px-1.5 text-[10px] focus-visible:outline-none"
                            >
                              <option value="">
                                {item.product.baseUnit} — {formatLYD(item.product.retailPrice)}
                              </option>
                              {item.product.units!.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.unitName} (={u.conversionFactor} {item.product.baseUnit}) —{' '}
                                  {formatLYD(u.price)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-[11px] text-muted">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                              className="bg-surface-2 border border-border rounded p-1 hover:bg-border transition-all"
                            >
                              <Icons.Minus />
                            </button>
                            <span className="mono font-bold text-text text-xs">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                              className="bg-surface-2 border border-border rounded p-1 hover:bg-border transition-all"
                            >
                              <Icons.Plus />
                            </button>
                            {item.unitName && (
                              <span className="text-[10px] text-copper font-bold">
                                {item.unitName}
                              </span>
                            )}
                          </div>
                          <div className="mono text-text">
                            {item.quantity} × {formatLYD(item.unitPrice)} ={' '}
                            <span className="font-bold text-jade">
                              {formatLYD(item.quantity * item.unitPrice)}
                            </span>
                          </div>
                        </div>

                        {item.product.type === 'equipment' && (
                          <div className="flex items-center gap-2 mt-1 bg-surface-2 p-1.5 rounded border border-line">
                            <span className="text-[10px] text-muted">الرقم التسلسلي (Serial):</span>
                            <input
                              type="text"
                              value={item.serialNumber || ''}
                              onChange={(e) => {
                                const sNo = e.target.value;
                                setCart(
                                  cart.map((c) =>
                                    c.product.id === item.product.id
                                      ? { ...c, serialNumber: sNo }
                                      : c,
                                  ),
                                );
                              }}
                              placeholder="أدخل الرقم التسلسلي للجهاز..."
                              className="flex-1 h-7 border border-line bg-surface rounded px-2 text-[10px] focus-visible:outline-none"
                            />
                          </div>
                        )}

                        {idx < cart.length - 1 && (
                          <div className="border-b border-dashed border-border/60 my-1"></div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Cart Calculations Footer — scrolls when the viewport is short
                    so the confirm/quotation buttons are never clipped */}
                <div className="p-4 border-t border-dashed border-border bg-paper flex flex-col gap-2.5 text-xs overflow-y-auto min-h-0">
                  <div className="flex items-center justify-between text-muted">
                    <span>المجموع الفرعي:</span>
                    <span className="mono">{formatLYD(cartSubtotal)} د.ل</span>
                  </div>

                  {/* Discount field */}
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">الخصم (د.ل):</span>
                    <input
                      type="number"
                      step="0.050"
                      value={posDiscount}
                      onChange={(e) => setPosDiscount(e.target.value)}
                      className="w-24 text-left h-7 rounded border border-border bg-white px-2 mono text-xs focus-visible:outline-none text-ink"
                    />
                  </div>

                  {isTaxEnabled && (
                    <div className="flex items-center justify-between text-muted">
                      <span>الضريبة ({(taxRatePermille / 10).toFixed(1)}%):</span>
                      <span className="mono">{formatLYD(cartTax)} د.ل</span>
                    </div>
                  )}

                  {/* Held deposits of the selected customer can be applied */}
                  {posCustomerId &&
                    depositsList.some(
                      (d) => d.customerId === posCustomerId && d.status === 'held',
                    ) && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">خصم عربون:</span>
                        <select
                          value={posDepositId ?? ''}
                          onChange={(e) =>
                            setPosDepositId(e.target.value ? Number(e.target.value) : null)
                          }
                          className="w-40 h-7 text-[10px] rounded border border-border bg-white px-1.5 text-ink focus-visible:outline-none"
                        >
                          <option value="">بدون</option>
                          {depositsList
                            .filter((d) => d.customerId === posCustomerId && d.status === 'held')
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                #{d.id} — {formatLYD(d.amount)} د.ل
                                {d.productName ? ` (${d.productName})` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  {posDepositId &&
                    (() => {
                      const dep = depositsList.find((d) => d.id === posDepositId);
                      return dep ? (
                        <div className="flex items-center justify-between text-jade font-bold">
                          <span>المدفوع مسبقاً (عربون):</span>
                          <span className="mono">-{formatLYD(dep.amount)} د.ل</span>
                        </div>
                      ) : null;
                    })()}

                  <div className="border-t border-dashed border-border my-1"></div>

                  <div className="flex items-center justify-between font-display text-sm font-extrabold">
                    <span>المجموع الإجمالي:</span>
                    <span className="mono text-lg text-jade font-extrabold">
                      {formatLYD(cartTotal)} د.ل
                    </span>
                  </div>

                  {/* Payment Type Selector (Cash vs Credit Sale) */}
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="grid grid-cols-2 gap-1 bg-surface-2 p-1 rounded border border-border text-[11px]">
                      <button
                        onClick={() => setPosPaymentType('cash')}
                        className={`py-1 rounded font-bold transition-all cursor-pointer ${posPaymentType === 'cash' ? 'bg-jade text-white shadow-sm' : 'text-muted hover:text-text'}`}
                      >
                        بيع نقدي مباشر
                      </button>
                      <button
                        onClick={() => setPosPaymentType('credit')}
                        className={`py-1 rounded font-bold transition-all cursor-pointer ${posPaymentType === 'credit' ? 'bg-amber-600 text-white shadow-sm' : 'text-muted hover:text-text'}`}
                      >
                        بيع بالآجل (دين)
                      </button>
                    </div>

                    {/* Customer Selector Dropdown */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-muted whitespace-nowrap">العميل:</span>
                      <select
                        value={posCustomerId || ''}
                        onChange={(e) =>
                          setPosCustomerId(e.target.value ? Number(e.target.value) : null)
                        }
                        className={`w-full h-8 text-[11px] rounded border bg-white px-2 focus-visible:outline-none text-ink ${posPaymentType === 'credit' && !posCustomerId ? 'border-alert font-bold bg-red-50' : 'border-border'}`}
                      >
                        <option value="">-- زبون عابر (بدون حساب) --</option>
                        {customersList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{' '}
                            {c.creditBalance > 0
                              ? `(عليه ${(c.creditBalance / 1000).toFixed(3)} د.ل)`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Cash/Card/Transfer Selector */}
                  {posPaymentType === 'cash' && (
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      <button
                        onClick={() => setPosPaymentMethod('cash')}
                        className={`py-1.5 rounded-[4px] text-[11px] font-bold border transition-colors cursor-pointer ${posPaymentMethod === 'cash' ? 'bg-jade text-white border-jade' : 'bg-surface-2 text-muted border-border'}`}
                      >
                        نقدًا (كاش)
                      </button>
                      <button
                        onClick={() => setPosPaymentMethod('card')}
                        className={`py-1.5 rounded-[4px] text-[11px] font-bold border transition-colors cursor-pointer ${posPaymentMethod === 'card' ? 'bg-jade text-white border-jade' : 'bg-surface-2 text-muted border-border'}`}
                      >
                        بطاقة مصرفية
                      </button>
                      <button
                        onClick={() => setPosPaymentMethod('transfer')}
                        className={`py-1.5 rounded-[4px] text-[11px] font-bold border transition-colors cursor-pointer ${posPaymentMethod === 'transfer' ? 'bg-jade text-white border-jade' : 'bg-surface-2 text-muted border-border'}`}
                      >
                        حوالة مصرفية
                      </button>
                    </div>
                  )}

                  {/* Confirm Sale Button or Open Shift Button */}
                  {!activeShift ? (
                    <button
                      onClick={() => setShowOpenShiftModal(true)}
                      className="w-full mt-2 py-3 bg-alert hover:bg-red-600 text-white text-sm font-bold rounded-control shadow-md transition-colors cursor-pointer text-center"
                    >
                      فتح التوكة للبدء بالبيع
                    </button>
                  ) : (
                    <>
                      {posQuotationId && (
                        <div className="mt-2 p-2 rounded border border-copper/40 bg-copper/10 text-copper text-[10px] font-bold flex items-center justify-between gap-2">
                          <span>تحويل عرض سعر — سيتم تسجيله كفاتورة وخصم المخزون عند التأكيد.</span>
                          <button
                            onClick={() => setPosQuotationId(null)}
                            className="underline cursor-pointer"
                          >
                            فك الربط
                          </button>
                        </div>
                      )}
                      <button
                        disabled={cart.length === 0}
                        onClick={handleCheckout}
                        className="w-full mt-2 py-3 bg-jade disabled:bg-border text-white text-sm font-bold rounded-control shadow-md hover:bg-jade-2 transition-colors cursor-pointer text-center"
                      >
                        {posQuotationId ? 'تحويل العرض إلى فاتورة نهائية' : 'تأكيد وطباعة الفاتورة'}
                      </button>
                      <button
                        disabled={cart.length === 0}
                        onClick={handleSaveQuotation}
                        className="w-full mt-2 py-2.5 bg-surface border border-copper/40 text-copper disabled:opacity-40 text-xs font-bold rounded-control hover:bg-copper/10 transition-colors cursor-pointer text-center"
                        title="حفظ السلة كعرض سعر غير ملزم — لا يخصم مخزوناً ولا يسجل نقدية"
                      >
                        حفظ كعرض سعر (بدون خصم مخزون)
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Quotations Tab ─── */}
        {activeTab === 'Quotations' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="mono text-xs tracking-widest text-copper">عروض غير ملزمة</span>
                <h1 className="text-3xl font-extrabold">عروض الأسعار</h1>
              </div>
              <button
                onClick={() => setActiveTab('POS')}
                className="flex items-center gap-2 px-4 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                <Icons.Plus className="h-4 w-4" /> عرض جديد من نقطة البيع
              </button>
            </div>
            <p className="text-xs text-muted -mt-4">
              عروض الأسعار لا تخصم مخزوناً ولا تسجل نقدية. التحويل إلى فاتورة يطبق كل تأثيرات البيع
              الطبيعية.
            </p>

            <div className="rounded-card border border-line bg-surface overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-surface-2 border-b border-line">
                  <tr className="text-xs font-bold text-muted">
                    <th className="p-3">رقم العرض</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">صالح حتى</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotationsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        لا توجد عروض أسعار. احفظ سلة نقطة البيع كعرض سعر لتبدأ.
                      </td>
                    </tr>
                  ) : (
                    quotationsList.map((q) => (
                      <tr key={q.id} className="hover:bg-surface-2/40">
                        <td className="p-3 mono font-bold text-copper">{q.quoteNumber}</td>
                        <td className="p-3 font-semibold">{q.customerName || 'زبون نقدي'}</td>
                        <td className="p-3 text-muted text-xs">
                          {new Date(q.createdAt).toLocaleDateString('ar-LY')}
                        </td>
                        <td className="p-3 mono text-xs">{q.validUntil}</td>
                        <td className="p-3 mono font-bold">{formatLYD(q.total)} د.ل</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              q.status === 'active'
                                ? 'bg-jade/10 text-jade'
                                : q.status === 'converted'
                                  ? 'bg-blue-500/10 text-blue-600'
                                  : q.status === 'expired'
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {q.status === 'active'
                              ? 'نشط'
                              : q.status === 'converted'
                                ? 'تم تحويله'
                                : q.status === 'expired'
                                  ? 'منتهي الصلاحية'
                                  : 'ملغى'}
                          </span>
                        </td>
                        <td className="p-3 flex gap-2">
                          <button
                            onClick={() => openQuotationPrint(q)}
                            className="px-2.5 py-1 text-xs bg-blue-500/10 text-blue-600 border border-blue-500/30 rounded font-bold hover:bg-blue-500/20 cursor-pointer flex items-center gap-1"
                            title="معاينة وطباعة عرض السعر بمقياس A4"
                          >
                            <Icons.Printer className="h-3.5 w-3.5" />
                            <span>عرض / طباعة</span>
                          </button>
                          {q.status === 'active' && (
                            <>
                              <button
                                onClick={() => loadQuotationIntoPos(q)}
                                className="px-2.5 py-1 text-xs bg-jade/10 text-jade border border-jade/30 rounded font-bold hover:bg-jade/20 cursor-pointer"
                              >
                                تحويل لفاتورة
                              </button>
                              <button
                                onClick={() => handleCancelQuotation(q)}
                                className="px-2.5 py-1 text-xs text-alert border border-alert/30 bg-alert/5 rounded font-bold hover:bg-alert/10 cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </>
                          )}
                          {q.status === 'converted' && q.convertedSaleId && (
                            <span className="text-[10px] text-muted self-center">
                              فاتورة #{q.convertedSaleId}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Manager tab */}
        {activeTab === 'Products' && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="mono text-xs tracking-widest text-copper">المخازن والأجهزة</span>
                <h1 className="text-3xl font-extrabold">إدارة المنتجات والمعدات</h1>
              </div>

              {currentUser.role === 'manager' && (
                <button
                  onClick={openNewProductModal}
                  className="flex items-center gap-2 py-2.5 px-4 bg-jade text-white rounded-control font-bold shadow-md hover:bg-jade-2 transition-colors cursor-pointer"
                >
                  <Icons.Plus />
                  <span>إضافة منتج جديد</span>
                </button>
              )}
            </div>

            {/* List and search table */}
            <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
              {/* Table search bar */}
              <div className="mb-4 relative max-w-sm">
                <span className="absolute inset-y-0 right-3 flex items-center">
                  <Icons.Search />
                </span>
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الباركود..."
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                  className="w-full h-10 rounded-control border border-line bg-surface pr-10 pl-3 text-sm focus-visible:outline-none"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-surface-2 text-text font-bold">
                    <tr className="border-b border-line">
                      <th className="p-3">اسم المنتج</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">التصنيف</th>
                      <th className="p-3 font-mono">سعر الشراء</th>
                      <th className="p-3 font-mono">سعر البيع</th>
                      <th className="p-3 font-mono">الكمية</th>
                      <th className="p-3">الرموز والباركود</th>
                      <th className="p-3 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-line hover:bg-surface-2 transition-colors"
                      >
                        <td className="p-3 font-bold">
                          <div className="flex items-center gap-2">
                            {p.imageUrl && (
                              <img
                                src={p.imageUrl}
                                alt=""
                                onError={(e) =>
                                  ((e.target as HTMLImageElement).style.display = 'none')
                                }
                                className="h-8 w-8 object-cover rounded border border-line shrink-0"
                              />
                            )}
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.type === 'equipment' ? 'bg-purple-500/10 text-purple-600' : 'bg-blue-500/10 text-blue-600'}`}
                          >
                            {p.type === 'equipment' ? 'معدة (سيريال)' : 'مواد (صلاحية)'}
                          </span>
                        </td>
                        <td className="p-3 text-muted">{p.category}</td>
                        <td className="p-3 mono font-semibold">{formatLYD(p.costPrice)}</td>
                        <td className="p-3 mono font-bold text-jade">{formatLYD(p.retailPrice)}</td>
                        <td
                          className={`p-3 mono font-bold ${p.quantity <= p.reorderPoint ? 'text-alert' : 'text-text'}`}
                        >
                          {p.quantity} {p.baseUnit}
                        </td>
                        <td className="p-3 mono text-xs text-muted">{p.barcode || '—'}</td>
                        <td className="p-3 text-left">
                          {currentUser.role === 'manager' ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleViewMovements(p)}
                                className="text-xs border border-border bg-surface px-2.5 py-1 rounded hover:bg-surface-2 text-muted transition-colors cursor-pointer"
                                title="عرض سجل الحركات"
                              >
                                سجل
                              </button>
                              <button
                                onClick={() => {
                                  setAdjustingProduct(p);
                                  setAdjustForm({ quantity: '0', reason: '' });
                                  setShowAdjustModal(true);
                                }}
                                className="text-xs border border-border bg-surface px-2.5 py-1 rounded hover:bg-surface-2 text-copper transition-colors cursor-pointer"
                              >
                                تسوية كمية
                              </button>
                              <button
                                onClick={() => startEditProduct(p)}
                                className="text-xs border border-border bg-surface px-2.5 py-1 rounded hover:bg-surface-2 text-jade transition-colors cursor-pointer"
                              >
                                تعديل
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted">عرض فقط</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Shifts tab */}
        {activeTab === 'Shifts' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="mono text-xs tracking-widest text-copper">
                  الخزينة والعمليات النقودية
                </span>
                <h1 className="text-3xl font-extrabold">التوكات والخزينة اليومية</h1>
              </div>

              <div className="flex items-center gap-3">
                {activeShift ? (
                  <>
                    <button
                      onClick={() => setShowCloseShiftModal(true)}
                      className="flex items-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs text-white shadow-md transition-all cursor-pointer hover:scale-105"
                      style={{ background: 'var(--copper)' }}
                    >
                      <span>🔒 إغلاق وجرد التوكة #{activeShift.id}</span>
                    </button>
                    <button
                      onClick={() => setShowExpenseModal(true)}
                      className="flex items-center gap-2 py-2.5 px-4 bg-alert text-white rounded-xl font-bold text-xs shadow-md hover:bg-red-600 transition-colors cursor-pointer"
                    >
                      <Icons.Plus />
                      <span>تسجيل مصروفات</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowOpenShiftModal(true)}
                    className="flex items-center gap-2 py-3 px-6 rounded-xl font-black text-sm text-white shadow-lg transition-all cursor-pointer hover:scale-105"
                    style={{ background: 'var(--gradient-jade)' }}
                  >
                    <span>⚡ فتح توكة جديدة (درج الكاش)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Active Shift Status Overview Banner inside Shifts tab */}
            {activeShift ? (
              <div
                className="p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'color-mix(in srgb, var(--jade) 30%, transparent)',
                  boxShadow: 'var(--shadow-jade)',
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-lg"
                    style={{ background: 'var(--jade-glow)', color: 'var(--jade)' }}
                  >
                    #{activeShift.id}
                  </div>
                  <div>
                    <div
                      className="flex items-center gap-2 font-black text-base"
                      style={{ color: 'var(--text)' }}
                    >
                      <span>التوكة الحالية نشطة</span>
                      <span
                        className="h-2 w-2 rounded-full animate-pulse"
                        style={{ background: 'var(--jade)' }}
                      />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      المسؤول: {activeShift.openedByUsername} · تاريخ الفتح:{' '}
                      {new Date(activeShift.openedAt).toLocaleString('ar-LY')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      الرصيد الافتتاحي
                    </div>
                    <div className="mono font-black text-base" style={{ color: 'var(--text)' }}>
                      {formatLYD(activeShift.openingCash)} د.ل
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCloseShiftModal(true)}
                    className="py-2 px-4 rounded-xl text-xs font-bold text-white transition-all cursor-pointer"
                    style={{ background: 'var(--jade)' }}
                  >
                    إغلاق التوكة والجرد 🔒
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="p-6 rounded-2xl border text-center flex flex-col items-center justify-center gap-3"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <div className="text-3xl">🔑</div>
                <h3 className="font-display font-black text-lg" style={{ color: 'var(--text)' }}>
                  لا توجد توكة مفتوحة حالياً
                </h3>
                <p className="text-xs max-w-[450px]" style={{ color: 'var(--text-muted)' }}>
                  قم بفتح توكة جديدة وتحديد المبلغ النقدي المتوفر بدراج الكاش للبدء بإنشاء الفواتير
                  وتسجيل المبيعات والمصروفات.
                </p>
                <button
                  onClick={() => setShowOpenShiftModal(true)}
                  className="mt-2 py-3 px-6 rounded-xl font-black text-xs text-white shadow-md transition-all cursor-pointer hover:scale-105"
                  style={{ background: 'var(--gradient-jade)' }}
                >
                  ⚡ فتح توكة جديدة الآن
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left detail card: Shift info */}
              <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
                <h2 className="text-lg font-bold">سجل التوكات السابقة</h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-surface-2 text-text font-bold">
                      <tr className="border-b border-line">
                        <th className="p-3">رقم التوكة</th>
                        <th className="p-3">المسؤول</th>
                        <th className="p-3">الافتتاح</th>
                        <th className="p-3">الإغلاق</th>
                        <th className="p-3 font-mono">الافتتاحي</th>
                        <th className="p-3 font-mono">الفعلي</th>
                        <th className="p-3 font-mono">الفارق (عجز/زيادة)</th>
                        <th className="p-3">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftsList.map((s) => (
                        <tr
                          key={s.id}
                          className="border-b border-line hover:bg-surface-2 transition-colors"
                        >
                          <td className="p-3 font-bold">#{s.id}</td>
                          <td className="p-3">{s.openedByUsername}</td>
                          <td className="p-3 text-xs text-muted">
                            {new Date(s.openedAt).toLocaleString('ar-LY')}
                          </td>
                          <td className="p-3 text-xs text-muted">
                            {s.closedAt ? new Date(s.closedAt).toLocaleString('ar-LY') : '—'}
                          </td>
                          <td className="p-3 mono">{formatLYD(s.openingCash)}</td>
                          <td className="p-3 mono font-bold">
                            {s.actualCash ? formatLYD(s.actualCash) : '—'}
                          </td>
                          <td
                            className={`p-3 mono font-bold ${s.variance === undefined ? '' : s.variance < 0 ? 'text-alert' : s.variance > 0 ? 'text-copper' : 'text-jade'}`}
                          >
                            {s.variance !== undefined ? `${formatLYD(s.variance)} د.ل` : '—'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.status === 'open' ? 'bg-jade/10 text-jade border border-jade/20' : 'bg-surface-2 text-muted border border-border'}`}
                            >
                              {s.status === 'open' ? 'نشطة حالياً' : 'مغلقة'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right detail card: Expense registry */}
              <div className="rounded-card border border-line bg-surface p-6">
                <h2 className="text-lg font-bold mb-4">المصروفات النقدية المسجلة</h2>
                <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto">
                  {expensesList.length === 0 ? (
                    <p className="text-sm text-muted text-center py-6">
                      لا توجد مصروفات مسجلة اليوم.
                    </p>
                  ) : (
                    expensesList.map((exp) => (
                      <div
                        key={exp.id}
                        className="p-3 rounded-[10px] bg-surface-2 border border-border text-xs"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold font-display text-text">{exp.reason}</span>
                          <span className="mono font-bold text-alert">
                            -{formatLYD(exp.amount)} د.ل
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-muted">
                          <span>التصنيف: {exp.category}</span>
                          <span>{new Date(exp.createdAt).toLocaleTimeString('ar-LY')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'Reports' &&
          (() => {
            // Calculate last 7 days sales
            const days = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const dateStr = d.toISOString().split('T')[0] || '';
              const dayTotal =
                salesList
                  .filter(
                    (s) => s.status === 'completed' && (s.createdAt?.startsWith(dateStr) || false),
                  )
                  .reduce((sum, s) => sum + s.total, 0) / 1000; // in LYD
              const dayName = d.toLocaleDateString('ar-LY', { weekday: 'short' });
              days.push({ dateStr, dayName, total: dayTotal });
            }

            const maxTotal = Math.max(...days.map((d) => d.total), 1);

            // Calculate payment method breakdown
            const cash =
              salesList
                .filter((s) => s.status === 'completed' && s.paymentMethod === 'cash')
                .reduce((sum, s) => sum + s.total, 0) / 1000;
            const card =
              salesList
                .filter((s) => s.status === 'completed' && s.paymentMethod === 'card')
                .reduce((sum, s) => sum + s.total, 0) / 1000;
            const transfer =
              salesList
                .filter((s) => s.status === 'completed' && s.paymentMethod === 'transfer')
                .reduce((sum, s) => sum + s.total, 0) / 1000;
            const pmTotal = cash + card + transfer || 1;
            const cashPct = Math.round((cash / pmTotal) * 100);
            const cardPct = Math.round((card / pmTotal) * 100);
            const transferPct = Math.round((transfer / pmTotal) * 100);

            // Draw SVG paths for the line chart
            const points = days.map((d, i) => {
              const x = 55 + i * 65;
              const y = 160 - (d.total / maxTotal) * 110;
              return { x, y, ...d };
            });

            const linePath =
              points.length > 0 ? `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}` : '';

            const areaPath =
              points.length > 0
                ? `${linePath} L ${points[points.length - 1]?.x ?? 0} 160 L ${points[0]?.x ?? 0} 160 Z`
                : '';

            return (
              <div className="flex flex-col gap-6">
                <div>
                  <span className="mono text-xs tracking-widest text-copper">
                    البيانات والأرباح
                  </span>
                  <h1 className="text-3xl font-extrabold">التقارير المالية والمبيعات</h1>
                </div>

                {/* Excel Data Export Center */}
                <div className="rounded-card border border-line bg-surface p-5 shadow-sm">
                  <h2 className="text-sm font-bold mb-3 text-text flex items-center gap-2">
                    <Icons.Printer className="text-copper h-4 w-4" />
                    <span>تصدير تقارير الحركة المالية والمخزون إلى Excel</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      onClick={() => handleExportCSV('sales')}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-2 hover:bg-border border border-line text-text rounded-control text-xs font-bold transition-all cursor-pointer"
                    >
                      <Icons.Plus className="h-4 w-4 text-jade rotate-45" />
                      <span>تصدير فواتير المبيعات</span>
                    </button>

                    <button
                      onClick={() => handleExportCSV('products')}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-2 hover:bg-border border border-line text-text rounded-control text-xs font-bold transition-all cursor-pointer"
                    >
                      <Icons.Plus className="h-4 w-4 text-copper rotate-45" />
                      <span>تصدير قائمة المنتجات والمخزون</span>
                    </button>

                    <button
                      onClick={() => handleExportCSV('shifts')}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-2 hover:bg-border border border-line text-text rounded-control text-xs font-bold transition-all cursor-pointer"
                    >
                      <Icons.Plus className="h-4 w-4 text-purple-600" />
                      <span>تصدير سجل التوكات اليومية</span>
                    </button>
                  </div>
                </div>

                {/* Grid 1: Sales log and Financial stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Sales Invoice Log */}
                  <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6 shadow-sm">
                    <h2 className="text-lg font-bold mb-4">سجل الفواتير الأخيرة</h2>

                    <div className="overflow-y-auto max-h-[480px] flex flex-col gap-3">
                      {salesList.map((sale) => (
                        <div
                          key={sale.id}
                          className="p-4 border border-line rounded-[12px] bg-surface-2 flex flex-col gap-2"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-sm text-jade">
                              {sale.invoiceNumber}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {sale.paymentType === 'credit' && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-copper/10 text-copper border border-copper/20">
                                  آجل
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-bold ${sale.status === 'completed' ? 'bg-jade/10 text-jade' : 'bg-red-500/10 text-alert'}`}
                              >
                                {sale.status === 'completed' ? 'مدفوعة' : 'ملغاة'}
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted">
                              المسؤول: {sale.username}
                              {sale.customerName ? ` — العميل: ${sale.customerName}` : ''}
                            </span>
                            <span className="text-muted">
                              طريقة الدفع:{' '}
                              <span className="font-bold text-text">
                                {sale.paymentMethod === 'cash'
                                  ? 'كاش'
                                  : sale.paymentMethod === 'card'
                                    ? 'بطاقة مصرفية'
                                    : 'حوالة مصرفية'}
                              </span>
                            </span>
                            <span className="mono">
                              {new Date(sale.createdAt).toLocaleString('ar-LY')}
                            </span>
                          </div>

                          <div className="border-t border-dashed border-border pt-2 mt-1 flex justify-between items-center">
                            <div className="mono font-bold text-sm">
                              الإجمالي: {formatLYD(sale.total)} د.ل
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => openInvoicePrint(sale)}
                                className="text-xs bg-surface border border-border px-2.5 py-1 rounded hover:bg-surface-2 transition-all cursor-pointer"
                              >
                                عرض وطباعة
                              </button>
                              {sale.status === 'completed' && (
                                <button
                                  onClick={() => handleCancelInvoice(sale)}
                                  className="text-xs bg-red-500/5 text-alert border border-red-500/20 px-2.5 py-1 rounded hover:bg-red-500/10 transition-all cursor-pointer"
                                >
                                  إلغاء الفاتورة
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Profitability Summary */}
                  <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col gap-6">
                    <h2 className="text-lg font-bold">أداء النشاط المالي اليومي</h2>

                    <div className="flex flex-col gap-4">
                      <div className="p-4 rounded-control bg-surface-2 border border-border">
                        <span className="text-xs text-muted block">صافي مبيعات كاش</span>
                        <span className="mono text-xl font-bold text-jade">
                          {formatLYD(
                            salesList
                              .filter((s) => s.status === 'completed' && s.paymentMethod === 'cash')
                              .reduce((sum, s) => sum + s.total, 0),
                          )}{' '}
                          د.ل
                        </span>
                      </div>

                      <div className="p-4 rounded-control bg-surface-2 border border-border">
                        <span className="text-xs text-muted block">صافي مبيعات بطاقة مصرفية</span>
                        <span className="mono text-xl font-bold text-purple-600">
                          {formatLYD(
                            salesList
                              .filter((s) => s.status === 'completed' && s.paymentMethod === 'card')
                              .reduce((sum, s) => sum + s.total, 0),
                          )}{' '}
                          د.ل
                        </span>
                      </div>

                      <div className="p-4 rounded-control bg-surface-2 border border-border">
                        <span className="text-xs text-muted block">صافي مبيعات حوالة مصرفية</span>
                        <span className="mono text-xl font-bold text-blue-600">
                          {formatLYD(
                            salesList
                              .filter(
                                (s) => s.status === 'completed' && s.paymentMethod === 'transfer',
                              )
                              .reduce((sum, s) => sum + s.total, 0),
                          )}{' '}
                          د.ل
                        </span>
                      </div>

                      <div className="p-4 rounded-control bg-surface-2 border border-border">
                        <span className="text-xs text-muted block">
                          الربح التقريبي اليوم (تقديري من تكلفة الشراء)
                        </span>
                        <span className="mono text-xl font-bold text-copper">
                          {formatLYD(
                            salesList
                              .filter((s) => s.status === 'completed')
                              .reduce((sum, s) => sum + s.total, 0) -
                              productsList.reduce(
                                (sum, p) => sum + p.costPrice * (p.quantity || 0),
                                0,
                              ) *
                                0.05,
                          )}{' '}
                          د.ل
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid 2: Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* SVG Line Chart (Sales Last 7 Days) */}
                  <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col">
                    <h2 className="text-lg font-bold mb-1">منحنى المبيعات اليومية</h2>
                    <p className="text-xs text-muted mb-4 font-semibold">
                      حركة المبيعات خلال الأيام الـ 7 الأخيرة بالدينار
                    </p>

                    <div className="w-full bg-surface-2 border border-line rounded-[12px] p-4 flex justify-center items-center">
                      <svg viewBox="0 0 500 200" className="w-full max-h-[220px]">
                        <defs>
                          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#d4af37" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#d4af37" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Grid Lines */}
                        <line
                          x1="45"
                          y1="40"
                          x2="480"
                          y2="40"
                          stroke="var(--color-line)"
                          strokeDasharray="3,3"
                        />
                        <line
                          x1="45"
                          y1="100"
                          x2="480"
                          y2="100"
                          stroke="var(--color-line)"
                          strokeDasharray="3,3"
                        />
                        <line x1="45" y1="160" x2="480" y2="160" stroke="var(--color-line)" />

                        {/* Area under curve */}
                        {areaPath && <path d={areaPath} fill="url(#salesGrad)" />}

                        {/* Main line curve */}
                        {linePath && (
                          <path
                            d={linePath}
                            fill="none"
                            stroke="#d4af37"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* Day Markers and labels */}
                        {points.map((p, i) => (
                          <g key={i}>
                            <line
                              x1={p.x}
                              y1="40"
                              x2={p.x}
                              y2="160"
                              stroke="var(--color-line)"
                              strokeDasharray="2,2"
                              opacity="0.6"
                            />
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="5.5"
                              fill="var(--color-paper)"
                              stroke="#d4af37"
                              strokeWidth="2.5"
                            />
                            <text
                              x={p.x}
                              y={p.y - 12}
                              textAnchor="middle"
                              className="mono font-bold text-[10px]"
                              fill="var(--color-text)"
                            >
                              {Math.round(p.total)}
                            </text>
                            <text
                              x={p.x}
                              y="180"
                              textAnchor="middle"
                              className="font-semibold text-[10px]"
                              fill="var(--color-muted)"
                            >
                              {p.dayName}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>

                  {/* Horizontal Progress Bars Breakdown Chart (Payment Methods) */}
                  <div className="rounded-card border border-line bg-surface p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <h2 className="text-lg font-bold mb-1">نسب توزيع طرق الدفع</h2>
                      <p className="text-xs text-muted mb-6 font-semibold">
                        مقارنة نسب السداد النقدي، المصرفي، والتحويلات
                      </p>

                      <div className="flex flex-col gap-5">
                        {/* Cash Progress */}
                        <div>
                          <div className="flex justify-between items-center mb-1.5 text-xs font-semibold">
                            <span className="flex items-center gap-1.5 text-jade">
                              <span className="h-2.5 w-2.5 rounded-full bg-jade"></span>
                              <span>نقدًا (كاش)</span>
                            </span>
                            <span className="mono">
                              {cash.toFixed(3)} د.ل ({cashPct}%)
                            </span>
                          </div>
                          <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                            <div
                              className="h-full bg-jade transition-all duration-500 rounded-full"
                              style={{ width: `${cashPct}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Card Progress */}
                        <div>
                          <div className="flex justify-between items-center mb-1.5 text-xs font-semibold">
                            <span className="flex items-center gap-1.5 text-purple-600">
                              <span className="h-2.5 w-2.5 rounded-full bg-purple-600"></span>
                              <span>بطاقة مصرفية</span>
                            </span>
                            <span className="mono">
                              {card.toFixed(3)} د.ل ({cardPct}%)
                            </span>
                          </div>
                          <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                            <div
                              className="h-full bg-purple-600 transition-all duration-500 rounded-full"
                              style={{ width: `${cardPct}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Transfer Progress */}
                        <div>
                          <div className="flex justify-between items-center mb-1.5 text-xs font-semibold">
                            <span className="flex items-center gap-1.5 text-blue-600">
                              <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                              <span>حوالة مصرفية</span>
                            </span>
                            <span className="mono">
                              {transfer.toFixed(3)} د.ل ({transferPct}%)
                            </span>
                          </div>
                          <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
                            <div
                              className="h-full bg-blue-600 transition-all duration-500 rounded-full"
                              style={{ width: `${transferPct}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-border pt-4 mt-6 flex justify-between items-center text-xs">
                      <span className="font-semibold text-muted">إجمالي المبيعات المدفوعة:</span>
                      <span className="mono font-extrabold text-base text-jade">
                        {(cash + card + transfer).toFixed(3)} د.ل
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Settings Tab */}
        {activeTab === 'Settings' && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="mono text-xs tracking-widest text-copper">التحكم والإدارة</span>
              <h1 className="text-3xl font-extrabold">الإعدادات العامة للنشاط</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Store Branded details and tax settings */}
              <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
                <h2 className="text-lg font-bold">بيانات النشاط التجاري والفواتير</h2>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await apiCall('/api/settings', 'PUT', settingsData);
                    if (res.success) {
                      triggerToast('تم حفظ الإعدادات والبيانات التجارية بنجاح');
                      loadBaseData();
                    } else {
                      triggerToast(res.error || 'فشل حفظ الإعدادات', 'alert');
                    }
                  }}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-semibold">
                        اسم النشاط (يظهر في الفاتورة)
                      </label>
                      <input
                        type="text"
                        value={settingsData?.businessName || ''}
                        onChange={(e) =>
                          setSettingsData(
                            settingsData ? { ...settingsData, businessName: e.target.value } : null,
                          )
                        }
                        className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold">هاتف النشاط</label>
                      <input
                        type="text"
                        value={settingsData?.businessPhone || ''}
                        onChange={(e) =>
                          setSettingsData(
                            settingsData
                              ? { ...settingsData, businessPhone: e.target.value }
                              : null,
                          )
                        }
                        className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold">العنوان التفصيلي</label>
                    <input
                      type="text"
                      value={settingsData?.businessAddress || ''}
                      onChange={(e) =>
                        setSettingsData(
                          settingsData
                            ? { ...settingsData, businessAddress: e.target.value }
                            : null,
                        )
                      }
                      className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                    />
                  </div>

                  <div className="border-t border-line my-2 pt-4">
                    <h3 className="font-bold text-sm mb-3">إعدادات الضرائب المحلية</h3>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                        <input
                          type="checkbox"
                          checked={settingsData?.taxEnabled || false}
                          onChange={(e) =>
                            setSettingsData(
                              settingsData
                                ? { ...settingsData, taxEnabled: e.target.checked }
                                : null,
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300 text-jade focus:ring-jade"
                        />
                        <span>تفعيل ضريبة المبيعات الإضافية</span>
                      </label>

                      {settingsData?.taxEnabled && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">نسبة الضريبة (بالميل ×10):</span>
                          <input
                            type="number"
                            value={settingsData?.taxRatePermille || 0}
                            onChange={(e) =>
                              setSettingsData(
                                settingsData
                                  ? { ...settingsData, taxRatePermille: Number(e.target.value) }
                                  : null,
                              )
                            }
                            className="w-20 text-left h-8 rounded border border-border bg-surface px-2 mono text-xs focus-visible:outline-none"
                          />
                          <span className="text-xs text-muted">
                            ({((settingsData?.taxRatePermille || 0) / 10).toFixed(1)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-line my-2 pt-4">
                    <h3 className="font-bold text-sm mb-3">سياسة الخصومات</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        الحد الأقصى للخصم لموظف المبيعات (٪ من الفاتورة):
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={settingsData?.discountCapPercent ?? 10}
                        onChange={(e) =>
                          setSettingsData(
                            settingsData
                              ? { ...settingsData, discountCapPercent: Number(e.target.value) }
                              : null,
                          )
                        }
                        className="w-20 text-left h-8 rounded border border-border bg-surface px-2 mono text-xs focus-visible:outline-none"
                      />
                      <span className="text-xs text-muted">الخصومات الأكبر تتطلب PIN المدير</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-40 py-2.5 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-center"
                  >
                    حفظ البيانات
                  </button>
                </form>
              </div>

              {/* User management and database backups */}
              <div className="flex flex-col gap-6">
                {/* Backups registry */}
                <div className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-bold">النسخ الاحتياطي والاستعادة</h2>

                  <button
                    onClick={triggerManualBackup}
                    className="w-full py-2.5 bg-jade text-white rounded-control text-xs font-bold hover:bg-jade-2 transition-colors cursor-pointer text-center"
                  >
                    إنشاء نسخة احتياطية فورية
                  </button>

                  <div className="border-t border-line pt-3 flex flex-col gap-2">
                    <span className="text-xs text-muted font-bold">
                      ملفات النسخ المتاحة محلياً:
                    </span>
                    <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto">
                      {backupsList.map((bk) => (
                        <div
                          key={bk.filename}
                          className="p-2 rounded bg-surface-2 border border-border flex justify-between items-center text-[10px]"
                        >
                          <div>
                            <div className="font-semibold truncate max-w-[140px]">
                              {bk.filename}
                            </div>
                            <div className="text-[9px] text-muted">{bk.createdAt}</div>
                          </div>
                          <button
                            onClick={() => handleRestoreDb(bk.filename)}
                            className="bg-white border border-border text-copper px-2 py-0.5 rounded hover:bg-surface-2 transition-colors cursor-pointer"
                          >
                            استرجاع
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Create/Edit employee user */}
                <div className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold">المستخدمون والوصول</h2>
                      <p className="text-xs text-muted mt-0.5">
                        إدارة الطاقم وتعديل كلمات المرور والصلاحيات.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (currentUser.role !== 'manager') {
                          triggerToast('صلاحية المدير مطلوبة لإضافة مستخدمين', 'alert');
                          return;
                        }
                        setShowCreateUserModal(true);
                      }}
                      className="px-3 py-1.5 bg-jade hover:bg-jade-2 text-white rounded-control text-xs font-bold transition-all cursor-pointer"
                    >
                      إضافة مستخدم
                    </button>
                  </div>

                  {/* Users List */}
                  <div className="flex flex-col gap-2 mt-2 max-h-[220px] overflow-y-auto">
                    {usersList.map((usr) => (
                      <div
                        key={usr.id}
                        className="p-3 rounded bg-surface-2 border border-border flex justify-between items-center"
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{usr.username}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                usr.role === 'manager'
                                  ? 'bg-jade/10 text-jade border border-jade/30'
                                  : 'bg-copper/10 text-copper border border-copper/30'
                              }`}
                            >
                              {usr.role === 'manager' ? 'مدير' : 'بائع'}
                            </span>
                            {!usr.active && (
                              <span className="rounded-full bg-red-500/10 text-red-500 border border-red-500/30 px-2 py-0.5 text-[9px] font-bold">
                                معطل
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted mt-1 font-mono">
                            حالة المستخدم: {usr.active ? 'نشط ومفعل' : 'موقوف'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (currentUser.role !== 'manager') {
                              triggerToast('صلاحية المدير مطلوبة لتعديل المستخدمين', 'alert');
                              return;
                            }
                            setEditingUser(usr);
                            setEditUserForm({
                              password: '', // blank by default (only change if entered)
                              pin: '', // reset pin input
                              role: usr.role,
                              active: usr.active,
                            });
                            setShowEditUserModal(true);
                          }}
                          className="px-2.5 py-1 text-xs border border-border bg-surface hover:bg-border rounded transition-all cursor-pointer text-muted hover:text-text font-bold"
                        >
                          تعديل البيانات / كلمة المرور
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Logs Viewer Section */}
            <div className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">سجل العمليات والرقابة (Audit Logs)</h2>
                  <p className="text-xs text-muted mt-0.5">
                    تتبع تاريخ العمليات الحساسة، تسجيل الدخول، والموافقات الإدارية في النظام.
                  </p>
                </div>
                <button
                  onClick={() => refreshAllData()}
                  className="px-3 py-1.5 bg-surface-2 border border-border text-muted hover:text-text rounded-control text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  تحديث السجل
                </button>
              </div>

              <div className="border border-border rounded-control overflow-hidden">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-surface-2 border-b border-border text-xs font-bold text-muted">
                      <th className="p-3">التاريخ والوقت</th>
                      <th className="p-3">المستخدم</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">تفاصيل العملية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {auditLogsList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted font-semibold">
                          لا توجد عمليات مسجلة حالياً.
                        </td>
                      </tr>
                    ) : (
                      auditLogsList.map((log) => (
                        <tr key={log.id} className="hover:bg-surface-2/40 transition-colors">
                          <td className="p-3 mono font-semibold text-muted">
                            {new Date(log.createdAt).toLocaleString('ar-LY')}
                          </td>
                          <td className="p-3 font-bold text-text">
                            {log.username || 'نظام تلقائي'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                log.action === 'login' || log.action === 'pin_switch'
                                  ? 'bg-jade/10 text-jade'
                                  : log.action === 'manager_override'
                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                    : log.action === 'cancel_sale'
                                      ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                                      : 'bg-copper/10 text-copper'
                              }`}
                            >
                              {log.action === 'login'
                                ? 'تسجيل دخول'
                                : log.action === 'pin_switch'
                                  ? 'تبديل سريع'
                                  : log.action === 'manager_override'
                                    ? 'موافقة المدير'
                                    : log.action === 'cancel_sale'
                                      ? 'إلغاء فاتورة'
                                      : log.action === 'update_user'
                                        ? 'تعديل مستخدم'
                                        : log.action === 'update_settings'
                                          ? 'تعديل إعدادات'
                                          : log.action === 'adjust_stock'
                                            ? 'تسوية مخزون'
                                            : log.action}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-muted leading-relaxed">
                            {log.details}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* OVERLAY MODALS */}

      {/* 1. Quick Switch User PIN Pad Modal */}
      {showUserPinModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[320px] rounded-card border border-line bg-surface p-6 shadow-md text-center">
            <h3 className="font-display font-extrabold text-base mb-4">
              أدخل رمز PIN للتبديل السريع
            </h3>

            <input
              type="password"
              maxLength={4}
              readOnly
              value={switchPinValue}
              className="w-full text-center h-12 rounded-control border border-line bg-surface-2 mb-6 font-mono text-2xl tracking-[0.5em] focus:outline-none"
            />

            <div className="grid grid-cols-3 gap-2.5 justify-center mb-6 max-w-[240px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() =>
                    switchPinValue.length < 4 && setSwitchPinValue(switchPinValue + num)
                  }
                  className="w-14 h-14 rounded-full border border-line bg-surface-2 text-lg font-mono font-bold hover:bg-border transition-colors cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={() => setSwitchPinValue('')}
                className="w-14 h-14 rounded-full border border-line bg-red-500/5 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                مسح
              </button>
              <button
                onClick={() => switchPinValue.length < 4 && setSwitchPinValue(switchPinValue + '0')}
                className="w-14 h-14 rounded-full border border-line bg-surface-2 text-lg font-mono font-bold hover:bg-border transition-colors cursor-pointer"
              >
                0
              </button>
              <button
                onClick={() => {
                  if (switchPinValue.length === 4) {
                    handlePinSwitch(switchPinValue);
                  }
                }}
                className="w-14 h-14 rounded-full border border-jade/20 bg-jade text-white text-xs font-bold hover:bg-jade-2 transition-colors cursor-pointer"
              >
                تأكيد
              </button>
            </div>

            <button
              onClick={() => setShowUserPinModal(false)}
              className="w-full py-2 bg-surface-2 border border-border rounded-control text-xs font-bold text-muted hover:text-text transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* 2. Manager PIN Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleVerifyOverridePinSubmit}
            className="w-full max-w-[340px] rounded-card border border-line bg-surface p-6 shadow-md text-center"
          >
            <h3 className="font-display font-extrabold text-base mb-2">طلب موافقة المدير</h3>
            <p className="text-xs text-copper bg-copper/5 border border-copper/20 rounded p-2 mb-4 font-semibold">
              {overrideModalReason}
            </p>

            <input
              type="password"
              placeholder="أدخل رمز PIN للمدير"
              maxLength={4}
              value={checkoutOverridePin}
              onChange={(e) => setCheckoutOverridePin(e.target.value)}
              className="w-full text-center h-12 rounded-control border border-line bg-surface-2 mb-6 font-mono text-2xl tracking-[0.5em] focus-visible:outline-none"
            />

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                موافق (تأكيد)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverrideModal(false);
                  setCheckoutOverridePin('');
                }}
                className="flex-1 py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Open Shift Modal */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleOpenShiftSubmit}
            className="w-full max-w-[360px] rounded-card border border-line bg-surface p-6 shadow-md"
          >
            <h3 className="font-display font-extrabold text-base mb-4">
              بدء تشغيل الخزينة والتوكة
            </h3>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">
                مبلغ رصيد درج الكاش الافتتاحي (د.ل)
              </label>
              <input
                type="number"
                step="0.050"
                value={openShiftForm.openingCash}
                onChange={(e) => setOpenShiftForm({ openingCash: e.target.value })}
                className="w-full h-11 rounded-control border border-line bg-surface-2 px-3 text-sm focus-visible:outline-none font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                فتح التوكة وتأكيد الدرج
              </button>
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(false)}
                className="flex-1 py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Close Shift Modal */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCloseShiftSubmit}
            className="w-full max-w-[360px] rounded-card border border-line bg-surface p-6 shadow-md"
          >
            <h3 className="font-display font-extrabold text-base mb-4">إنهاء التوكة وجرد الدرج</h3>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">
                إجمالي المبلغ النقدي المكتشف فعلياً بالدرج (د.ل)
              </label>
              <input
                type="number"
                step="0.050"
                value={closeShiftForm.actualCash}
                onChange={(e) => setCloseShiftForm({ actualCash: e.target.value })}
                className="w-full h-11 rounded-control border border-line bg-surface-2 px-3 text-sm focus-visible:outline-none font-mono"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                تأكيد الجرد وإغلاق التوكة
              </button>
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                className="flex-1 py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleProductSubmit}
            className="w-full max-w-[600px] rounded-card border border-line bg-surface p-6 shadow-md my-8"
          >
            <h3 className="font-display font-extrabold text-lg mb-4">
              {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج أو جهاز جديد'}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">اسم المنتج</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">التصنيف</label>
                <input
                  type="text"
                  required
                  value={productForm.category}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  placeholder="مثال: البن، المكائن، الأكواب"
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">
                صورة المنتج (JPG / PNG / WebP — حتى 2 ميجابايت)
              </label>
              <div className="flex items-center gap-3">
                {editingProduct?.imageUrl && !productImageFile && (
                  <img
                    src={editingProduct.imageUrl}
                    alt=""
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    className="h-12 w-12 object-cover rounded border border-line"
                  />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setProductImageFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-border file:bg-surface-2 file:text-xs file:font-bold file:cursor-pointer cursor-pointer"
                />
              </div>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={productForm.taxExempt}
                  onChange={(e) => setProductForm({ ...productForm, taxExempt: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-jade focus:ring-jade"
                />
                <span>معفي من ضريبة المبيعات (حتى عند تفعيل الضريبة)</span>
              </label>
            </div>

            <div className="mb-4 border border-line rounded-control p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold">
                  وحدات التعبئة (اختياري) — المخزون يُحسب دائماً بالوحدة الأساسية
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setProductUnitsForm([
                      ...productUnitsForm,
                      { unitName: '', conversionFactor: '2', price: '0.000' },
                    ])
                  }
                  className="text-xs text-jade font-bold border border-jade/30 bg-jade/5 px-2 py-1 rounded hover:bg-jade/10 cursor-pointer"
                >
                  + إضافة وحدة
                </button>
              </div>
              {productUnitsForm.length === 0 ? (
                <p className="text-[10px] text-muted">
                  مثال: كرتونة = 20 {productForm.baseUnit || 'قطعة'} بسعر خاص بها.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {productUnitsForm.map((u, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="اسم الوحدة (كرتونة)"
                        value={u.unitName}
                        onChange={(e) =>
                          setProductUnitsForm(
                            productUnitsForm.map((row, i) =>
                              i === idx ? { ...row, unitName: e.target.value } : row,
                            ),
                          )
                        }
                        className="flex-1 h-9 rounded border border-line bg-surface px-2 text-xs focus-visible:outline-none"
                      />
                      <span className="text-[10px] text-muted whitespace-nowrap">=</span>
                      <input
                        type="number"
                        min={2}
                        title={`كم ${productForm.baseUnit || 'وحدة أساسية'} في هذه الوحدة`}
                        value={u.conversionFactor}
                        onChange={(e) =>
                          setProductUnitsForm(
                            productUnitsForm.map((row, i) =>
                              i === idx ? { ...row, conversionFactor: e.target.value } : row,
                            ),
                          )
                        }
                        className="w-20 h-9 rounded border border-line bg-surface px-2 mono text-xs text-left focus-visible:outline-none"
                      />
                      <span className="text-[10px] text-muted whitespace-nowrap">
                        {productForm.baseUnit || 'وحدة'} — السعر:
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={u.price}
                        onChange={(e) =>
                          setProductUnitsForm(
                            productUnitsForm.map((row, i) =>
                              i === idx ? { ...row, price: e.target.value } : row,
                            ),
                          )
                        }
                        className="w-24 h-9 rounded border border-line bg-surface px-2 mono text-xs text-left focus-visible:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProductUnitsForm(productUnitsForm.filter((_, i) => i !== idx))
                        }
                        className="text-alert text-xs font-bold px-2 py-1 border border-alert/30 rounded hover:bg-alert/10 cursor-pointer"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4 border border-line rounded-control p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold">
                  مكونات الباقة (اختياري) — البيع يخصم كل المكونات من المخزون
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setProductComponentsForm([
                      ...productComponentsForm,
                      { componentProductId: '', quantity: '1' },
                    ])
                  }
                  className="text-xs text-copper font-bold border border-copper/30 bg-copper/5 px-2 py-1 rounded hover:bg-copper/10 cursor-pointer"
                >
                  + إضافة مكون
                </button>
              </div>
              {productComponentsForm.length === 0 ? (
                <p className="text-[10px] text-muted">
                  منتج بمكونات = باقة تجهيز تباع بسعرها الخاص؛ مخزون الباقة نفسه لا يُستخدم.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {productComponentsForm.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={c.componentProductId}
                        onChange={(e) =>
                          setProductComponentsForm(
                            productComponentsForm.map((row, i) =>
                              i === idx ? { ...row, componentProductId: e.target.value } : row,
                            ),
                          )
                        }
                        className="flex-1 h-9 rounded border border-line bg-surface px-2 text-xs focus-visible:outline-none"
                      >
                        <option value="">اختر المكون…</option>
                        {productsList
                          .filter(
                            (p) => p.id !== editingProduct?.id && (p.components?.length ?? 0) === 0,
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (متاح: {p.quantity})
                            </option>
                          ))}
                      </select>
                      <span className="text-[10px] text-muted whitespace-nowrap">الكمية:</span>
                      <input
                        type="number"
                        min={1}
                        value={c.quantity}
                        onChange={(e) =>
                          setProductComponentsForm(
                            productComponentsForm.map((row, i) =>
                              i === idx ? { ...row, quantity: e.target.value } : row,
                            ),
                          )
                        }
                        className="w-20 h-9 rounded border border-line bg-surface px-2 mono text-xs text-left focus-visible:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setProductComponentsForm(
                            productComponentsForm.filter((_, i) => i !== idx),
                          )
                        }
                        className="text-alert text-xs font-bold px-2 py-1 border border-alert/30 rounded hover:bg-alert/10 cursor-pointer"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">النوع</label>
                <select
                  disabled={!!editingProduct}
                  value={productForm.type}
                  onChange={(e) => setProductForm({ ...productForm, type: e.target.value as any })}
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                >
                  <option value="consumable">مادة استهلاكية (صلاحية وباتش)</option>
                  <option value="equipment">معدة / جهاز (سيريال وضمان)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">الوحدة الأساسية</label>
                <input
                  type="text"
                  required
                  value={productForm.baseUnit}
                  onChange={(e) => setProductForm({ ...productForm, baseUnit: e.target.value })}
                  placeholder="قطعة، كيلو، صندوق"
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">الباركود (إن وجد)</label>
                <input
                  type="text"
                  value={productForm.barcode}
                  onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">سعر الشراء (د.ل)</label>
                <input
                  type="number"
                  step="0.050"
                  value={productForm.costPrice}
                  onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none mono"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">
                  سعر البيع الافتراضي (د.ل)
                </label>
                <input
                  type="number"
                  step="0.050"
                  value={productForm.retailPrice}
                  onChange={(e) => setProductForm({ ...productForm, retailPrice: e.target.value })}
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none mono"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">حد إعادة الطلب</label>
                <input
                  type="number"
                  value={productForm.reorderPoint}
                  onChange={(e) => setProductForm({ ...productForm, reorderPoint: e.target.value })}
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none mono"
                />
              </div>
            </div>

            {/* Type-Specific Fields */}
            {productForm.type === 'equipment' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-control border border-dashed border-border bg-surface-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">
                    الرقم التسلسلي (Serial Number)
                  </label>
                  <input
                    type="text"
                    value={productForm.serialNumber}
                    onChange={(e) =>
                      setProductForm({ ...productForm, serialNumber: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">مدة الضمان (بالأشهر)</label>
                  <input
                    type="number"
                    value={productForm.warrantyMonths}
                    onChange={(e) =>
                      setProductForm({ ...productForm, warrantyMonths: e.target.value })
                    }
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-control border border-dashed border-border bg-surface-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">
                    رقم التشغيلة (Batch Number)
                  </label>
                  <input
                    type="text"
                    value={productForm.batchNo}
                    onChange={(e) => setProductForm({ ...productForm, batchNo: e.target.value })}
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">تاريخ انتهاء الصلاحية</label>
                  <input
                    type="date"
                    value={productForm.expiryDate}
                    onChange={(e) => setProductForm({ ...productForm, expiryDate: e.target.value })}
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                  />
                </div>
              </div>
            )}

            {!editingProduct && (
              <div className="mb-6">
                <label className="mb-1 block text-xs font-semibold">
                  الرصيد الابتدائي المتوفر حالياً بالمخزن
                </label>
                <input
                  type="number"
                  value={productForm.quantity}
                  onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none mono"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                حفظ بيانات المنتج
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                }}
                className="flex-1 py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. Stock Manual Adjustment Modal */}
      {showAdjustModal && adjustingProduct && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAdjustStockSubmit}
            className="w-full max-w-[380px] rounded-card border border-line bg-surface p-6 shadow-md"
          >
            <h3 className="font-display font-extrabold text-base mb-2">
              تسوية كمية المخزون يدوياً
            </h3>
            <p className="text-xs text-muted mb-4 font-semibold">
              المنتج الحالي: {adjustingProduct.name}
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">
                كمية التعديل (سالب للخصم، موجب للإضافة)
              </label>
              <input
                type="number"
                required
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                placeholder="مثال: +10 أو -5"
                className="w-full h-10 rounded-control border border-line bg-surface-2 px-3 text-sm focus-visible:outline-none mono"
              />
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-xs font-semibold">سبب التسوية الإلزامي</label>
              <input
                type="text"
                required
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                placeholder="مثال: بضاعة تالفة، جرد سنوي"
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                تأكيد حركة التسوية
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAdjustModal(false);
                  setAdjustingProduct(null);
                }}
                className="flex-1 py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 7. Record Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleExpenseSubmit}
            className="w-full max-w-[380px] rounded-card border border-line bg-surface p-6 shadow-md"
          >
            <h3 className="font-display font-extrabold text-base mb-4">
              تسجيل مصروف نقدي من الدرج
            </h3>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">قيمة المصروف (د.ل)</label>
              <input
                type="number"
                step="0.050"
                required
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                className="w-full h-10 rounded-control border border-line bg-surface-2 px-3 text-sm focus-visible:outline-none font-mono"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">تصنيف المصروف</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              >
                <option value="supplies">قرطاسية ومستلزمات</option>
                <option value="cleaning">مواد تنظيف وصيانة</option>
                <option value="food">ضيافة ووجبات طاقم</option>
                <option value="other">مصاريف عامة أخرى</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-xs font-semibold">السبب بالتفصيل</label>
              <input
                type="text"
                required
                value={expenseForm.reason}
                onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
                placeholder="تفاصيل صرف المبلغ"
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-alert text-white text-xs font-bold rounded-control hover:bg-red-600 transition-colors cursor-pointer"
              >
                تسجيل وصرف المبلغ
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="flex-1 py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8. Register User Modal (Manager only) */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUserSubmit}
            className="w-full max-w-[380px] rounded-card border border-line bg-surface p-6 shadow-md"
          >
            <h3 className="font-display font-extrabold text-base mb-4">
              إضافة مستخدم أو بائع جديد
            </h3>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">اسم المستخدم (للدخول)</label>
              <input
                type="text"
                required
                value={createUserForm.username}
                onChange={(e) => setCreateUserForm({ ...createUserForm, username: e.target.value })}
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">كلمة المرور</label>
              <input
                type="password"
                required
                value={createUserForm.password}
                onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">رمز PIN السريع (4 أرقام)</label>
              <input
                type="text"
                maxLength={4}
                required
                value={createUserForm.pin}
                onChange={(e) => setCreateUserForm({ ...createUserForm, pin: e.target.value })}
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none font-mono"
              />
            </div>

            <div className="mb-6">
              <label className="mb-1 block text-xs font-semibold">الصلاحية</label>
              <select
                value={createUserForm.role}
                onChange={(e) =>
                  setCreateUserForm({ ...createUserForm, role: e.target.value as any })
                }
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              >
                <option value="sales">بائع (نقاط البيع والتوكة فقط)</option>
                <option value="manager">مدير كامل الصلاحيات</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                إنشاء المستخدم الجديد
              </button>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="flex-1 py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8.5. Edit User Modal (Manager only) */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleEditUserSubmit}
            className="w-full max-w-[380px] rounded-card border border-line bg-surface p-6 shadow-md"
          >
            <h3 className="font-display font-extrabold text-base mb-2">
              تعديل بيانات المستخدم: {editingUser.username}
            </h3>
            <p className="text-xs text-muted mb-4 font-semibold">
              اترك حقل كلمة المرور فارغاً إذا كنت لا ترغب في تغييره.
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">
                كلمة المرور الجديدة (اختياري)
              </label>
              <input
                type="password"
                value={editUserForm.password}
                onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                placeholder="أدخل كلمة مرور جديدة"
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">
                رمز PIN السريع الجديد (4 أرقام - اختياري)
              </label>
              <input
                type="text"
                maxLength={4}
                value={editUserForm.pin}
                onChange={(e) => setEditUserForm({ ...editUserForm, pin: e.target.value })}
                placeholder="تحديث رمز PIN"
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none font-mono"
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold">الصلاحية</label>
              <select
                value={editUserForm.role}
                onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as any })}
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              >
                <option value="sales">بائع (نقاط البيع والتوكة فقط)</option>
                <option value="manager">مدير كامل الصلاحيات</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
                <input
                  type="checkbox"
                  checked={editUserForm.active}
                  onChange={(e) => setEditUserForm({ ...editUserForm, active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-jade focus:ring-jade"
                />
                <span>الحساب نشط ومفعل</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                حفظ التعديلات
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditUserModal(false);
                  setEditingUser(null);
                }}
                className="flex-1 py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 9. Branded Invoice Print Preview Modal (A4 / 80mm Template Switcher) */}
      {showPrintModal && printingSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="w-full max-w-[680px] rounded-card border border-line bg-surface p-6 shadow-md my-8 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="font-display font-extrabold text-base">
                معاينة وطباعة الفاتورة {printingSale.invoiceNumber}
              </h3>
              <button
                onClick={() => {
                  setShowPrintModal(false);
                  setPrintingSale(null);
                }}
                className="text-xs border border-border px-3 py-1.5 rounded hover:bg-surface-2 transition-all cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>

            {/* Template switcher */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {(
                  [
                    ['a4', 'فاتورة A4'],
                    ['thermal', 'إيصال حراري 80mm'],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setPrintMode(mode)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-control border cursor-pointer transition-colors ${
                      printMode === mode
                        ? 'bg-jade text-white border-jade'
                        : 'bg-surface text-muted border-border hover:text-text'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowInvoiceControls(!showInvoiceControls)}
                className="text-xs text-muted border border-border px-3 py-1.5 rounded hover:bg-surface-2 cursor-pointer"
              >
                خيارات الفاتورة {showInvoiceControls ? '▲' : '▼'}
              </button>
            </div>

            {/* Per-print overrides (customer name, warranty notes, stamp title) */}
            {showInvoiceControls && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 border border-line rounded-control bg-surface-2/40">
                <div>
                  <label className="text-[10px] font-bold text-muted mb-1 block">اسم العميل</label>
                  <input
                    type="text"
                    value={overrideCustomerName}
                    onChange={(e) => setOverrideCustomerName(e.target.value)}
                    className="w-full h-8 rounded border border-line bg-surface px-2 text-xs focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted mb-1 block">
                    شروط ضمان مخصصة
                  </label>
                  <input
                    type="text"
                    value={overrideWarrantyNotes}
                    onChange={(e) => setOverrideWarrantyNotes(e.target.value)}
                    placeholder={settingsData?.warrantyTerms || ''}
                    className="w-full h-8 rounded border border-line bg-surface px-2 text-xs focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted mb-1 block">عنوان الختم</label>
                  <input
                    type="text"
                    value={overrideStampTitle}
                    onChange={(e) => setOverrideStampTitle(e.target.value)}
                    placeholder={settingsData?.stampTitle || settingsData?.businessName || ''}
                    className="w-full h-8 rounded border border-line bg-surface px-2 text-xs focus-visible:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Live preview of exactly what will print */}
            <div className="border border-border p-4 bg-white rounded-[4px] max-h-[420px] overflow-y-auto relative select-none">
              {/* Status rubber stamp (preview only, design.md §2.2) */}
              {printingSale.status === 'cancelled' && (
                <div className="absolute top-8 right-8 z-10 border-[2.5px] border-alert text-alert text-[11px] font-extrabold px-3 py-1 rounded rotate-[-8deg] opacity-80 uppercase tracking-widest font-display">
                  ملغاة / مرتجع
                </div>
              )}
              {printMode === 'a4' ? renderA4Invoice() : renderThermalReceipt()}
            </div>

            {/* Print Action Buttons */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-line">
              <button
                onClick={() => {
                  window.print();
                }}
                className="py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
              >
                <Icons.Printer />
                <span>بدء الطباعة الآن</span>
              </button>

              <button
                onClick={() => {
                  setShowPrintModal(false);
                  setPrintingSale(null);
                }}
                className="py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer text-center"
              >
                تخطي وطباعة لاحقاً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden on screen, these are the elements the browser actually prints. */}
      {showPrintModal && printingSale && (
        <div className="print-only">
          {printMode === 'thermal' && <style>{'@page { size: 80mm auto; margin: 3mm; }'}</style>}
          {printMode === 'a4' ? renderA4Invoice() : renderThermalReceipt()}
        </div>
      )}
      {!showPrintModal && showCustomerStatementModal && statementData && (
        <div className="print-only">{renderStatementA4()}</div>
      )}
      {!showPrintModal &&
        !showCustomerStatementModal &&
        showQuotationPrintModal &&
        printingQuotation && <div className="print-only">{renderQuotationA4()}</div>}

      {/* Global Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pointer-events-none">
          <div
            className={`px-6 py-3 rounded-full text-white text-sm font-bold shadow-lg animate-bounce ${toastType === 'success' ? 'bg-jade' : 'bg-alert'}`}
          >
            {toastMessage}
          </div>
        </div>
      )}

      {/* ─── Shift Close Summary Modal ─── */}
      {showShiftSummaryModal && shiftCloseSummary && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-xl flex flex-col gap-5">
            <div className="flex items-center gap-3 pb-4 border-b border-line">
              <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-jade/10 text-jade">
                <Icons.CheckCircle />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base">ملخص إغلاق التوكة</h3>
                <p className="text-xs text-muted">تقرير شامل للتوكة المُغلقة للتو</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 p-3 rounded-control">
                <div className="text-xs text-muted mb-0.5">عدد الفواتير</div>
                <div className="font-bold text-lg mono">{shiftCloseSummary.invoiceCount}</div>
              </div>
              <div className="bg-surface-2 p-3 rounded-control">
                <div className="text-xs text-muted mb-0.5">إجمالي المبيعات</div>
                <div className="font-bold text-lg mono text-jade">
                  {formatLYD(shiftCloseSummary.totalSales)} د.ل
                </div>
              </div>
              <div className="bg-surface-2 p-3 rounded-control">
                <div className="text-xs text-muted mb-0.5">مبيعات كاش</div>
                <div className="font-bold mono">{formatLYD(shiftCloseSummary.cashSales)} د.ل</div>
              </div>
              <div className="bg-surface-2 p-3 rounded-control">
                <div className="text-xs text-muted mb-0.5">بطاقة مصرفية</div>
                <div className="font-bold mono">{formatLYD(shiftCloseSummary.cardSales)} د.ل</div>
              </div>
              <div className="bg-surface-2 p-3 rounded-control">
                <div className="text-xs text-muted mb-0.5">حوالة مصرفية</div>
                <div className="font-bold mono">
                  {formatLYD(shiftCloseSummary.transferSales)} د.ل
                </div>
              </div>
              <div className="bg-surface-2 p-3 rounded-control">
                <div className="text-xs text-muted mb-0.5">إجمالي المصروفات</div>
                <div className="font-bold mono text-alert">
                  {formatLYD(shiftCloseSummary.totalExpenses)} د.ل
                </div>
              </div>
            </div>

            <div className="bg-surface-2 p-4 rounded-control flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">رصيد الفتح:</span>
                <span className="mono font-semibold">
                  {formatLYD(shiftCloseSummary.openingCash)} د.ل
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">الرصيد المتوقع:</span>
                <span className="mono font-semibold">
                  {formatLYD(shiftCloseSummary.expectedCash)} د.ل
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">الرصيد الفعلي:</span>
                <span className="mono font-semibold">
                  {formatLYD(shiftCloseSummary.actualCash)} د.ل
                </span>
              </div>
              <div
                className={`flex justify-between text-sm font-bold border-t border-border pt-2 ${shiftCloseSummary.variance === 0 ? 'text-jade' : shiftCloseSummary.variance > 0 ? 'text-jade' : 'text-alert'}`}
              >
                <span>الفارق (عجز/فائض):</span>
                <span className="mono">
                  {shiftCloseSummary.variance > 0 ? '+' : ''}
                  {formatLYD(shiftCloseSummary.variance)} د.ل
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowShiftSummaryModal(false);
                setShiftCloseSummary(null);
              }}
              className="w-full py-3 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
            >
              تم ✓
            </button>
          </div>
        </div>
      )}

      {/* ─── Stock Movements Modal ─── */}
      {showMovementsModal && movementsProduct && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="w-full max-w-2xl rounded-card border border-line bg-surface p-6 shadow-xl flex flex-col gap-4 max-h-[90vh]">
            <div className="flex justify-between items-start pb-3 border-b border-line">
              <div>
                <h3 className="font-display font-extrabold text-base">سجل حركات المخزون</h3>
                <p className="text-xs text-muted mt-0.5">
                  {movementsProduct.name} — الرصيد الحالي:{' '}
                  <strong className="text-jade">
                    {movementsProduct.quantity} {movementsProduct.baseUnit}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setShowMovementsModal(false)}
                className="text-xs border border-border px-3 py-1.5 rounded hover:bg-surface-2 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <div className="overflow-y-auto flex-1 border border-border rounded-control">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-surface-2 sticky top-0">
                  <tr className="border-b border-border font-bold text-muted">
                    <th className="p-2.5">التاريخ</th>
                    <th className="p-2.5">النوع</th>
                    <th className="p-2.5">الكمية</th>
                    <th className="p-2.5">الرصيد بعد</th>
                    <th className="p-2.5">السبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stockMovementsForProduct.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted">
                        لا توجد حركات مسجلة
                      </td>
                    </tr>
                  ) : (
                    stockMovementsForProduct.map((m) => (
                      <tr key={m.id} className="hover:bg-surface-2/40">
                        <td className="p-2.5 mono text-muted">
                          {new Date(m.createdAt).toLocaleString('ar-LY')}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.type === 'sale' ? 'bg-red-500/10 text-red-500' : m.type === 'purchase' ? 'bg-jade/10 text-jade' : 'bg-copper/10 text-copper'}`}
                          >
                            {m.type === 'sale'
                              ? 'بيع'
                              : m.type === 'purchase'
                                ? 'شراء'
                                : m.type === 'adjustment'
                                  ? 'تسوية'
                                  : m.type === 'return'
                                    ? 'مرتجع'
                                    : m.type}
                          </span>
                        </td>
                        <td
                          className={`p-2.5 mono font-bold ${m.quantity > 0 ? 'text-jade' : 'text-alert'}`}
                        >
                          {m.quantity > 0 ? '+' : ''}
                          {m.quantity}
                        </td>
                        <td className="p-2.5 mono font-semibold">{m.balanceAfter}</td>
                        <td className="p-2.5 text-muted">{m.reason || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Customer Payment Modal ─── */}
      {showCustomerPaymentModal && payingCustomer && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-xl">
            <h3 className="font-display font-extrabold text-base mb-4">تسجيل سداد من العميل</h3>
            <p className="text-sm text-muted mb-4">
              العميل: <strong className="text-text">{payingCustomer.name}</strong> — رصيد الدين:{' '}
              <strong className="text-alert">{formatLYD(payingCustomer.creditBalance)} د.ل</strong>
            </p>
            <form onSubmit={handleCustomerPayment} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-muted mb-1 block">
                  المبلغ المدفوع (د.ل)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={customerPaymentAmount}
                  onChange={(e) => setCustomerPaymentAmount(e.target.value)}
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm mono font-semibold focus-visible:outline-none"
                />
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 cursor-pointer"
                >
                  تسجيل السداد
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerPaymentModal(false);
                    setPayingCustomer(null);
                  }}
                  className="flex-1 py-2.5 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Add/Edit Customer Modal ─── */}
      {showCustomerModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-xl">
            <h3 className="font-display font-extrabold text-base mb-4">
              {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
            </h3>
            <form onSubmit={handleCustomerSubmit} className="flex flex-col gap-3">
              {['name', 'phone', 'address', 'notes'].map((field) => (
                <div key={field}>
                  <label className="text-xs font-bold text-muted mb-1 block">
                    {field === 'name'
                      ? 'اسم العميل *'
                      : field === 'phone'
                        ? 'رقم الهاتف'
                        : field === 'address'
                          ? 'العنوان'
                          : 'ملاحظات'}
                  </label>
                  <input
                    type="text"
                    required={field === 'name'}
                    value={(customerForm as any)[field]}
                    onChange={(e) => setCustomerForm({ ...customerForm, [field]: e.target.value })}
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-bold text-muted mb-1 block">فئة التسعير</label>
                <div className="flex gap-2">
                  {(
                    [
                      ['retail', 'تجزئة'],
                      ['wholesale', 'جملة'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCustomerForm({ ...customerForm, tier: value })}
                      className={`flex-1 py-2 text-sm font-bold rounded-control border cursor-pointer transition-colors ${
                        customerForm.tier === value
                          ? 'bg-jade text-white border-jade'
                          : 'bg-surface text-muted border-border hover:text-text'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted mt-1">
                  عملاء الجملة يحصلون تلقائياً على سعر الجملة للمنتجات التي لها سعر جملة.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold text-muted mb-1 block">
                  سقف الائتمان (د.ل) — 0 يعني بدون حد
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customerForm.creditLimit}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, creditLimit: e.target.value })
                  }
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 mono text-sm text-left focus-visible:outline-none"
                />
                <p className="text-[10px] text-muted mt-1">
                  الفواتير الآجلة التي تتجاوز السقف تتطلب موافقة المدير وتُسجل في سجل المراجعة.
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 cursor-pointer"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerModal(false);
                    setEditingCustomer(null);
                  }}
                  className="flex-1 py-2.5 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Quotation Print Preview Modal (A4) ─── */}
      {showQuotationPrintModal && printingQuotation && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto no-print"
          dir="rtl"
        >
          <div className="w-full max-w-[680px] rounded-card border border-line bg-surface p-6 shadow-md my-8 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="font-display font-extrabold text-base">
                معاينة عرض السعر {printingQuotation.quoteNumber}
              </h3>
              <button
                onClick={() => {
                  setShowQuotationPrintModal(false);
                  setPrintingQuotation(null);
                }}
                className="text-xs border border-border px-3 py-1.5 rounded hover:bg-surface-2 transition-all cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>

            {/* Live preview of exactly what will print */}
            <div className="border border-border p-4 bg-white rounded-[4px] max-h-[420px] overflow-y-auto relative select-none">
              {printingQuotation.status !== 'active' && (
                <div
                  className={`absolute top-8 right-8 z-10 border-[2.5px] text-[11px] font-extrabold px-3 py-1 rounded rotate-[-8deg] opacity-80 uppercase tracking-widest font-display ${
                    printingQuotation.status === 'converted'
                      ? 'border-jade text-jade'
                      : 'border-alert text-alert'
                  }`}
                >
                  {quotationStatusLabel(printingQuotation.status)}
                </div>
              )}
              {renderQuotationA4()}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-line">
              <button
                onClick={() => window.print()}
                className="py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
              >
                <Icons.Printer />
                <span>طباعة عرض السعر (A4)</span>
              </button>
              <button
                onClick={() => {
                  setShowQuotationPrintModal(false);
                  setPrintingQuotation(null);
                }}
                className="py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer text-center"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Take Deposit Modal ─── */}
      {showDepositModal && depositCustomer && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          dir="rtl"
        >
          <form
            onSubmit={handleDepositSubmit}
            className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-xl"
          >
            <h3 className="font-display font-extrabold text-base mb-1">
              استلام عربون — {depositCustomer.name}
            </h3>
            <p className="text-xs text-muted mb-4">
              يدخل المبلغ إلى درج التوكة المفتوحة، ويُخصم لاحقاً من الفاتورة النهائية.
            </p>

            <div className="mb-3">
              <label className="text-xs font-bold text-muted mb-1 block">قيمة العربون (د.ل)</label>
              <input
                type="text"
                inputMode="decimal"
                required
                value={depositForm.amount}
                onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })}
                className="w-full h-10 rounded-control border border-line bg-surface px-3 mono text-sm text-left focus-visible:outline-none"
              />
            </div>

            <div className="mb-3">
              <label className="text-xs font-bold text-muted mb-1 block">
                حجز جهاز (اختياري — يخصم وحدة من المتاح للبيع)
              </label>
              <select
                value={depositForm.productId}
                onChange={(e) => setDepositForm({ ...depositForm, productId: e.target.value })}
                className="w-full h-10 rounded-control border border-line bg-surface px-2 text-sm focus-visible:outline-none"
              >
                <option value="">بدون حجز</option>
                {productsList
                  .filter((p) => (p.components?.length ?? 0) === 0)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (متاح: {p.quantity - (p.reservedQuantity || 0)})
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-muted mb-1 block">ملاحظات</label>
              <input
                type="text"
                value={depositForm.notes}
                onChange={(e) => setDepositForm({ ...depositForm, notes: e.target.value })}
                className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 cursor-pointer"
              >
                استلام العربون
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDepositModal(false);
                  setDepositCustomer(null);
                }}
                className="flex-1 py-2.5 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Supplier Return Modal (manager only) ─── */}
      {showReturnModal && returnPurchase && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          dir="rtl"
        >
          <form
            onSubmit={handlePurchaseReturnSubmit}
            className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-xl"
          >
            <h3 className="font-display font-extrabold text-base mb-1">
              مرتجع مشتريات — {returnPurchase.invoiceNumber}
            </h3>
            <p className="text-xs text-muted mb-4">
              المورد: {returnPurchase.supplierName || 'بدون مورد'} — تنقص الكميات المرتجعة من
              المخزون فوراً.
            </p>

            <div className="max-h-60 overflow-y-auto border border-line rounded-control mb-4">
              <table className="w-full text-right text-xs">
                <thead className="bg-surface-2 border-b border-line">
                  <tr className="font-bold text-muted">
                    <th className="p-2">الصنف</th>
                    <th className="p-2 text-center">المشتراة</th>
                    <th className="p-2 text-center">أُرجعت سابقاً</th>
                    <th className="p-2 text-center">كمية المرتجع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(returnPurchase.items || []).map((item: any) => {
                    const returnable = item.quantity - (item.returnedQuantity || 0);
                    return (
                      <tr key={item.id}>
                        <td className="p-2 font-semibold">{item.productName}</td>
                        <td className="p-2 text-center mono">{item.quantity}</td>
                        <td className="p-2 text-center mono">{item.returnedQuantity || 0}</td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={returnable}
                            disabled={returnable === 0}
                            value={returnQuantities[item.productId] ?? '0'}
                            onChange={(e) =>
                              setReturnQuantities({
                                ...returnQuantities,
                                [item.productId]: e.target.value,
                              })
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

            <div className="mb-4">
              <label className="text-xs font-bold text-muted mb-1 block">طريقة الاسترداد</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!returnPurchase.supplierId}
                  onClick={() => setReturnRefundMethod('debt')}
                  className={`flex-1 py-2 text-xs font-bold rounded-control border cursor-pointer transition-colors disabled:opacity-40 ${
                    returnRefundMethod === 'debt'
                      ? 'bg-jade text-white border-jade'
                      : 'bg-surface text-muted border-border hover:text-text'
                  }`}
                >
                  خصم من دين المورد
                </button>
                <button
                  type="button"
                  onClick={() => setReturnRefundMethod('cash')}
                  className={`flex-1 py-2 text-xs font-bold rounded-control border cursor-pointer transition-colors ${
                    returnRefundMethod === 'cash'
                      ? 'bg-jade text-white border-jade'
                      : 'bg-surface text-muted border-border hover:text-text'
                  }`}
                >
                  استرداد نقدي للدرج (يتطلب توكة مفتوحة)
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-alert text-white font-bold text-sm rounded-control hover:bg-red-600 cursor-pointer"
              >
                تأكيد المرتجع
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnPurchase(null);
                }}
                className="flex-1 py-2.5 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── Customer Account Statement Modal (A4 printable) ─── */}
      {showCustomerStatementModal && statementCustomer && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto no-print"
          dir="rtl"
        >
          <div className="w-full max-w-[760px] rounded-card border border-line bg-surface p-6 shadow-xl my-8 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="font-display font-extrabold text-base">
                كشف حساب — {statementCustomer.name}
              </h3>
              <button
                onClick={() => {
                  setShowCustomerStatementModal(false);
                  setStatementCustomer(null);
                  setStatementData(null);
                }}
                className="text-xs border border-border px-3 py-1.5 rounded hover:bg-surface-2 transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>

            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-[10px] font-bold text-muted mb-1 block">من تاريخ</label>
                <input
                  type="date"
                  value={statementFilterStart}
                  onChange={(e) => setStatementFilterStart(e.target.value)}
                  className="h-9 rounded-control border border-line bg-surface px-2 text-xs mono focus-visible:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted mb-1 block">إلى تاريخ</label>
                <input
                  type="date"
                  value={statementFilterEnd}
                  onChange={(e) => setStatementFilterEnd(e.target.value)}
                  className="h-9 rounded-control border border-line bg-surface px-2 text-xs mono focus-visible:outline-none"
                />
              </div>
              {(statementFilterStart || statementFilterEnd) && (
                <button
                  onClick={() => {
                    setStatementFilterStart('');
                    setStatementFilterEnd('');
                  }}
                  className="h-9 px-3 text-xs border border-border rounded-control text-muted hover:text-text cursor-pointer"
                >
                  مسح الفترة
                </button>
              )}
            </div>

            <div className="border border-border bg-white rounded-[4px] max-h-[420px] overflow-y-auto select-none">
              {statementLoading ? (
                <div className="p-10 text-center text-muted text-sm">جارٍ تحميل كشف الحساب…</div>
              ) : (
                renderStatementA4()
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-line">
              <button
                onClick={() => window.print()}
                disabled={statementLoading || !statementData}
                className="py-3 bg-jade text-white text-xs font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Icons.Printer />
                <span>طباعة كشف الحساب (A4)</span>
              </button>
              <button
                onClick={() => {
                  setShowCustomerStatementModal(false);
                  setStatementCustomer(null);
                  setStatementData(null);
                }}
                className="py-3 bg-surface-2 border border-border text-muted text-xs font-bold rounded-control hover:text-text transition-colors cursor-pointer text-center"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Customer Special Prices Modal (manager only) ─── */}
      {showSpecialPricesModal && specialPricesCustomer && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display font-extrabold text-base">
                أسعار خاصة — {specialPricesCustomer.name}
              </h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  specialPricesCustomer.tier === 'wholesale'
                    ? 'bg-copper/10 text-copper border border-copper/30'
                    : 'bg-surface-2 text-muted border border-border'
                }`}
              >
                {specialPricesCustomer.tier === 'wholesale' ? 'جملة' : 'تجزئة'}
              </span>
            </div>
            <p className="text-xs text-muted mb-4">
              السعر الخاص له الأولوية القصوى: سعر خاص ← فئة التسعير ← سعر المنتج الافتراضي.
            </p>

            <form onSubmit={handleSpecialPriceSubmit} className="flex gap-2 mb-4">
              <select
                value={specialPriceForm.productId}
                onChange={(e) =>
                  setSpecialPriceForm({ ...specialPriceForm, productId: e.target.value })
                }
                required
                className="flex-1 h-10 rounded-control border border-line bg-surface px-2 text-sm focus-visible:outline-none"
              >
                <option value="">اختر المنتج…</option>
                {productsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatLYD(p.retailPrice)} د.ل)
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={specialPriceForm.price}
                onChange={(e) =>
                  setSpecialPriceForm({ ...specialPriceForm, price: e.target.value })
                }
                className="w-28 h-10 rounded-control border border-line bg-surface px-2 mono text-sm text-left focus-visible:outline-none"
              />
              <button
                type="submit"
                className="px-4 h-10 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 cursor-pointer"
              >
                حفظ
              </button>
            </form>

            <div className="max-h-64 overflow-y-auto border border-line rounded-control">
              {specialPricesList.length === 0 ? (
                <div className="p-6 text-center text-muted text-sm">
                  لا توجد أسعار خاصة لهذا العميل.
                </div>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="bg-surface-2 border-b border-line">
                    <tr className="text-xs font-bold text-muted">
                      <th className="p-2">المنتج</th>
                      <th className="p-2">سعر التجزئة</th>
                      <th className="p-2">السعر الخاص</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {specialPricesList.map((sp) => (
                      <tr key={sp.id}>
                        <td className="p-2 font-semibold">
                          {sp.productName || `#${sp.productId}`}
                        </td>
                        <td className="p-2 mono text-muted">
                          {sp.retailPrice !== null ? formatLYD(sp.retailPrice) : '—'}
                        </td>
                        <td className="p-2 mono font-bold text-jade">{formatLYD(sp.price)} د.ل</td>
                        <td className="p-2">
                          <button
                            onClick={() => handleSpecialPriceDelete(sp.productId)}
                            className="px-2 py-0.5 text-xs text-alert border border-alert/30 bg-alert/5 rounded font-bold hover:bg-alert/10 cursor-pointer"
                          >
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <button
              onClick={() => {
                setShowSpecialPricesModal(false);
                setSpecialPricesCustomer(null);
              }}
              className="mt-4 w-full py-2.5 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* ─── Add/Edit Supplier Modal ─── */}
      {showSupplierModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-xl">
            <h3 className="font-display font-extrabold text-base mb-4">
              {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
            </h3>
            <form onSubmit={handleSupplierSubmit} className="flex flex-col gap-3">
              {['name', 'phone', 'address', 'notes'].map((field) => (
                <div key={field}>
                  <label className="text-xs font-bold text-muted mb-1 block">
                    {field === 'name'
                      ? 'اسم المورد *'
                      : field === 'phone'
                        ? 'رقم الهاتف'
                        : field === 'address'
                          ? 'العنوان'
                          : 'ملاحظات'}
                  </label>
                  <input
                    type="text"
                    required={field === 'name'}
                    value={(supplierForm as any)[field]}
                    onChange={(e) => setSupplierForm({ ...supplierForm, [field]: e.target.value })}
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                  />
                </div>
              ))}
              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 cursor-pointer"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSupplierModal(false);
                    setEditingSupplier(null);
                  }}
                  className="flex-1 py-2.5 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── New Purchase Modal ─── */}
      {showPurchaseModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
        >
          <div className="w-full max-w-2xl rounded-card border border-line bg-surface p-6 shadow-xl my-8 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="font-display font-extrabold text-base">تسجيل فاتورة مشتريات جديدة</h3>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="text-xs border border-border px-3 py-1.5 rounded hover:bg-surface-2 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
            <form onSubmit={handlePurchaseSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted mb-1 block">
                    المورد (اختياري)
                  </label>
                  <select
                    value={purchaseForm.supplierId}
                    onChange={(e) => {
                      const sup = suppliersList.find((s) => s.id === Number(e.target.value));
                      setPurchaseForm({
                        ...purchaseForm,
                        supplierId: e.target.value,
                        supplierName: sup?.name || '',
                      });
                    }}
                    className="w-full h-10 rounded-control border border-line bg-surface px-2 text-sm focus-visible:outline-none"
                  >
                    <option value="">— بدون مورد —</option>
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted mb-1 block">
                    اسم المورد (نص حر)
                  </label>
                  <input
                    type="text"
                    value={purchaseForm.supplierName}
                    onChange={(e) =>
                      setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })
                    }
                    placeholder="أو اكتب اسم المورد"
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-muted">المنتجات المستلمة</label>
                  <button
                    type="button"
                    onClick={() =>
                      setPurchaseForm({
                        ...purchaseForm,
                        items: [
                          ...purchaseForm.items,
                          { productId: '', quantity: '1', unitCost: '0.000' },
                        ],
                      })
                    }
                    className="text-xs text-jade font-bold hover:underline cursor-pointer"
                  >
                    + إضافة منتج
                  </button>
                </div>
                {purchaseForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const updated = [...purchaseForm.items];
                        const prod = productsList.find((p) => p.id === Number(e.target.value));
                        const currentItem = updated[idx];
                        if (currentItem) {
                          updated[idx] = {
                            ...currentItem,
                            productId: e.target.value,
                            unitCost: prod ? (prod.costPrice / 1000).toFixed(3) : '0.000',
                          };
                          setPurchaseForm({ ...purchaseForm, items: updated });
                        }
                      }}
                      className="h-9 rounded-control border border-line bg-surface px-2 text-xs focus-visible:outline-none"
                    >
                      <option value="">— اختر منتجاً —</option>
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const u = [...purchaseForm.items];
                        const currentItem = u[idx];
                        if (currentItem) {
                          u[idx] = { ...currentItem, quantity: e.target.value };
                          setPurchaseForm({ ...purchaseForm, items: u });
                        }
                      }}
                      className="w-20 h-9 rounded-control border border-line bg-surface px-2 text-xs mono text-center focus-visible:outline-none"
                      placeholder="الكمية"
                    />
                    <input
                      type="number"
                      step="0.001"
                      value={item.unitCost}
                      onChange={(e) => {
                        const u = [...purchaseForm.items];
                        const currentItem = u[idx];
                        if (currentItem) {
                          u[idx] = { ...currentItem, unitCost: e.target.value };
                          setPurchaseForm({ ...purchaseForm, items: u });
                        }
                      }}
                      className="w-28 h-9 rounded-control border border-line bg-surface px-2 text-xs mono text-center focus-visible:outline-none"
                      placeholder="سعر الوحدة"
                    />
                    {purchaseForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPurchaseForm({
                            ...purchaseForm,
                            items: purchaseForm.items.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-alert hover:text-red-600 cursor-pointer"
                      >
                        <Icons.Trash />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                <div>
                  <label className="text-xs font-bold text-muted mb-1 block">
                    المبلغ المدفوع (د.ل)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={purchaseForm.paid}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, paid: e.target.value })}
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm mono font-semibold focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted mb-1 block">ملاحظات</label>
                  <input
                    type="text"
                    value={purchaseForm.notes}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                    className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
              >
                تسجيل وحفظ فاتورة الشراء
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
