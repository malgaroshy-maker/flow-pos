// Shared type definitions for the Flow POS system.
// Extracted from App.tsx — all types consumed by screens, contexts, and components.

export type ProductUnit = {
  id: number;
  productId: number;
  unitName: string;
  conversionFactor: number; // base units per this unit
  price: number; // milli-LYD per this unit
};

export type Product = {
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

export type Deposit = {
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

export type CartItem = {
  product: Product;
  quantity: number; // in the selected unit
  unitPrice: number; // per selected unit
  unitId?: number; // undefined = base unit
  unitName?: string;
  conversionFactor?: number; // base units per selected unit (default 1)
  serialNumber?: string;
};

export type Sale = {
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

export type Shift = {
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

export type Expense = {
  id: number;
  shiftId: number;
  amount: number;
  reason: string;
  category: string;
  createdAt: string;
};

export type User = {
  id: number;
  username: string;
  role: 'manager' | 'sales';
  active: boolean;
};

export type Settings = {
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
  idleLockMinutes: number;
  backupRetentionDays: number;
  currency: string;
};

export type Backup = {
  filename: string;
  createdAt: string;
};

export type Customer = {
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

export type SpecialPrice = {
  id: number;
  productId: number;
  price: number;
  productName: string | null;
  retailPrice: number | null;
  wholesalePrice: number | null;
};

export type Quotation = {
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

export type Supplier = {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  debtBalance: number;
  notes?: string;
  createdAt: string;
};

export type Purchase = {
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

export type StockMovement = {
  id: number;
  productId: number;
  type: string;
  quantity: number;
  balanceAfter: number;
  reason?: string;
  userId: number;
  createdAt: string;
};
