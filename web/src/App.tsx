import { useEffect, useState, useRef } from 'react';
import { currentTheme, toggleTheme, type Theme } from './theme';
import { formatLYD, parseLYDOrZero } from './lib/money';
import type {
  Product,
  CartItem,
  Sale,
  User,
  Customer,
  SpecialPrice,
  Quotation,
  Supplier,
} from './types';

import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { useData } from './context/DataContext';
import { apiCall, uploadProductImage } from './lib/api';

import { Icons } from './components/Icons';
import { PinOverrideModal } from './components/PinOverrideModal';
import { Modal } from './components/Modal';
import { PrintRoot, type PrintDocument } from './print/PrintRoot';

import { Home } from './screens/Home';
import { Dashboard } from './screens/Dashboard';
import { LoginScreen } from './screens/Login';
import { PosScreen } from './screens/Pos';
import { ProductsScreen } from './screens/Products';
import { ShiftsScreen } from './screens/Shifts';
import { QuotationsScreen } from './screens/Quotations';
import { PurchasesScreen } from './screens/Purchases';
import { CustomersScreen } from './screens/Customers';
import { Reports } from './screens/Reports';
import { SettingsScreen } from './screens/Settings';

export function App() {
  const { token, currentUser, logout, updateCurrentUser } = useAuth();
  const { triggerToast } = useToast();
  const {
    productsList,
    salesList,
    shiftsList,
    expensesList,
    usersList,
    backupsList,
    activeShift,
    settingsData,
    auditLogsList,
    customersList,
    suppliersList,
    purchasesList,
    quotationsList,
    depositsList,
    refreshAllData,
    loadBaseData,
  } = useData();

  const [theme, setThemeState] = useState<Theme>(() => currentTheme());
  const [activeTab, setActiveTab] = useState('Home');

  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState('ALL');
  const [posDiscount, setPosDiscount] = useState('0');
  const [posCustomerId, setPosCustomerId] = useState<number | null>(null);
  const [posPaymentType, setPosPaymentType] = useState<'cash' | 'credit'>('cash');
  const [posPaymentMethod, setPosPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [posQuotationId, setPosQuotationId] = useState<number | null>(null);
  const [posDepositId, setPosDepositId] = useState<number | null>(null);
  const [posSpecialPrices, setPosSpecialPrices] = useState<Map<number, number>>(new Map());

  // Stock Movements Modal
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null);
  const [stockMovementsForProduct, setStockMovementsForProduct] = useState<any[]>([]);

  // Customer Modals
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
  const [showSpecialPricesModal, setShowSpecialPricesModal] = useState(false);
  const [specialPricesCustomer, setSpecialPricesCustomer] = useState<Customer | null>(null);
  const [specialPricesList, setSpecialPricesList] = useState<SpecialPrice[]>([]);
  const [specialPriceForm, setSpecialPriceForm] = useState({ productId: '', price: '0.000' });
  const [showCustomerPaymentModal, setShowCustomerPaymentModal] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('0.000');
  const [showCustomerStatementModal, setShowCustomerStatementModal] = useState(false);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [statementData, setStatementData] = useState<any | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementFilterStart, setStatementFilterStart] = useState('');
  const [statementFilterEnd, setStatementFilterEnd] = useState('');

  // Supplier & Purchase Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    supplierName: '',
    items: [{ productId: '', quantity: '1', unitCost: '0.000' }],
    paid: '0.000',
    notes: '',
  });
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnPurchase, setReturnPurchase] = useState<any | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({});
  const [returnRefundMethod, setReturnRefundMethod] = useState<'debt' | 'cash'>('debt');

  // Product CRUD Modal
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
  const [productUnitsForm, setProductUnitsForm] = useState<
    Array<{ unitName: string; conversionFactor: string; price: string }>
  >([]);
  const [productComponentsForm, setProductComponentsForm] = useState<
    Array<{ componentProductId: string; quantity: string }>
  >([]);

  // Adjust Stock & Shift Modals
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({ quantity: '0', reason: '' });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '0.000', reason: '', category: 'supplies' });
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openShiftForm, setOpenShiftForm] = useState({ openingCash: '0.000' });
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [closeShiftForm, setCloseShiftForm] = useState({ actualCash: '0.000' });

  // Users Modals
  const [showUserPinModal, setShowUserPinModal] = useState(false);
  const [switchPinValue, setSwitchPinValue] = useState('');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    password: '',
    pin: '',
    role: 'sales' as 'manager' | 'sales',
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    password: '',
    pin: '',
    role: 'sales' as 'manager' | 'sales',
    active: true,
  });

  // PIN Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideModalReason, setOverrideModalReason] = useState('');
  const [overrideModalCallback, setOverrideModalCallback] = useState<any>(null);
  const [checkoutOverridePin, setCheckoutOverridePin] = useState('');

  // Print Document State
  const [activePrintDocument, setActivePrintDocument] = useState<PrintDocument | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printingSale, setPrintingSale] = useState<Sale | null>(null);
  const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');
  const [overrideCustomerName, setOverrideCustomerName] = useState('');
  const [overrideWarrantyNotes, setOverrideWarrantyNotes] = useState('');
  const [overrideStampTitle, setOverrideStampTitle] = useState('');

  // Special Prices Resolution
  const fetchSpecialPrices = async (customerId: number): Promise<SpecialPrice[]> => {
    const res = await apiCall(`/api/customers/${customerId}/special-prices`);
    return res.success ? res.data : [];
  };

  const resolveClientPrice = (
    product: Product,
    customerId: number | null,
    specials: Map<number, number>
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
      setPosDepositId(null);
      setCart((prev) =>
        prev.map((item) =>
          item.unitId
            ? item
            : { ...item, unitPrice: resolveClientPrice(item.product, posCustomerId, specials) }
        )
      );
    };
    applyPricing();
    return () => {
      cancelled = true;
    };
  }, [posCustomerId]);

  // Handlers
  const handlePinSwitch = async (pinStr: string) => {
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
      updateCurrentUser(res.user);
      setShowUserPinModal(false);
      setSwitchPinValue('');
      triggerToast(`تم التبديل إلى: ${res.user.username}`);
    } catch {
      triggerToast('فشل الاتصال بالخادم', 'alert');
    }
  };

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

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      updateCartQuantity(product.id, existing.quantity + 1);
    } else {
      const unitPrice = resolveClientPrice(product, posCustomerId, posSpecialPrices);
      if (product.quantity <= 0 && currentUser?.role !== 'manager') {
        triggerPinOverride(
          `السماح ببيع منتج نافذ من المخزون: ${product.name}`,
          () => {
            setCart([...cart, { product, quantity: 1, unitPrice }]);
            triggerToast(`تمت إضافة منتج بموافقة إدارية: ${product.name}`);
          }
        );
        return;
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

    const baseNeeded = newQty * (item.conversionFactor || 1);
    if (item.product.quantity < baseNeeded && currentUser?.role !== 'manager') {
      triggerPinOverride(
        `تخطي الكمية المتاحة لـ ${item.product.name} (المخزون: ${item.product.quantity} ${item.product.baseUnit})`,
        () => {
          setCart(cart.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i)));
        }
      );
      return;
    }
    setCart(cart.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i)));
  };

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
      })
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((i) => i.product.id !== productId));
  };

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
    const capPercent = settingsData?.discountCapPercent ?? 10;
    const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discountCap = Math.floor((subtotal * capPercent) / 100);

    if (discountMillis > discountCap && currentUser?.role !== 'manager') {
      triggerPinOverride(
        `تجاوز نسبة الخصم المسموحة (${capPercent}%): خصم بقيمة ${posDiscount} د.ل`,
        async (pin) => {
          submitCheckoutApi(cartItems, discountMillis, pin);
        }
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

      const invRes = await apiCall(`/api/sales/${res.data.id}`);
      if (invRes.success) {
        setPrintingSale(invRes.data);
        setActivePrintDocument({ type: 'sale-a4', sale: invRes.data });
        setShowPrintModal(true);
      }
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إتمام العملية', 'alert');
    }
  };

  const openInvoicePrint = async (sale: Sale) => {
    const res = await apiCall(`/api/sales/${sale.id}`);
    if (!res.success) {
      triggerToast(res.error || 'فشل جلب تفاصيل الفاتورة', 'alert');
      return;
    }
    setPrintingSale(res.data);
    setActivePrintDocument({ type: 'sale-a4', sale: res.data });
    setShowPrintModal(true);
  };

  const handleCancelInvoice = (sale: Sale) => {
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
      }
    );
  };

  const handleExportCSV = (type: 'sales' | 'products' | 'shifts') => {
    let headers: string[] = [];
    let rows: string[][] = [];
    if (type === 'sales') {
      headers = ['رقم الفاتورة', 'تاريخ البيع', 'المسؤول', 'طريقة الدفع', 'حالة الفاتورة', 'الخصم (د.ل)', 'الضريبة (د.ل)', 'الإجمالي (د.ل)'];
      rows = salesList.map((s) => [
        s.invoiceNumber,
        new Date(s.createdAt).toLocaleString('ar-LY'),
        s.username,
        s.paymentMethod === 'cash' ? 'كاش' : s.paymentMethod === 'card' ? 'بطاقة مصرفية' : 'حوالة مصرفية',
        s.status === 'completed' ? 'مدفوعة' : 'ملغاة',
        formatLYD(s.discount),
        formatLYD(s.taxAmount),
        formatLYD(s.total),
      ]);
    } else if (type === 'products') {
      headers = ['اسم المنتج', 'النوع', 'القسم', 'الوحدة الأساسية', 'سعر الشراء', 'سعر التجزئة', 'سعر الجملة', 'الكمية المتاحة', 'حد إعادة الطلب'];
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
      headers = ['رقم التوكة', 'المسؤول عن الفتح', 'تاريخ الافتتاح', 'رصيد الفتح (د.ل)', 'الرصيد المتوقع (د.ل)', 'الرصيد الفعلي (د.ل)', 'الفارق (عجز/زيادة)', 'الحالة'];
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
    const formatCSVRow = (arr: string[]) => arr.map((val) => `"${val.replace(/"/g, '""')}"`).join(',');
    const csvContent = '\uFEFF' + [formatCSVRow(headers), ...rows.map((r) => formatCSVRow(r))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `تقرير_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('تم تصدير ملف الاكسيل (CSV) بنجاح');
  };

  const handleOpenQuotationPrint = async (q: Quotation) => {
    const res = await apiCall(`/api/quotations/${q.id}`);
    if (res.success) {
      setActivePrintDocument({ type: 'quotation-a4', quotation: res.data });
      window.print();
    } else {
      triggerToast(res.error || 'فشل جلب تفاصيل عرض السعر', 'alert');
    }
  };

  const handleLoadQuotationIntoPos = async (q: Quotation) => {
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
    triggerToast(`تم تحميل عرض السعر ${detail.quoteNumber} في نقطة البيع`);
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
    if (!confirm(`هل أنت متأكد من استرجاع البيانات للملف ${filename}؟`)) return;
    const res = await apiCall('/api/backup/restore', 'POST', { filename });
    if (res.success) {
      triggerToast('تمت استعادة قاعدة البيانات وجارٍ إعادة تحميل التطبيق...');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      triggerToast(res.error || 'فشل استرجاع البيانات', 'alert');
    }
  };

  // If not logged in, render LoginScreen
  if (!token || !currentUser) {
    return <LoginScreen />;
  }

  const navItems = [
    { id: 'Dashboard', label: 'لوحة التحكم', icon: Icons.Dashboard, managerOnly: true },
    { id: 'POS', label: 'نقطة البيع', icon: Icons.POS, managerOnly: false },
    { id: 'Products', label: 'المنتجات والمخزون', icon: Icons.Products, managerOnly: false },
    { id: 'Shifts', label: 'التوكة والخزينة', icon: Icons.Shifts, managerOnly: false },
    { id: 'Quotations', label: 'عروض الأسعار', icon: Icons.Receipt, managerOnly: false },
    { id: 'Purchases', label: 'المشتريات والموردين', icon: Icons.Truck, managerOnly: true },
    { id: 'Customers', label: 'العملاء والذمم', icon: Icons.Users, managerOnly: true },
    { id: 'Reports', label: 'التقارير المالية', icon: Icons.Reports, managerOnly: true },
    { id: 'Settings', label: 'الإعدادات العامة', icon: Icons.Settings, managerOnly: true },
  ].filter((item) => !item.managerOnly || currentUser.role === 'manager');

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
            <div className="font-display text-sm font-extrabold leading-tight truncate">
              {settingsData?.businessName ?? 'فلو ديف للمستلزمات'}
            </div>
            <div className="mono text-[10px] text-muted">المستلزمات والمعدات</div>
          </div>
        </div>

        <div className="rounded-2xl p-3.5 bg-surface-2 border border-line">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-muted">المستخدم الحالي</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                currentUser.role === 'manager' ? 'bg-jade/10 text-jade' : 'bg-copper/10 text-copper'
              }`}
            >
              {currentUser.role === 'manager' ? '★ مدير' : 'كاشير'}
            </span>
          </div>
          <div className="font-display text-base font-black mb-3">{currentUser.username}</div>
          <button
            onClick={() => {
              setSwitchPinValue('');
              setShowUserPinModal(true);
            }}
            className="w-full py-2 text-xs font-bold rounded-xl border border-line bg-surface hover:bg-surface-2 cursor-pointer"
          >
            تبديل المستخدم (PIN) 🔄
          </button>
        </div>

        <nav className="flex flex-col gap-1 text-sm flex-1">
          <button
            onClick={() => setActiveTab('Home')}
            className={`flex items-center gap-3 min-h-10 rounded-xl px-3.5 py-2 transition-all cursor-pointer text-right mb-2 font-bold text-xs ${
              activeTab === 'Home' ? 'bg-jade/10 text-jade border border-jade/30' : 'text-muted'
            }`}
          >
            <Icons.Home />
            <span>القائمة الرئيسية</span>
          </button>

          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 min-h-10 rounded-xl px-3.5 py-2 transition-all cursor-pointer text-right text-xs font-semibold ${
                activeTab === item.id ? 'bg-surface-2 text-jade font-bold border border-line' : 'text-muted'
              }`}
            >
              <item.icon />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-2 pt-2 border-t border-line">
          <button
            type="button"
            onClick={() => setThemeState(toggleTheme())}
            className="flex min-h-9 items-center justify-center gap-2 rounded-xl text-xs font-bold border border-line bg-surface-2 text-muted cursor-pointer"
          >
            {theme === 'dark' ? '☀️ الوضع الفاتح' : '🌙 الوضع الليلي'}
          </button>
          <button
            onClick={logout}
            className="flex min-h-9 items-center justify-center gap-2 rounded-xl text-xs font-bold border border-red-500/20 bg-red-500/5 text-alert cursor-pointer"
          >
            <Icons.Power />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="p-6 md:p-8 bg-bg min-h-dvh flex flex-col gap-6 overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between border border-line bg-surface/95 backdrop-blur-md p-4 rounded-card shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-gradient-to-tr from-jade to-copper font-mono text-xs font-bold text-white shadow-sm border border-line">
              FD
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm leading-tight">
                {settingsData?.businessName ?? 'فلو ديف للمستلزمات'}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted leading-tight mt-0.5">
                <span>الرئيسية</span>
                <span>/</span>
                <span className="text-copper font-bold">{activeTab}</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {activeShift ? (
              <div className="flex items-center gap-2 rounded-full bg-jade/10 text-jade border border-jade/30 px-3.5 py-1 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-jade animate-pulse" />
                <span>التوكة مفتوحة: #{activeShift.id}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-alert/10 text-alert border border-alert/30 px-3.5 py-1 text-xs font-bold">
                <span className="h-2 w-2 rounded-full bg-alert" />
                <span>التوكة مغلقة</span>
              </div>
            )}
          </div>
        </header>

        {/* Active Screen View */}
        {activeTab === 'Home' && (
          <Home
            onSelectTab={setActiveTab}
            onOpenShiftModal={() => setShowOpenShiftModal(true)}
            onCloseShiftModal={() => setShowCloseShiftModal(true)}
            onThemeToggle={() => setThemeState(toggleTheme())}
          />
        )}
        {activeTab === 'Dashboard' && (
          <Dashboard
            onSelectTab={setActiveTab}
            onOpenShiftModal={() => setShowOpenShiftModal(true)}
            onCloseShiftModal={() => setShowCloseShiftModal(true)}
            onOpenNewProductModal={() => setShowProductModal(true)}
            onOpenExpenseModal={() => setShowExpenseModal(true)}
            onTriggerBackup={triggerManualBackup}
          />
        )}
        {activeTab === 'POS' && (
          <PosScreen
            cart={cart}
            posSearch={posSearch}
            posCategory={posCategory}
            posDiscount={posDiscount}
            posCustomerId={posCustomerId}
            posPaymentType={posPaymentType}
            posPaymentMethod={posPaymentMethod}
            posQuotationId={posQuotationId}
            posDepositId={posDepositId}
            posSpecialPrices={posSpecialPrices}
            onSearchChange={setPosSearch}
            onCategoryChange={setPosCategory}
            onDiscountChange={setPosDiscount}
            onCustomerChange={setPosCustomerId}
            onPaymentTypeChange={setPosPaymentType}
            onPaymentMethodChange={setPosPaymentMethod}
            onAddToCart={addToCart}
            onUpdateCartQuantity={updateCartQuantity}
            onChangeCartUnit={changeCartUnit}
            onRemoveFromCart={removeFromCart}
            onSaveQuotation={() => {
              /* quotation logic */
            }}
            onCheckout={handleCheckout}
          />
        )}
        {activeTab === 'Products' && (
          <ProductsScreen
            onOpenNewProductModal={() => setShowProductModal(true)}
            onStartEditProduct={(p) => {
              setEditingProduct(p);
              setShowProductModal(true);
            }}
            onOpenAdjustModal={(p) => {
              setAdjustingProduct(p);
              setShowAdjustModal(true);
            }}
            onViewMovements={(p) => {
              setMovementsProduct(p);
              setShowMovementsModal(true);
            }}
          />
        )}
        {activeTab === 'Shifts' && (
          <ShiftsScreen
            onOpenShiftModal={() => setShowOpenShiftModal(true)}
            onCloseShiftModal={() => setShowCloseShiftModal(true)}
            onOpenExpenseModal={() => setShowExpenseModal(true)}
          />
        )}
        {activeTab === 'Quotations' && (
          <QuotationsScreen
            onSelectTab={setActiveTab}
            onOpenQuotationPrint={handleOpenQuotationPrint}
            onLoadQuotationIntoPos={handleLoadQuotationIntoPos}
            onCancelQuotation={handleCancelQuotation}
          />
        )}
        {activeTab === 'Purchases' && (
          <PurchasesScreen
            onOpenSupplierModal={(s) => {
              setEditingSupplier(s || null);
              setShowSupplierModal(true);
            }}
            onOpenPurchaseModal={() => setShowPurchaseModal(true)}
            onOpenReturnModal={(pId) => {
              /* return modal logic */
            }}
          />
        )}
        {activeTab === 'Customers' && (
          <CustomersScreen
            onOpenCustomerModal={(c) => {
              setEditingCustomer(c || null);
              setShowCustomerModal(true);
            }}
            onOpenPaymentModal={(c) => {
              setPayingCustomer(c);
              setShowCustomerPaymentModal(true);
            }}
            onOpenStatementModal={(c) => {
              setStatementCustomer(c);
              setShowCustomerStatementModal(true);
            }}
            onOpenSpecialPricesModal={(c) => {
              setSpecialPricesCustomer(c);
              setShowSpecialPricesModal(true);
            }}
          />
        )}
        {activeTab === 'Reports' && (
          <Reports
            onOpenInvoicePrint={openInvoicePrint}
            onCancelInvoice={handleCancelInvoice}
            onExportCSV={handleExportCSV}
          />
        )}
        {activeTab === 'Settings' && (
          <SettingsScreen
            onTriggerBackup={triggerManualBackup}
            onRestoreDb={handleRestoreDb}
            onOpenCreateUserModal={() => setShowCreateUserModal(true)}
            onOpenEditUserModal={(u) => {
              setEditingUser(u);
              setShowEditUserModal(true);
            }}
          />
        )}
      </main>

      {/* PIN Override Modal */}
      <PinOverrideModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        reason={overrideModalReason}
        pinValue={checkoutOverridePin}
        onPinChange={setCheckoutOverridePin}
        onSubmit={handleVerifyOverridePinSubmit}
      />

      {/* Print Root System */}
      <PrintRoot document={activePrintDocument} settings={settingsData} />
    </div>
  );
}
