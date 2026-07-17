import { useEffect, useState, useRef } from 'react';
import { currentTheme, toggleTheme, type Theme } from './theme';

// Types
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
  quantity: number;
  reorderPoint: number;
  serialNumber?: string;
  warrantyMonths?: number;
  batchNo?: string;
  expiryDate?: string;
};

type CartItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
};

type Sale = {
  id: number;
  invoiceNumber: string;
  userId: number;
  username: string;
  shiftId: number;
  paymentType: 'cash' | 'credit';
  paymentMethod: 'cash' | 'card';
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
    quantity: number;
    unitPrice: number;
    total: number;
    baseUnit: string;
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
  businessPhone?: string;
  businessAddress?: string;
  taxEnabled: boolean;
  taxRatePermille: number;
  currency: string;
};

type Backup = {
  filename: string;
  createdAt: string;
};

// SVG Icons
const Icons = {
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
  Plus: () => (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  Minus: () => (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
  ),
  Trash: () => (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  AlertTriangle: () => (
    <svg
      className="h-5 w-5 text-copper"
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
  Power: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  ),
  Printer: () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  ),
};

// Format Money Utility (3 decimals LYD)
function formatLYD(millis: number): string {
  const sign = millis < 0 ? '-' : '';
  const abs = Math.abs(millis);
  const whole = Math.floor(abs / 1000)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (abs % 1000).toString().padStart(3, '0');
  return `${sign}${whole}.${fraction}`;
}

export function App() {
  const today = new Date().toISOString().split('T')[0] || '';
  const [theme, setThemeState] = useState<Theme>(() => currentTheme());
  const [activeTab, setActiveTab] = useState('Dashboard');
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

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState('ALL');
  const [posDiscount, setPosDiscount] = useState('0');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [checkoutOverridePin, setCheckoutOverridePin] = useState('');

  // UI state overlays
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideModalReason, setOverrideModalReason] = useState('');
  const [overrideModalCallback, setOverrideModalCallback] = useState<any>(null);

  // Create / Edit Product Overlay
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
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
  });

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
      .then((r) => r.json())
      .then(setSettingsData)
      .catch(() => {});
  };

  // Fetch all DB records
  const refreshAllData = () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    fetch('/api/products', { headers })
      .then((r) => r.json())
      .then(setProductsList)
      .catch(() => {});

    fetch('/api/sales', { headers })
      .then((r) => r.json())
      .then(setSalesList)
      .catch(() => {});

    fetch('/api/shifts/active', { headers })
      .then((r) => r.json())
      .then((data) => setActiveShift(data.active))
      .catch(() => {});

    fetch('/api/shifts', { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setShiftsList)
      .catch(() => {});

    fetch('/api/expenses', { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setExpensesList)
      .catch(() => {});

    fetch('/api/users', { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsersList)
      .catch(() => {});

    fetch('/api/backup/list', { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then(setBackupsList)
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

  // API Call Wrapper for Mutations
  const apiCall = async (url: string, method: string, body: any) => {
    if (!token) return { success: false, error: 'no_token' };
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
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

  // POS operations
  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      updateCartQuantity(product.id, existing.quantity + 1);
    } else {
      if (product.quantity <= 0) {
        // Trigger PIN override modal or check if manager
        if (currentUser.role !== 'manager') {
          triggerPinOverride(
            `السماح ببيع منتج نافذ من المخزون: ${product.name}`,
            (overridePin: string) => {
              setCart([...cart, { product, quantity: 1, unitPrice: product.retailPrice }]);
              triggerToast(`تمت إضافة منتج بموافقة إدارية: ${product.name}`);
            },
          );
          return;
        }
      }
      setCart([...cart, { product, quantity: 1, unitPrice: product.retailPrice }]);
    }
  };

  const updateCartQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      setCart(cart.filter((item) => item.product.id !== productId));
      return;
    }

    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    if (item.product.quantity < newQty && currentUser.role !== 'manager') {
      triggerPinOverride(
        `تخطي الكمية المتاحة لـ ${item.product.name} (المخزون: ${item.product.quantity})`,
        (overridePin: string) => {
          setCart(cart.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i)));
        },
      );
      return;
    }

    setCart(cart.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i)));
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
      triggerToast('يرجى فتح الوردية أولاً لتسجيل المبيعات', 'alert');
      return;
    }

    const discountMillis = Math.floor(parseFloat(posDiscount) * 1000);
    const cartItems = cart.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));

    // If discount exceeds 10%, prompt for PIN override beforehand if not manager
    let subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discountCap = Math.floor(subtotal * 0.1);
    if (discountMillis > discountCap && currentUser.role !== 'manager') {
      triggerPinOverride(
        `تجاوز نسبة الخصم المسموحة (10%): خصم بقيمة ${posDiscount} د.ل`,
        async (pin) => {
          submitCheckoutApi(cartItems, discountMillis, pin);
        },
      );
    } else {
      submitCheckoutApi(cartItems, discountMillis);
    }
  };

  const submitCheckoutApi = async (cartItems: any[], discountMillis: number, pin?: string) => {
    const payload = {
      items: cartItems,
      discount: discountMillis,
      paymentType: 'cash' as const,
      paymentMethod: posPaymentMethod,
      overridePin: pin,
    };

    const res = await apiCall('/api/sales', 'POST', payload);
    if (res.success) {
      triggerToast(`تم تسجيل الفاتورة بنجاح: ${res.data.invoiceNumber}`);
      setCart([]);
      setPosDiscount('0');

      // Load detailed invoice and show printing overlay
      fetch(`/api/sales/${res.data.id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((invoice) => {
          setPrintingSale(invoice);
          setShowPrintModal(true);
        });

      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إتمام العملية', 'alert');
    }
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

  // Product CRUD Operations
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const costPrice = Math.floor(parseFloat(productForm.costPrice) * 1000);
    const retailPrice = Math.floor(parseFloat(productForm.retailPrice) * 1000);
    const wholesalePrice = Math.floor(parseFloat(productForm.wholesalePrice) * 1000);

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
      triggerToast(editingProduct ? 'تم تعديل المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
      setShowProductModal(false);
      setEditingProduct(null);
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
    });
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
    const cash = Math.floor(parseFloat(openShiftForm.openingCash) * 1000);
    const res = await apiCall('/api/shifts/open', 'POST', { openingCash: cash });
    if (res.success) {
      triggerToast('تم فتح الوردية وبدء التشغيل الفعلي للخزينة');
      setShowOpenShiftModal(false);
      setOpenShiftForm({ openingCash: '0.000' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل فتح الوردية', 'alert');
    }
  };

  // Close Shift
  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = Math.floor(parseFloat(closeShiftForm.actualCash) * 1000);
    const res = await apiCall('/api/shifts/close', 'POST', { actualCash: cash });
    if (res.success) {
      const variance = res.data.variance;
      const statusMsg =
        variance === 0
          ? 'مطابقة ومكتملة'
          : variance > 0
            ? `فائض بقيمة ${formatLYD(variance)} د.ل`
            : `عجز بقيمة ${formatLYD(variance)} د.ل`;
      triggerToast(`تم إغلاق الوردية. حالة الخزينة: ${statusMsg}`);
      setShowCloseShiftModal(false);
      setCloseShiftForm({ actualCash: '0.000' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إغلاق الوردية', 'alert');
    }
  };

  // Record Expense
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Math.floor(parseFloat(expenseForm.amount) * 1000);
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
  const discountMillis = Math.floor(parseFloat(posDiscount) * 1000) || 0;
  const isTaxEnabled = settingsData?.taxEnabled ?? false;
  const taxRatePermille = settingsData?.taxRatePermille ?? 0;
  const cartTax = isTaxEnabled
    ? Math.round(((cartSubtotal - discountMillis) * taxRatePermille) / 1000)
    : 0;
  const cartTotal = cartSubtotal + cartTax - discountMillis;

  // Categories list derived from products
  const categories = [
    'ALL',
    ...Array.from(new Set(productsList.map((p) => p.category.toUpperCase()))),
  ];

  // Login view if not logged in
  if (!token) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-2 p-6" dir="rtl">
        <div className="w-full max-w-[420px] rounded-card border border-line bg-surface p-8 shadow-card">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-jade font-mono text-lg font-bold text-white shadow-md">
              POS
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold">منظومة المبيعات والمخزون</h1>
              <p className="text-sm text-muted">مستلزمات المقاهي والمطاعم</p>
            </div>
          </div>

          <div className="mb-6 rounded-[10px] bg-surface-2 p-4 text-center">
            <p className="text-xs text-muted mb-2">تسجيل دخول تجريبي سريع</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handlePinSwitch('1111')}
                className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-jade hover:bg-jade hover:text-white transition-colors"
              >
                المدير (1111)
              </button>
              <button
                onClick={() => handlePinSwitch('2222')}
                className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-copper hover:bg-copper hover:text-white transition-colors"
              >
                الكاشير (2222)
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block font-display text-sm font-semibold text-text">
                اسم المستخدم
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className="w-full h-11 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-display text-sm font-semibold text-text">
                كلمة المرور
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full h-11 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
              />
            </div>

            {loginError && (
              <p className="text-xs text-alert font-bold bg-alert/10 p-2.5 rounded-control">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="mt-2 h-11 rounded-control bg-jade text-sm font-bold text-white shadow-md hover:bg-jade-2 transition-colors cursor-pointer"
            >
              تسجيل الدخول
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh grid-cols-[272px_1fr] max-[900px]:grid-cols-1" dir="rtl">
      {/* Sidebar Navigation */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-e border-line bg-surface p-6 min-[901px]:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-jade font-mono text-base font-bold text-white shadow-sm">
            POS
          </div>
          <div>
            <div className="font-display text-sm font-extrabold leading-tight">
              {settingsData?.businessName ?? 'سوق المذاق للمستلزمات'}
            </div>
            <div className="mono text-[11px] text-muted">المستلزمات والمعدات</div>
          </div>
        </div>

        {/* Current Active User Status */}
        <div className="rounded-[10px] border border-line bg-surface-2 p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted">المستخدم الحالي:</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${currentUser.role === 'manager' ? 'bg-jade/10 text-jade border border-jade/30' : 'bg-copper/10 text-copper border border-copper/30'}`}
            >
              {currentUser.role === 'manager' ? 'مدير' : 'مبيعات'}
            </span>
          </div>
          <div className="font-display text-sm font-bold mb-2.5">{currentUser.username}</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSwitchPinValue('');
                setShowUserPinModal(true);
              }}
              className="flex-1 text-center py-1.5 text-xs font-semibold rounded-control bg-surface border border-border text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              تبديل سريع (PIN)
            </button>
          </div>
        </div>

        {/* Navigation Menus */}
        <nav className="flex flex-col gap-1 text-sm">
          {[
            { id: 'Dashboard', label: 'لوحة التحكم', icon: Icons.Dashboard },
            { id: 'POS', label: 'نقطة البيع', icon: Icons.POS },
            { id: 'Products', label: 'المنتجات والمخازن', icon: Icons.Products },
            { id: 'Shifts', label: 'الورديات والخزينة', icon: Icons.Shifts },
            { id: 'Reports', label: 'التقارير المالية', icon: Icons.Reports },
            { id: 'Settings', label: 'الإعدادات العامة', icon: Icons.Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={
                'flex items-center gap-3 min-h-11 rounded-[9px] border px-4 py-2 transition-colors cursor-pointer text-right ' +
                (activeTab === item.id
                  ? 'border-line bg-surface-2 font-bold text-jade'
                  : 'border-transparent text-muted hover:bg-surface-2 hover:text-fg')
              }
            >
              <item.icon />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* System Theme / Power Toggle */}
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setThemeState(toggleTheme())}
            className="flex min-h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-xs font-bold text-muted transition-colors hover:text-fg"
          >
            {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}
          </button>

          <button
            onClick={handleLogout}
            className="flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-500/20 bg-red-500/5 px-4 text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Icons.Power />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="p-6 md:p-8 bg-surface-2 min-h-dvh flex flex-col gap-6 overflow-y-auto">
        {/* Mobile Header Bar */}
        <header className="flex items-center justify-between border-b border-line bg-surface p-4 min-[901px]:hidden rounded-card">
          <span className="font-display font-extrabold text-sm text-jade">نظام مبيعات Cafes</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowUserPinModal(true)}
              className="rounded-full bg-surface-2 p-2 border border-line"
            >
              <Icons.User />
            </button>
            <button
              onClick={handleLogout}
              className="rounded-full bg-red-500/5 p-2 text-red-500 border border-red-500/10"
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
                      الوردية مفتوحة حالياً (رقم: {activeShift.id})
                    </span>
                    <button
                      onClick={() => setShowCloseShiftModal(true)}
                      className="text-xs bg-jade text-white px-3 py-1 rounded-full font-bold hover:bg-jade-2 transition-colors"
                    >
                      إغلاق الوردية
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-alert/10 border border-alert/30 rounded-full px-4 py-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-alert"></span>
                    <span className="text-sm font-semibold text-alert">
                      الخزينة مقفلة (لا توجد وردية)
                    </span>
                    <button
                      onClick={() => setShowOpenShiftModal(true)}
                      className="text-xs bg-alert text-white px-3 py-1 rounded-full font-bold hover:bg-alert-2 transition-colors"
                    >
                      فتح الوردية
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
                  onClick={() => {
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
                    });
                    setShowProductModal(true);
                  }}
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

        {/* POS Tab */}
        {activeTab === 'POS' && (
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
                      if (e.key === 'Enter' && filteredProducts.length === 1) {
                        const firstProd = filteredProducts[0];
                        if (firstProd) {
                          addToCart(firstProd);
                        }
                        setPosSearch('');
                        e.preventDefault();
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
                      {/* Stock badge */}
                      <span
                        className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.quantity <= p.reorderPoint ? 'bg-red-500/10 text-alert border border-red-500/10' : 'bg-jade/10 text-jade border border-jade/10'}`}
                      >
                        {p.quantity} {p.baseUnit}
                      </span>

                      <div className="mt-4 font-display text-sm font-extrabold text-text line-clamp-2">
                        {p.name}
                      </div>
                      <div className="text-[11px] text-muted mb-3">{p.category}</div>

                      <div className="mt-auto pt-2 border-t border-line flex items-center justify-between">
                        <span className="mono font-bold text-jade text-sm">
                          {formatLYD(p.retailPrice)} د.ل
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
                  هاتف: {settingsData?.businessPhone ?? '091-XXXXXXX'}
                </p>
                <div className="mono text-[10px] text-muted mt-1">
                  التاريخ: {new Date().toLocaleDateString('ar-LY')}
                </div>
              </div>

              {/* Receipt Cart items List */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[160px] bg-paper">
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

                      <div className="flex justify-between items-center text-[11px] text-muted">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="bg-surface-2 border border-border rounded p-1 hover:bg-border transition-all"
                          >
                            <Icons.Minus />
                          </button>
                          <span className="mono font-bold text-text text-xs">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            className="bg-surface-2 border border-border rounded p-1 hover:bg-border transition-all"
                          >
                            <Icons.Plus />
                          </button>
                        </div>
                        <div className="mono text-text">
                          {item.quantity} × {formatLYD(item.unitPrice)} ={' '}
                          <span className="font-bold text-jade">
                            {formatLYD(item.quantity * item.unitPrice)}
                          </span>
                        </div>
                      </div>

                      {idx < cart.length - 1 && (
                        <div className="border-b border-dashed border-border/60 my-1"></div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Cart Calculations Footer */}
              <div className="p-4 border-t border-dashed border-border bg-paper flex flex-col gap-2.5 text-xs">
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

                <div className="flex items-center justify-between text-muted">
                  <span>المجموع الفرعي:</span>
                  <span className="mono">{formatLYD(cartSubtotal)} د.ل</span>
                </div>

                <div className="border-t border-dashed border-border my-1"></div>

                <div className="flex items-center justify-between font-display text-sm font-extrabold">
                  <span>المجموع الإجمالي:</span>
                  <span className="mono text-lg text-jade font-extrabold">
                    {formatLYD(cartTotal)} د.ل
                  </span>
                </div>

                {/* Cash/Card Selector */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={() => setPosPaymentMethod('cash')}
                    className={`py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer ${posPaymentMethod === 'cash' ? 'bg-jade text-white border-jade' : 'bg-surface-2 text-muted border-border'}`}
                  >
                    نقدًا (كاش)
                  </button>
                  <button
                    onClick={() => setPosPaymentMethod('card')}
                    className={`py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer ${posPaymentMethod === 'card' ? 'bg-jade text-white border-jade' : 'bg-surface-2 text-muted border-border'}`}
                  >
                    شباك / بطاقة
                  </button>
                </div>

                {/* Confirm Sale Button */}
                <button
                  disabled={cart.length === 0}
                  onClick={handleCheckout}
                  className="w-full mt-2 py-3 bg-jade disabled:bg-border text-white text-sm font-bold rounded-control shadow-md hover:bg-jade-2 transition-colors cursor-pointer text-center"
                >
                  تأكيد وطباعة الفاتورة
                </button>
              </div>
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

              <button
                onClick={() => {
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
                  });
                  setShowProductModal(true);
                }}
                className="flex items-center gap-2 py-2.5 px-4 bg-jade text-white rounded-control font-bold shadow-md hover:bg-jade-2 transition-colors cursor-pointer"
              >
                <Icons.Plus />
                <span>إضافة منتج جديد</span>
              </button>
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
                        <td className="p-3 font-bold">{p.name}</td>
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
                          <div className="flex gap-2 justify-end">
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
            <div className="flex items-center justify-between">
              <div>
                <span className="mono text-xs tracking-widest text-copper">
                  الخزينة والعمليات النقودية
                </span>
                <h1 className="text-3xl font-extrabold">الورديات والخزينة اليومية</h1>
              </div>

              <button
                onClick={() => setShowExpenseModal(true)}
                className="flex items-center gap-2 py-2.5 px-4 bg-alert text-white rounded-control font-bold shadow-md hover:bg-red-600 transition-colors cursor-pointer"
              >
                <Icons.Plus />
                <span>تسجيل مصروفات من الدرج</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left detail card: Shift info */}
              <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
                <h2 className="text-lg font-bold">سجل الورديات السابقة</h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-surface-2 text-text font-bold">
                      <tr className="border-b border-line">
                        <th className="p-3">رقم الوردية</th>
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
        {activeTab === 'Reports' && (
          <div className="flex flex-col gap-6">
            <div>
              <span className="mono text-xs tracking-widest text-copper">البيانات والأرباح</span>
              <h1 className="text-3xl font-extrabold">التقارير المالية والمبيعات</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sales Invoice Log */}
              <div className="rounded-card border border-line bg-surface p-6 shadow-sm">
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
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${sale.status === 'completed' ? 'bg-jade/10 text-jade' : 'bg-red-500/10 text-alert'}`}
                        >
                          {sale.status === 'completed' ? 'مدفوعة' : 'ملغاة'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted">المسؤول: {sale.username}</span>
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
                            onClick={() => {
                              setPrintingSale(sale);
                              setShowPrintModal(true);
                            }}
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

              {/* Profitability summary placeholders */}
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
                    <span className="text-xs text-muted block">صافي مبيعات شباك بطاقة</span>
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
                    <span className="text-xs text-muted block">
                      الربح التقريبي اليوم (تقديري من تكلفة الشراء)
                    </span>
                    <span className="mono text-xl font-bold text-copper">
                      {/* Subtotal - discount - cost price */}
                      {formatLYD(
                        salesList
                          .filter((s) => s.status === 'completed')
                          .reduce((sum, s) => sum + s.total, 0) -
                          productsList.reduce(
                            (sum, p) => sum + p.costPrice * (p.quantity || 0),
                            0,
                          ) *
                            0.05, // Mock calculation placeholder
                      )}{' '}
                      د.ل
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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

                {/* Create new employee user */}
                <div className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
                  <h2 className="text-lg font-bold">المستخدمون والوصول</h2>
                  <p className="text-xs text-muted">إدارة الطاقم وتسجيل موظفين جدد في المنظومة.</p>

                  <button
                    onClick={() => {
                      if (currentUser.role !== 'manager') {
                        triggerToast('صلاحية المدير مطلوبة للوصول لإدارة المستخدمين', 'alert');
                        return;
                      }
                      setShowCreateUserModal(true);
                    }}
                    className="w-full py-2.5 bg-surface border border-border text-text rounded-control text-xs font-bold hover:bg-surface-2 transition-colors cursor-pointer text-center"
                  >
                    إضافة مستخدم أو بائع جديد
                  </button>
                </div>
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
              بدء تشغيل الخزينة والوردية
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
                فتح الوردية وتأكيد الدرج
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
            <h3 className="font-display font-extrabold text-base mb-4">إنهاء الوردية وجرد الدرج</h3>

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
                تأكيد الجرد وإغلاق الوردية
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
                <option value="sales">بائع (نقاط البيع والوردية فقط)</option>
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

            {/* Print Templates Frame (Hidden on screen but shown on print, styled for display in modal too) */}
            <div className="border border-border p-4 bg-paper rounded-[4px] max-h-[380px] overflow-y-auto text-ink relative select-none">
              {/* PAID angled Rubber Stamp (design.md §2.2) */}
              {printingSale.status === 'completed' && (
                <div className="absolute top-8 right-8 border-[2.5px] border-jade text-jade text-[11px] font-extrabold px-3 py-1 rounded rotate-[-8deg] opacity-80 uppercase tracking-widest font-display">
                  مدفوعة بالكامل
                </div>
              )}
              {printingSale.status === 'cancelled' && (
                <div className="absolute top-8 right-8 border-[2.5px] border-alert text-alert text-[11px] font-extrabold px-3 py-1 rounded rotate-[-8deg] opacity-80 uppercase tracking-widest font-display">
                  ملغاة / مرتجع
                </div>
              )}

              {/* Branded Header */}
              <div className="text-center pb-4 border-b border-dashed border-border mb-4">
                <h2 className="font-display font-extrabold text-lg text-text">
                  {settingsData?.businessName ?? 'سوق المذاق للمستلزمات'}
                </h2>
                <p className="text-[11px] text-muted">
                  هاتف: {settingsData?.businessPhone ?? '—'} | العنوان:{' '}
                  {settingsData?.businessAddress ?? '—'}
                </p>
                <div className="flex justify-between items-center text-[10px] text-muted mt-3">
                  <span>
                    رقم الفاتورة:{' '}
                    <strong className="mono text-text">{printingSale.invoiceNumber}</strong>
                  </span>
                  <span>
                    التاريخ والوقت:{' '}
                    <strong className="mono">
                      {new Date(printingSale.createdAt).toLocaleString('ar-LY')}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Items List */}
              <table className="w-full text-right text-xs mb-4">
                <thead className="bg-surface-2 text-text font-bold">
                  <tr className="border-b border-border">
                    <th className="p-2">المنتج</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-left font-mono">سعر الوحدة</th>
                    <th className="p-2 text-left font-mono">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {printingSale.items?.map((item) => (
                    <tr key={item.id} className="border-b border-line">
                      <td className="p-2 font-semibold">{item.productName}</td>
                      <td className="p-2 text-center mono">{item.quantity}</td>
                      <td className="p-2 text-left mono">{formatLYD(item.unitPrice)}</td>
                      <td className="p-2 text-left mono font-bold">{formatLYD(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Grand Totals */}
              <div className="flex flex-col gap-1.5 items-end text-xs">
                {printingSale.discount > 0 && (
                  <div className="flex gap-4">
                    <span className="text-muted">الخصم المباشر:</span>
                    <span className="mono font-semibold text-alert">
                      -{formatLYD(printingSale.discount)} د.ل
                    </span>
                  </div>
                )}
                {printingSale.taxAmount > 0 && (
                  <div className="flex gap-4">
                    <span className="text-muted">ضريبة المبيعات:</span>
                    <span className="mono font-semibold">
                      {formatLYD(printingSale.taxAmount)} د.ل
                    </span>
                  </div>
                )}
                <div className="flex gap-4 text-sm font-bold border-t border-dashed border-border pt-1.5 mt-1">
                  <span>المبلغ المدفوع الصافي:</span>
                  <span className="mono text-jade">{formatLYD(printingSale.total)} د.ل</span>
                </div>
              </div>
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
    </div>
  );
}
