import { useEffect, useState } from 'react';
import { currentTheme, toggleTheme, type Theme } from './theme';
import { formatLYD, parseLYDOrZero } from './lib/money';
import { formatDateTime } from './lib/datetime';
import type {
  Product,
  CartItem,
  Sale,
  User,
  Customer,
  Quotation,
  Supplier,
  Purchase,
} from './types';

import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { useData } from './context/DataContext';
import { apiCall, restoreDbFromFile } from './lib/api';

import { Icons } from './components/Icons';
import { Modal } from './components/Modal';
import { PinOverrideModal } from './components/PinOverrideModal';
import { IdleLockOverlay } from './components/IdleLockOverlay';
import { SaleReturnModal } from './components/SaleReturnModal';
import { AppModals } from './components/AppModals';
import { PrintRoot, type PrintDocument } from './print/PrintRoot';
import { PrintPreviewModal } from './print/PrintPreviewModal';

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
import { StocktakingScreen } from './screens/Stocktaking';
import { WarrantyScreen } from './screens/Warranty';
import { LicenseActivationScreen } from './screens/LicenseActivation';
import { NetworkConnectModal } from './components/NetworkConnectModal';

export function App() {
  const { token, currentUser, logout, login, updateCurrentUser } = useAuth();
  const { triggerToast } = useToast();
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<{
    active: boolean;
    machineCode: string;
    customerName?: string;
    licenseType?: string;
    expiresAt?: string | null;
    reason?: string;
  } | null>(null);

  const checkLicenseStatus = async (retries = 30) => {
    try {
      // Plain fetch, not apiCall — this runs before login, so there is no
      // auth token yet, and apiCall() refuses to send a request without one.
      const r = await fetch('/api/license/info');
      const res = await r.json();
      if (res && typeof res.active === 'boolean') {
        setLicenseInfo(res);
        return;
      }
    } catch {
      // ignore — will retry
    }
    if (retries > 0) {
      setTimeout(() => checkLicenseStatus(retries - 1), 800);
    } else {
      // Server unreachable after ~24s — show activation screen with error
      setLicenseInfo({ active: false, machineCode: '----', reason: 'تعذر الاتصال بخادم المنظومة. تأكد من تشغيل التطبيق بشكل صحيح.' });
    }
  };

  useEffect(() => {
    checkLicenseStatus();
  }, []);
  const {
    productsList,
    salesList,
    shiftsList,
    expensesList,
    usersList,
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

  // Idle lock: locks the UI to a PIN screen after inactivity (Settings-configurable,
  // 0 = disabled). The in-progress POS cart survives — this is an overlay on top of
  // the still-mounted app, not a navigation or logout.
  const [isLocked, setIsLocked] = useState(false);

  // Customer sale returns (مرتجع مبيعات)
  const [showSaleReturnModal, setShowSaleReturnModal] = useState(false);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);

  // Modal Visibility States
  const [showUserPinModal, setShowUserPinModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printingSale, setPrintingSale] = useState<Sale | null>(null);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [showCustomerPaymentModal, setShowCustomerPaymentModal] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);

  const [showCustomerStatementModal, setShowCustomerStatementModal] = useState(false);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  const [showSpecialPricesModal, setShowSpecialPricesModal] = useState(false);
  const [specialPricesCustomer, setSpecialPricesCustomer] = useState<Customer | null>(null);

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [showSupplierStatementModal, setShowSupplierStatementModal] = useState(false);
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnPurchaseId, setReturnPurchaseId] = useState<number | null>(null);

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    password: '',
    pin: '',
    role: 'sales' as 'manager' | 'sales',
    active: true,
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Notification Center State
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);

  // Mobile navigation drawer (<901px, design.md §8)
  const [showMobileNav, setShowMobileNav] = useState(false);

  const fetchNotifications = async () => {
    if (!token) return;
    const res = await apiCall('/api/notifications');
    if (res.success) {
      setNotificationsList(res.data);
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Idle lock: reset a timeout on any user activity; lock the UI when it fires.
  useEffect(() => {
    const idleMinutes = settingsData?.idleLockMinutes ?? 5;
    if (!token || !idleMinutes || idleMinutes <= 0) return;

    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsLocked(true), idleMinutes * 60 * 1000);
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [token, settingsData?.idleLockMinutes]);

  // PIN Override Modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideModalReason, setOverrideModalReason] = useState('');
  const [overrideModalCallback, setOverrideModalCallback] = useState<any>(null);
  const [checkoutOverridePin, setCheckoutOverridePin] = useState('');

  // Print Document State
  const [activePrintDocument, setActivePrintDocument] = useState<PrintDocument | null>(null);
  const [showGenericPrintPreview, setShowGenericPrintPreview] = useState(false);
  const [genericPrintPreviewTitle, setGenericPrintPreviewTitle] = useState('');

  // Special Prices Resolution
  const fetchSpecialPrices = async (customerId: number) => {
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
        specials = new Map(list.map((sp: any) => [sp.productId, sp.price]));
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

  const handleSaveQuotation = async () => {
    if (cart.length === 0) {
      triggerToast('سلة المبيعات فارغة', 'alert');
      return;
    }
    const discountMillis = parseLYDOrZero(posDiscount);
    const items = cart.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      unitId: i.unitId,
    }));
    const selectedCustomer = customersList.find((c) => c.id === posCustomerId);
    const payload = {
      items,
      discount: discountMillis,
      customerId: posCustomerId || undefined,
      customerName: selectedCustomer?.name,
    };
    const res = await apiCall('/api/quotations', 'POST', payload);
    if (res.success) {
      triggerToast(`تم حفظ عرض السعر بنجاح: ${res.data.quoteNumber}`);
      setCart([]);
      setPosDiscount('0');
      setPosCustomerId(null);
      refreshAllData();

      const quoRes = await apiCall(`/api/quotations/${res.data.id}`);
      if (quoRes.success) {
        setActivePrintDocument({ type: 'quotation-a4', quotation: quoRes.data });
        setGenericPrintPreviewTitle(`معاينة وطباعة عرض السعر (${quoRes.data.quoteNumber})`);
        setShowGenericPrintPreview(true);
      }
    } else {
      triggerToast(res.error || 'فشل حفظ عرض السعر', 'alert');
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

  const handleOpenPurchasePrint = async (purchase: Purchase) => {
    const res = await apiCall(`/api/purchases/${purchase.id}`);
    if (res.success) {
      setActivePrintDocument({ type: 'purchase-a4', purchase: res.data });
      setGenericPrintPreviewTitle(`معاينة وطباعة فاتورة الشراء (${res.data.invoiceNumber})`);
      setShowGenericPrintPreview(true);
    } else {
      triggerToast(res.error || 'فشل جلب تفاصيل فاتورة المشتريات', 'alert');
    }
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

  const handleReturnInvoice = (sale: Sale) => {
    setReturnSale(sale);
    setShowSaleReturnModal(true);
  };

  const handleSaleReturnSubmit = (items: Array<{ saleItemId: number; quantity: number }>) => {
    if (!returnSale) return;
    const sale = returnSale;
    // Close the item-picker first — otherwise it and the PIN confirmation
    // overlay would stack at the same z-index, and the item-picker (later in
    // the DOM) would visually and pointer-block the PIN modal beneath it.
    setShowSaleReturnModal(false);
    triggerPinOverride(`تسجيل مرتجع مبيعات على الفاتورة ${sale.invoiceNumber}`, async (pin) => {
      const res = await apiCall(`/api/sales/${sale.id}/return`, 'POST', { items, overridePin: pin });
      if (res.success) {
        triggerToast(
          `تم تسجيل المرتجع ${res.data.returnNumber} بقيمة ${formatLYD(res.data.returnValue)} د.ل`
        );
        setShowSaleReturnModal(false);
        setReturnSale(null);
        refreshAllData();
      } else {
        triggerToast(res.error || 'فشل تسجيل مرتجع المبيعات', 'alert');
      }
    });
  };

  const handleExportCSV = (type: 'sales' | 'products' | 'shifts') => {
    let headers: string[] = [];
    let rows: string[][] = [];
    if (type === 'sales') {
      headers = ['رقم الفاتورة', 'تاريخ البيع', 'المسؤول', 'طريقة الدفع', 'حالة الفاتورة', 'الخصم (د.ل)', 'الضريبة (د.ل)', 'الإجمالي (د.ل)'];
      rows = salesList.map((s) => [
        s.invoiceNumber,
        formatDateTime(s.createdAt),
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
        formatDateTime(s.openedAt),
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
      setGenericPrintPreviewTitle(`معاينة وطباعة عرض السعر (${res.data.quoteNumber})`);
      setShowGenericPrintPreview(true);
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

  const [restoreConfirmTarget, setRestoreConfirmTarget] = useState<{
    filename?: string;
    file?: File;
  } | null>(null);

  const handleRestoreDb = async (filename: string) => {
    setRestoreConfirmTarget({ filename });
  };

  const handleRestoreDbFromFile = async (file: File) => {
    if (!token) return;
    setRestoreConfirmTarget({ file });
  };

  const confirmAndExecuteRestore = async () => {
    if (!restoreConfirmTarget) return;
    const { filename, file } = restoreConfirmTarget;
    setRestoreConfirmTarget(null);

    if (filename) {
      const res = await apiCall('/api/backup/restore', 'POST', { filename });
      if (res.success) {
        triggerToast('تمت استعادة قاعدة البيانات وجارٍ إعادة تحميل التطبيق...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        triggerToast(res.error || 'فشل استرجاع البيانات', 'alert');
      }
    } else if (file && token) {
      const res = await restoreDbFromFile(file, token);
      if (res.success) {
        triggerToast('تمت استعادة قاعدة البيانات وجارٍ إعادة تحميل التطبيق...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        triggerToast(res.error || 'فشل استرجاع البيانات من الملف', 'alert');
      }
    }
  };

  // Block UI while license status is loading or if license is not active
  if (!licenseInfo || !licenseInfo.active) {
    // Still loading — show a plain spinner so the app never flashes through
    if (!licenseInfo) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', background: 'var(--bg-base, #0f1117)',
          flexDirection: 'column', gap: '1rem',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '4px solid var(--color-primary, #6c63ff)',
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return (
      <LicenseActivationScreen
        machineCode={licenseInfo.machineCode}
        reason={licenseInfo.reason}
        onActivated={checkLicenseStatus}
      />
    );
  }

  // If not logged in, render LoginScreen
  if (!token || !currentUser) {
    return <LoginScreen />;
  }

  const navItems = [
    { id: 'Dashboard', label: 'لوحة التحكم', icon: Icons.Dashboard, managerOnly: true },
    { id: 'POS', label: 'نقطة البيع', icon: Icons.POS, managerOnly: false },
    { id: 'Products', label: 'المنتجات والمخزون', icon: Icons.Products, managerOnly: false },
    { id: 'Shifts', label: 'التوكة والخزينة', icon: Icons.Shifts, managerOnly: false },
    { id: 'Purchases', label: 'المشتريات والموردين', icon: Icons.Truck, managerOnly: true },
    { id: 'Customers', label: 'العملاء والذمم', icon: Icons.Users, managerOnly: true },
    { id: 'Reports', label: 'التقارير المالية', icon: Icons.Reports, managerOnly: true },
    { id: 'Quotations', label: 'عروض الأسعار', icon: Icons.Receipt, managerOnly: false },
    { id: 'Stocktaking', label: 'الجرد الذكي', icon: Icons.Reports, managerOnly: false },
    { id: 'Warranty', label: 'الضمان والصيانة', icon: Icons.Settings, managerOnly: false },
    { id: 'Settings', label: 'الإعدادات العامة', icon: Icons.Settings, managerOnly: true },
  ].filter((item) => !item.managerOnly || currentUser.role === 'manager');

  // Shared sidebar/drawer content (desktop aside + mobile drawer)
  const renderNavContent = (onNavigate?: () => void) => {
    const go = (tab: string) => {
      setActiveTab(tab);
      onNavigate?.();
    };
    return (
      <>
        <nav className="flex flex-col gap-0.5 text-sm flex-1 justify-start overflow-y-auto">
          <button
            onClick={() => go('Home')}
            className={`flex items-center gap-3 min-h-9 rounded-xl px-3 py-1.5 transition-all cursor-pointer text-right mb-1 font-bold text-xs ${
              activeTab === 'Home' ? 'bg-jade/10 text-jade border border-jade/30' : 'text-muted'
            }`}
          >
            <Icons.Home />
            <span>القائمة الرئيسية</span>
          </button>

          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              className={`flex items-center gap-3 min-h-9 rounded-xl px-3 py-1.5 transition-all cursor-pointer text-right text-xs font-semibold ${
                activeTab === item.id ? 'bg-surface-2 text-jade font-bold border border-line' : 'text-muted'
              }`}
            >
              <item.icon />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-2.5 border-t border-line rounded-2xl p-3 bg-surface-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-muted">المستخدم الحالي</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                currentUser.role === 'manager' ? 'bg-jade/10 text-jade' : 'bg-copper/10 text-copper'
              }`}
            >
              {currentUser.role === 'manager' ? '★ مدير' : 'كاشير'}
            </span>
          </div>
          <div className="font-display text-sm font-black mb-2">{currentUser.username}</div>
          <button
            onClick={() => {
              setShowUserPinModal(true);
              onNavigate?.();
            }}
            className="w-full py-1.5 text-xs font-bold rounded-xl border border-line bg-surface hover:bg-surface-2 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>تبديل المستخدم (PIN) 🔄</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <>
      {isLocked && (
        <IdleLockOverlay
          currentUsername={currentUser.username}
          onUnlock={(newToken, newUser) => {
            login(newToken, newUser);
            setIsLocked(false);
          }}
          onLogout={() => {
            setIsLocked(false);
            logout();
          }}
        />
      )}
    <div className="grid min-h-dvh grid-cols-[272px_1fr] max-[900px]:grid-cols-1" dir="rtl">
      {/* Sidebar Navigation (desktop ≥901px) */}
      <aside
        className="sticky top-0 hidden h-dvh flex-col gap-5 border-e p-5 min-[901px]:flex overflow-y-auto"
        style={{ background: 'var(--gradient-sidebar)', borderColor: 'var(--border)' }}
      >
        {renderNavContent()}
      </aside>

      {/* Mobile drawer navigation (<901px, design.md §8) */}
      {showMobileNav && (
        <div className="fixed inset-0 z-50 min-[901px]:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileNav(false)}
            aria-hidden="true"
          />
          <aside
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-5 border-e p-5 overflow-y-auto shadow-2xl"
            style={{ background: 'var(--gradient-sidebar)', borderColor: 'var(--border)' }}
            role="dialog"
            aria-label="قائمة التنقل"
          >
            <button
              onClick={() => setShowMobileNav(false)}
              className="self-start rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-muted cursor-pointer"
            >
              إغلاق ✕
            </button>
            {renderNavContent(() => setShowMobileNav(false))}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex flex-col min-h-dvh bg-bg overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 backdrop-blur-md px-6 md:px-8 py-3.5 shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            {/* Mobile menu button (<901px) */}
            <button
              onClick={() => setShowMobileNav(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-text cursor-pointer min-[901px]:hidden flex-shrink-0"
              aria-label="فتح قائمة التنقل"
              title="القائمة"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img
              src="/logo.png"
              alt="Flow Dev Logo"
              className="h-16 w-16 object-contain rounded-2xl flex-shrink-0 drop-shadow-md transition-transform hover:scale-105"
            />
            <div className="flex flex-col min-w-0">
              <span
                className="font-display font-extrabold text-base leading-tight truncate"
                title={settingsData?.businessName ?? 'فلو ديف للمستلزمات'}
              >
                {settingsData?.businessName ?? 'فلو ديف للمستلزمات'}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted leading-tight mt-0.5 font-medium">
                <span>الرئيسية</span>
                <span>/</span>
                <span className="text-copper font-extrabold">{activeTab}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell Center */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
                className="relative h-11 w-11 rounded-xl border border-line bg-surface hover:bg-surface-2 cursor-pointer flex items-center justify-center text-base touch-manipulation"
                title="مركز التنبيهات والإشعارات"
              >
                <span>🔔</span>
                {notificationsList.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-alert text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-surface animate-pulse">
                    {notificationsList.length}
                  </span>
                )}
              </button>

              {/* Dropdown Drawer */}
              {showNotificationsDrawer && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotificationsDrawer(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute left-0 top-11 w-80 max-w-[calc(100vw-2rem)] max-h-96 bg-surface border border-line rounded-card shadow-2xl z-50 p-3 overflow-y-auto flex flex-col gap-2">
                  <div className="flex justify-between items-center pb-2 border-b border-line">
                    <span className="font-bold text-xs">مركز التنبيهات والإشعارات</span>
                    <span className="text-[10px] mono font-bold text-muted">{notificationsList.length} تنبيهات</span>
                  </div>
                  {notificationsList.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setActiveTab(n.tab);
                        setShowNotificationsDrawer(false);
                      }}
                      className={`p-2.5 rounded-control text-right flex flex-col gap-0.5 border transition-all cursor-pointer ${n.severity === 'alert'
                          ? 'bg-alert/10 border-alert/30 text-alert hover:bg-alert/20'
                          : n.severity === 'warning'
                            ? 'bg-copper/10 border-copper/30 text-copper hover:bg-copper/20'
                            : 'bg-surface-2 border-line text-text hover:bg-border'
                        }`}
                    >
                      <span className="font-bold text-xs">{n.title}</span>
                      <span className="text-[11px] text-muted leading-snug">{n.message}</span>
                    </button>
                  ))}

                  {notificationsList.length === 0 && (
                    <div className="p-4 text-center text-muted text-xs">لا توجد تنبيهات جديدة حالياً.</div>
                  )}
                  </div>
                </>
              )}
            </div>

            {/* Mobile Connect Button */}
            <button
              type="button"
              onClick={() => setShowNetworkModal(true)}
              className="h-11 px-3 rounded-xl border border-jade/30 bg-jade/10 text-jade hover:bg-jade/20 cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all"
              title="ربط الجوال (رمز QR والشبكة)"
            >
              <span className="text-base">📱</span>
              <span className="hidden md:inline">ربط الجوال</span>
            </button>

            {/* Theme Toggle / Background Color Button */}
            <button
              type="button"
              onClick={() => setThemeState(toggleTheme())}
              className="h-11 w-11 rounded-xl border border-line bg-surface hover:bg-surface-2 text-muted hover:text-text cursor-pointer flex items-center justify-center text-base transition-all"
              title={theme === 'dark' ? 'تغيير لون الخلفية للوضع الفاتح' : 'تغيير لون الخلفية للوضع الليلي'}
            >
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
            </button>

            {/* Settings Button */}
            {currentUser.role === 'manager' && (
              <button
                type="button"
                onClick={() => setActiveTab('Settings')}
                className={`h-11 w-11 rounded-xl border cursor-pointer flex items-center justify-center transition-all ${
                  activeTab === 'Settings'
                    ? 'border-jade/40 bg-jade/10 text-jade'
                    : 'border-line bg-surface hover:bg-surface-2 text-muted hover:text-text'
                }`}
                title="الإعدادات العامة"
              >
                <Icons.Settings className="h-5 w-5" />
              </button>
            )}

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="h-11 px-3 rounded-xl border border-red-500/30 bg-red-500/10 text-alert hover:bg-red-500/20 cursor-pointer flex items-center gap-1.5 text-xs font-bold transition-all"
              title="تسجيل الخروج"
            >
              <Icons.Power className="h-4 w-4" />
              <span className="hidden sm:inline">خروج</span>
            </button>

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
          </div>
        </header>

        {/* Active Screen View */}
        <div className="p-6 md:p-8 flex flex-col gap-6 flex-1">
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
              onDepositChange={setPosDepositId}
              onAddToCart={addToCart}
              onUpdateCartQuantity={updateCartQuantity}
              onChangeCartUnit={changeCartUnit}
              onRemoveFromCart={removeFromCart}
              onClearCart={() => setCart([])}
              onSaveQuotation={handleSaveQuotation}
              onCheckout={handleCheckout}
            />
          )}
          {activeTab === 'Products' && (
            <ProductsScreen
              onOpenNewProductModal={() => setShowProductModal(true)}
              onStartEditProduct={(p: Product) => {
                setEditingProduct(p);
                setShowProductModal(true);
              }}
              onOpenAdjustModal={(p: Product) => {
                setAdjustingProduct(p);
                setShowAdjustModal(true);
              }}
              onViewMovements={(p: Product) => {
                setMovementsProduct(p);
                setShowMovementsModal(true);
              }}
            />
          )}
          {activeTab === 'Stocktaking' && (
            <StocktakingScreen
              onOpenPinOverride={(reason, callback) => triggerPinOverride(reason, callback)}
            />
          )}
          {activeTab === 'Warranty' && <WarrantyScreen />}
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
              onOpenSupplierStatementModal={(s) => {
                setStatementSupplier(s);
                setShowSupplierStatementModal(true);
              }}
              onOpenPurchaseModal={() => setShowPurchaseModal(true)}
              onOpenReturnModal={(pId) => {
                setReturnPurchaseId(pId);
                setShowReturnModal(true);
              }}
              onPrintPurchase={handleOpenPurchasePrint}
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
              onReturnInvoice={handleReturnInvoice}
              onExportCSV={handleExportCSV}
            />
          )}
          {activeTab === 'Settings' && (
            <SettingsScreen
              onTriggerBackup={triggerManualBackup}
              onRestoreDb={handleRestoreDb}
              onRestoreDbFromFile={handleRestoreDbFromFile}
              onOpenCreateUserModal={() => setShowCreateUserModal(true)}
              onOpenEditUserModal={(u) => {
                setEditingUser(u);
                setShowEditUserModal(true);
              }}
              licenseInfo={licenseInfo}
            />
          )}
        </div>
      </main>

      {/* Orchestrated App Modals */}
      <AppModals
        token={token}
        currentUser={currentUser}
        settingsData={settingsData}
        productsList={productsList}
        customersList={customersList}
        suppliersList={suppliersList}
        usersList={usersList}
        activeShift={activeShift}
        triggerToast={triggerToast}
        refreshAllData={refreshAllData}
        loadBaseData={loadBaseData}
        login={login}

        showUserPinModal={showUserPinModal}
        setShowUserPinModal={setShowUserPinModal}

        showPrintModal={showPrintModal}
        setShowPrintModal={setShowPrintModal}
        printingSale={printingSale}
        setActivePrintDocument={setActivePrintDocument}

        showProductModal={showProductModal}
        setShowProductModal={setShowProductModal}
        editingProduct={editingProduct}
        setEditingProduct={setEditingProduct}

        showAdjustModal={showAdjustModal}
        setShowAdjustModal={setShowAdjustModal}
        adjustingProduct={adjustingProduct}

        showMovementsModal={showMovementsModal}
        setShowMovementsModal={setShowMovementsModal}
        movementsProduct={movementsProduct}

        showExpenseModal={showExpenseModal}
        setShowExpenseModal={setShowExpenseModal}

        showOpenShiftModal={showOpenShiftModal}
        setShowOpenShiftModal={setShowOpenShiftModal}

        showCloseShiftModal={showCloseShiftModal}
        setShowCloseShiftModal={setShowCloseShiftModal}

        showCustomerModal={showCustomerModal}
        setShowCustomerModal={setShowCustomerModal}
        editingCustomer={editingCustomer}

        showCustomerPaymentModal={showCustomerPaymentModal}
        setShowCustomerPaymentModal={setShowCustomerPaymentModal}
        payingCustomer={payingCustomer}

        showCustomerStatementModal={showCustomerStatementModal}
        setShowCustomerStatementModal={setShowCustomerStatementModal}
        statementCustomer={statementCustomer}

        showSpecialPricesModal={showSpecialPricesModal}
        setShowSpecialPricesModal={setShowSpecialPricesModal}
        specialPricesCustomer={specialPricesCustomer}

        showSupplierModal={showSupplierModal}
        setShowSupplierModal={setShowSupplierModal}
        editingSupplier={editingSupplier}

        showSupplierStatementModal={showSupplierStatementModal}
        setShowSupplierStatementModal={setShowSupplierStatementModal}
        statementSupplier={statementSupplier}

        showPurchaseModal={showPurchaseModal}
        setShowPurchaseModal={setShowPurchaseModal}

        showReturnModal={showReturnModal}
        setShowReturnModal={setShowReturnModal}
        returnPurchaseId={returnPurchaseId}

        showCreateUserModal={showCreateUserModal}
        setShowCreateUserModal={setShowCreateUserModal}

        showEditUserModal={showEditUserModal}
        setShowEditUserModal={setShowEditUserModal}
        editingUser={editingUser}
      />

      {/* PIN Override Modal */}
      <PinOverrideModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        reason={overrideModalReason}
        pinValue={checkoutOverridePin}
        onPinChange={setCheckoutOverridePin}
        onSubmit={handleVerifyOverridePinSubmit}
      />

      {/* Network QR Connection Modal */}
      <NetworkConnectModal
        isOpen={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
      />

      {/* Customer Sale Return Modal */}
      <SaleReturnModal
        isOpen={showSaleReturnModal}
        sale={returnSale}
        onClose={() => {
          setShowSaleReturnModal(false);
          setReturnSale(null);
        }}
        onSubmit={handleSaleReturnSubmit}
      />

      {/* Database Restore Confirmation Modal */}
      <Modal
        isOpen={!!restoreConfirmTarget}
        onClose={() => setRestoreConfirmTarget(null)}
        title="تأكيد استرجاع قاعدة البيانات"
      >
        <div className="space-y-4">
          <p className="text-sm text-amber-500 font-bold">
            ⚠️ تنبيه هام: سيتم استبدال قاعدة البيانات الحالية بالكامل بالنسخة المختارة.
          </p>
          <p className="text-xs text-muted">
            {restoreConfirmTarget?.filename
              ? `الملف المستهدف: ${restoreConfirmTarget.filename}`
              : restoreConfirmTarget?.file
              ? `الملف المرفوع: ${restoreConfirmTarget.file.name}`
              : ''}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRestoreConfirmTarget(null)}
              className="px-4 py-2 border border-border rounded text-xs hover:bg-surface-2 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={confirmAndExecuteRestore}
              className="px-4 py-2 bg-crimson text-white rounded text-xs font-bold hover:opacity-90 cursor-pointer"
            >
              استرجاع الآن
            </button>
          </div>
        </div>
      </Modal>

      {/* Print Root System */}
      <PrintRoot document={activePrintDocument} settings={settingsData} />

      {/* Generic Print Preview (quotations, purchase invoices) */}
      {showGenericPrintPreview && (
        <PrintPreviewModal
          document={activePrintDocument}
          settings={settingsData}
          title={genericPrintPreviewTitle}
          onClose={() => setShowGenericPrintPreview(false)}
        />
      )}
    </div>
    </>
  );
}
