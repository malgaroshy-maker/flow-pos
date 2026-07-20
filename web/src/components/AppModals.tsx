import React, { useState, useEffect } from 'react';
import type {
  Product,
  Customer,
  Supplier,
  User,
  Sale,
  SpecialPrice,
  Settings,
} from '../types';
import { formatLYD, parseLYDOrZero } from '../lib/money';
import { apiCall, uploadProductImage } from '../lib/api';
import { Icons } from './Icons';
import { Modal } from './Modal';
import { PrintDocument } from '../print/PrintRoot';

interface AppModalsProps {
  token: string | null;
  currentUser: User | null;
  settingsData: Settings | null;
  productsList: Product[];
  customersList: Customer[];
  suppliersList: Supplier[];
  usersList: User[];
  activeShift: any;
  triggerToast: (msg: string, type?: 'success' | 'alert') => void;
  refreshAllData: () => void;
  loadBaseData: () => void;
  login: (token: string, user: User) => void;

  // Modal Visibility States & Controls
  showUserPinModal: boolean;
  setShowUserPinModal: (show: boolean) => void;

  showPrintModal: boolean;
  setShowPrintModal: (show: boolean) => void;
  printingSale: Sale | null;
  setActivePrintDocument: (doc: PrintDocument | null) => void;

  showProductModal: boolean;
  setShowProductModal: (show: boolean) => void;
  editingProduct: Product | null;
  setEditingProduct: (p: Product | null) => void;

  showAdjustModal: boolean;
  setShowAdjustModal: (show: boolean) => void;
  adjustingProduct: Product | null;

  showMovementsModal: boolean;
  setShowMovementsModal: (show: boolean) => void;
  movementsProduct: Product | null;

  showExpenseModal: boolean;
  setShowExpenseModal: (show: boolean) => void;

  showOpenShiftModal: boolean;
  setShowOpenShiftModal: (show: boolean) => void;

  showCloseShiftModal: boolean;
  setShowCloseShiftModal: (show: boolean) => void;

  showCustomerModal: boolean;
  setShowCustomerModal: (show: boolean) => void;
  editingCustomer: Customer | null;

  showCustomerPaymentModal: boolean;
  setShowCustomerPaymentModal: (show: boolean) => void;
  payingCustomer: Customer | null;

  showCustomerStatementModal: boolean;
  setShowCustomerStatementModal: (show: boolean) => void;
  statementCustomer: Customer | null;

  showSpecialPricesModal: boolean;
  setShowSpecialPricesModal: (show: boolean) => void;
  specialPricesCustomer: Customer | null;

  showSupplierModal: boolean;
  setShowSupplierModal: (show: boolean) => void;
  editingSupplier: Supplier | null;

  showPurchaseModal: boolean;
  setShowPurchaseModal: (show: boolean) => void;

  showReturnModal: boolean;
  setShowReturnModal: (show: boolean) => void;

  showCreateUserModal: boolean;
  setShowCreateUserModal: (show: boolean) => void;

  showEditUserModal: boolean;
  setShowEditUserModal: (show: boolean) => void;
  editingUser: User | null;
}

export const AppModals: React.FC<AppModalsProps> = ({
  token,
  currentUser,
  settingsData,
  productsList,
  customersList,
  suppliersList,
  usersList,
  activeShift,
  triggerToast,
  refreshAllData,
  loadBaseData,
  login,

  showUserPinModal,
  setShowUserPinModal,

  showPrintModal,
  setShowPrintModal,
  printingSale,
  setActivePrintDocument,

  showProductModal,
  setShowProductModal,
  editingProduct,
  setEditingProduct,

  showAdjustModal,
  setShowAdjustModal,
  adjustingProduct,

  showMovementsModal,
  setShowMovementsModal,
  movementsProduct,

  showExpenseModal,
  setShowExpenseModal,

  showOpenShiftModal,
  setShowOpenShiftModal,

  showCloseShiftModal,
  setShowCloseShiftModal,

  showCustomerModal,
  setShowCustomerModal,
  editingCustomer,

  showCustomerPaymentModal,
  setShowCustomerPaymentModal,
  payingCustomer,

  showCustomerStatementModal,
  setShowCustomerStatementModal,
  statementCustomer,

  showSpecialPricesModal,
  setShowSpecialPricesModal,
  specialPricesCustomer,

  showSupplierModal,
  setShowSupplierModal,
  editingSupplier,

  showPurchaseModal,
  setShowPurchaseModal,

  showReturnModal,
  setShowReturnModal,

  showCreateUserModal,
  setShowCreateUserModal,

  showEditUserModal,
  setShowEditUserModal,
  editingUser,
}) => {
  // Local state for modals
  const [switchPinValue, setSwitchPinValue] = useState('');
  const [printMode, setPrintMode] = useState<'a4' | 'thermal'>('a4');
  const [overrideCustomerName, setOverrideCustomerName] = useState('');
  const [overrideWarrantyNotes, setOverrideWarrantyNotes] = useState('');
  const [overrideStampTitle, setOverrideStampTitle] = useState('');

  // Product Form
  const [productForm, setProductForm] = useState({
    name: '',
    type: 'consumable' as 'equipment' | 'consumable',
    category: '',
    baseUnit: 'قطعة',
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
  const [productImageFile, setProductImageFile] = useState<File | null>(null);

  // Adjust Form
  const [adjustForm, setAdjustForm] = useState({ quantity: '0', reason: '' });

  // Movements Data
  const [stockMovements, setStockMovements] = useState<any[]>([]);

  // Expense Form
  const [expenseForm, setExpenseForm] = useState({ amount: '0.000', reason: '', category: 'مصروفات تشغيلية' });

  // Shift Forms
  const [openShiftForm, setOpenShiftForm] = useState({ openingCash: '0.000' });
  const [closeShiftForm, setCloseShiftForm] = useState({ actualCash: '0.000' });

  // Customer Form
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    tier: 'retail' as 'retail' | 'wholesale',
    creditLimit: '0.000',
  });

  // Customer Payment Form
  const [customerPaymentAmount, setCustomerPaymentAmount] = useState('0.000');

  // Customer Statement Data
  const [statementData, setStatementData] = useState<any | null>(null);

  // Special Prices Form & List
  const [specialPricesList, setSpecialPricesList] = useState<SpecialPrice[]>([]);
  const [specialPriceForm, setSpecialPriceForm] = useState({ productId: '', price: '0.000' });

  // Supplier Form
  const [supplierForm, setSupplierForm] = useState({ name: '', phone: '', address: '', notes: '' });

  // Purchase Form
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    supplierName: '',
    items: [{ productId: '', quantity: '1', unitCost: '0.000' }],
    paid: '0.000',
    notes: '',
  });

  // Create/Edit User Forms
  const [createUserForm, setCreateUserForm] = useState({
    username: '',
    password: '',
    pin: '',
    role: 'sales' as 'manager' | 'sales',
  });
  const [editUserForm, setEditUserForm] = useState({
    password: '',
    pin: '',
    role: 'sales' as 'manager' | 'sales',
    active: true,
  });

  // Populate editing forms when models change
  useEffect(() => {
    if (editingProduct) {
      setProductForm({
        name: editingProduct.name,
        type: editingProduct.type,
        category: editingProduct.category,
        baseUnit: editingProduct.baseUnit,
        barcode: editingProduct.barcode || '',
        costPrice: (editingProduct.costPrice / 1000).toFixed(3),
        retailPrice: (editingProduct.retailPrice / 1000).toFixed(3),
        wholesalePrice: (editingProduct.wholesalePrice / 1000).toFixed(3),
        quantity: editingProduct.quantity.toString(),
        reorderPoint: editingProduct.reorderPoint.toString(),
        serialNumber: editingProduct.serialNumber || '',
        warrantyMonths: (editingProduct.warrantyMonths || 0).toString(),
        batchNo: editingProduct.batchNo || '',
        expiryDate: editingProduct.expiryDate || '',
        taxExempt: editingProduct.taxExempt || false,
      });
    } else {
      setProductForm({
        name: '',
        type: 'consumable',
        category: '',
        baseUnit: 'قطعة',
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
    }
  }, [editingProduct]);

  useEffect(() => {
    if (editingCustomer) {
      setCustomerForm({
        name: editingCustomer.name,
        phone: editingCustomer.phone || '',
        address: editingCustomer.address || '',
        notes: editingCustomer.notes || '',
        tier: editingCustomer.tier,
        creditLimit: (editingCustomer.creditLimit / 1000).toFixed(3),
      });
    } else {
      setCustomerForm({
        name: '',
        phone: '',
        address: '',
        notes: '',
        tier: 'retail',
        creditLimit: '0.000',
      });
    }
  }, [editingCustomer]);

  useEffect(() => {
    if (editingSupplier) {
      setSupplierForm({
        name: editingSupplier.name,
        phone: editingSupplier.phone || '',
        address: editingSupplier.address || '',
        notes: editingSupplier.notes || '',
      });
    } else {
      setSupplierForm({ name: '', phone: '', address: '', notes: '' });
    }
  }, [editingSupplier]);

  useEffect(() => {
    if (movementsProduct) {
      apiCall(`/api/products/${movementsProduct.id}/movements`).then((res) => {
        if (res.success) setStockMovements(res.data);
      });
    }
  }, [movementsProduct]);

  useEffect(() => {
    if (statementCustomer) {
      apiCall(`/api/customers/${statementCustomer.id}/statement`).then((res) => {
        if (res.success) setStatementData(res.data);
      });
    }
  }, [statementCustomer]);

  useEffect(() => {
    if (specialPricesCustomer) {
      apiCall(`/api/customers/${specialPricesCustomer.id}/special-prices`).then((res) => {
        if (res.success) setSpecialPricesList(res.data);
      });
    }
  }, [specialPricesCustomer]);

  // Handlers
  const handlePinSwitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await fetch('/api/auth/pin-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: switchPinValue }),
      });
      const res = await r.json();
      if (!r.ok) {
        triggerToast(res.message || 'رمز PIN غير صحيح', 'alert');
        return;
      }
      login(res.token, res.user);
      setShowUserPinModal(false);
      setSwitchPinValue('');
      triggerToast(`تم التبديل بنجاح إلى: ${res.user.username}`);
      refreshAllData();
    } catch {
      triggerToast('فشل الاتصال بالخادم', 'alert');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: productForm.name,
      type: productForm.type,
      category: productForm.category,
      baseUnit: productForm.baseUnit,
      barcode: productForm.barcode || undefined,
      costPrice: parseLYDOrZero(productForm.costPrice),
      retailPrice: parseLYDOrZero(productForm.retailPrice),
      wholesalePrice: parseLYDOrZero(productForm.wholesalePrice),
      quantity: Number(productForm.quantity),
      reorderPoint: Number(productForm.reorderPoint),
      serialNumber: productForm.serialNumber || undefined,
      warrantyMonths: Number(productForm.warrantyMonths),
      batchNo: productForm.batchNo || undefined,
      expiryDate: productForm.expiryDate || undefined,
      taxExempt: productForm.taxExempt,
    };

    let pId = editingProduct?.id;
    if (editingProduct) {
      const res = await apiCall(`/api/products/${editingProduct.id}`, 'PUT', payload);
      if (!res.success) {
        triggerToast(res.error || 'فشل تحديث المنتج', 'alert');
        return;
      }
    } else {
      const res = await apiCall('/api/products', 'POST', payload);
      if (!res.success) {
        triggerToast(res.error || 'فشل إضافة المنتج', 'alert');
        return;
      }
      pId = res.data.id;
    }

    if (pId && productImageFile && token) {
      await uploadProductImage(pId, productImageFile, token);
    }

    triggerToast(editingProduct ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
    setShowProductModal(false);
    setEditingProduct(null);
    setProductImageFile(null);
    refreshAllData();
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    const res = await apiCall(`/api/products/${adjustingProduct.id}/adjust-stock`, 'POST', {
      quantity: Number(adjustForm.quantity),
      reason: adjustForm.reason,
    });
    if (res.success) {
      triggerToast('تم تسوية المخزون وتسجيل الحركة بنجاح');
      setShowAdjustModal(false);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسوية المخزون', 'alert');
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall('/api/expenses', 'POST', {
      amount: parseLYDOrZero(expenseForm.amount),
      reason: expenseForm.reason,
      category: expenseForm.category,
    });
    if (res.success) {
      triggerToast('تم تسجيل المصروف النقدي بنجاح');
      setShowExpenseModal(false);
      setExpenseForm({ amount: '0.000', reason: '', category: 'مصروفات تشغيلية' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسجيل المصروف', 'alert');
    }
  };

  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall('/api/shifts/open', 'POST', {
      openingCash: parseLYDOrZero(openShiftForm.openingCash),
    });
    if (res.success) {
      triggerToast(`تم فتح التوكة رقم #${res.data.id} بنجاح`);
      setShowOpenShiftModal(false);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل فتح التوكة', 'alert');
    }
  };

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall('/api/shifts/close', 'POST', {
      actualCash: parseLYDOrZero(closeShiftForm.actualCash),
    });
    if (res.success) {
      triggerToast(`تم إغلاق التوكة بنجاح — الفارق: ${formatLYD(res.data.variance)} د.ل`);
      setShowCloseShiftModal(false);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إغلاق التوكة', 'alert');
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: customerForm.name,
      phone: customerForm.phone || undefined,
      address: customerForm.address || undefined,
      notes: customerForm.notes || undefined,
      tier: customerForm.tier,
      creditLimit: parseLYDOrZero(customerForm.creditLimit),
    };
    if (editingCustomer) {
      const res = await apiCall(`/api/customers/${editingCustomer.id}`, 'PUT', payload);
      if (res.success) {
        triggerToast('تم تحديث بيانات العميل بنجاح');
        setShowCustomerModal(false);
        refreshAllData();
      } else {
        triggerToast(res.error || 'فشل تعديل العميل', 'alert');
      }
    } else {
      const res = await apiCall('/api/customers', 'POST', payload);
      if (res.success) {
        triggerToast('تم إضافة العميل بنجاح');
        setShowCustomerModal(false);
        refreshAllData();
      } else {
        triggerToast(res.error || 'فشل إضافة العميل', 'alert');
      }
    }
  };

  const handleCustomerPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer) return;
    const res = await apiCall(`/api/customers/${payingCustomer.id}/payments`, 'POST', {
      amount: parseLYDOrZero(customerPaymentAmount),
    });
    if (res.success) {
      triggerToast('تم تسجيل سداد الدين واستلام المبلغ بنجاح');
      setShowCustomerPaymentModal(false);
      setCustomerPaymentAmount('0.000');
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تسجيل السداد', 'alert');
    }
  };

  const handleAddSpecialPriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialPricesCustomer || !specialPriceForm.productId) return;
    const res = await apiCall(`/api/customers/${specialPricesCustomer.id}/special-prices`, 'POST', {
      productId: Number(specialPriceForm.productId),
      price: parseLYDOrZero(specialPriceForm.price),
    });
    if (res.success) {
      triggerToast('تم تحديد السعر الخاص للمنتج');
      const list = await apiCall(`/api/customers/${specialPricesCustomer.id}/special-prices`);
      if (list.success) setSpecialPricesList(list.data);
      setSpecialPriceForm({ productId: '', price: '0.000' });
    } else {
      triggerToast(res.error || 'فشل حفظ السعر الخاص', 'alert');
    }
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: supplierForm.name,
      phone: supplierForm.phone || undefined,
      address: supplierForm.address || undefined,
      notes: supplierForm.notes || undefined,
    };
    if (editingSupplier) {
      const res = await apiCall(`/api/suppliers/${editingSupplier.id}`, 'PUT', payload);
      if (res.success) {
        triggerToast('تم تحديث بيانات المورد');
        setShowSupplierModal(false);
        refreshAllData();
      } else {
        triggerToast(res.error || 'فشل تحديث المورد', 'alert');
      }
    } else {
      const res = await apiCall('/api/suppliers', 'POST', payload);
      if (res.success) {
        triggerToast('تم إضافة المورد بنجاح');
        setShowSupplierModal(false);
        refreshAllData();
      } else {
        triggerToast(res.error || 'فشل إضافة المورد', 'alert');
      }
    }
  };

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
      triggerToast('يرجى اختيار منتج واحد على الأقل', 'alert');
      return;
    }
    const res = await apiCall('/api/purchases', 'POST', {
      supplierId: purchaseForm.supplierId ? Number(purchaseForm.supplierId) : undefined,
      supplierName: purchaseForm.supplierName || undefined,
      items,
      paid: parseLYDOrZero(purchaseForm.paid),
      notes: purchaseForm.notes || undefined,
    });
    if (res.success) {
      triggerToast(`تم تسجيل فاتورة الشراء بنجاح: ${res.data.invoiceNumber}`);
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
      triggerToast(res.error || 'فشل تسجيل الشراء', 'alert');
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiCall('/api/users', 'POST', createUserForm);
    if (res.success) {
      triggerToast(`تم إضافة المستخدم "${res.data.username}" بنجاح`);
      setShowCreateUserModal(false);
      setCreateUserForm({ username: '', password: '', pin: '', role: 'sales' });
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل إضافة المستخدم', 'alert');
    }
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const res = await apiCall(`/api/users/${editingUser.id}`, 'PUT', {
      password: editUserForm.password || undefined,
      pin: editUserForm.pin || undefined,
      role: editUserForm.role,
      active: editUserForm.active,
    });
    if (res.success) {
      triggerToast(`تم تحديث بيانات المستخدم ${editingUser.username}`);
      setShowEditUserModal(false);
      refreshAllData();
    } else {
      triggerToast(res.error || 'فشل تعديل المستخدم', 'alert');
    }
  };

  return (
    <>
      {/* 1. User PIN Fast Switch Modal */}
      <Modal
        isOpen={showUserPinModal}
        onClose={() => setShowUserPinModal(false)}
        title="تبديل سريع للمستخدم (PIN)"
      >
        <form onSubmit={handlePinSwitchSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-muted mb-1 block">أدخل رمز PIN الخاص بك</label>
            <input
              type="password"
              maxLength={4}
              autoFocus
              value={switchPinValue}
              onChange={(e) => setSwitchPinValue(e.target.value)}
              className="w-full h-12 rounded-control border border-line bg-surface text-center mono text-2xl tracking-widest focus-visible:outline-none focus:border-jade"
              placeholder="••••"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={switchPinValue.length < 4}
              className="flex-1 py-3 bg-jade text-white font-bold text-sm rounded-control hover:bg-jade-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              تأكيد الدخول
            </button>
            <button
              type="button"
              onClick={() => setShowUserPinModal(false)}
              className="flex-1 py-3 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Print Invoice Overlay Modal */}
      {showPrintModal && printingSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto no-print" dir="rtl">
          <div className="w-full max-w-xl rounded-card border border-line bg-surface p-6 shadow-xl my-8 flex flex-col gap-4">
            <div className="flex justify-between items-center pb-3 border-b border-line">
              <h3 className="font-display font-extrabold text-base">معاينة وطباعة الفاتورة ({printingSale.invoiceNumber})</h3>
              <button onClick={() => setShowPrintModal(false)} className="text-xs border border-border px-3 py-1.5 rounded hover:bg-surface-2 cursor-pointer">
                إغلاق
              </button>
            </div>

            <div className="flex gap-2 border-b border-line pb-3">
              <button
                type="button"
                onClick={() => {
                  setPrintMode('a4');
                  setActivePrintDocument({
                    type: 'sale-a4',
                    sale: printingSale,
                    overrideCustomerName,
                    overrideWarrantyNotes,
                    overrideStampTitle,
                  });
                }}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors cursor-pointer ${
                  printMode === 'a4' ? 'bg-jade text-white' : 'bg-surface-2 border border-border text-muted'
                }`}
              >
                📄 فاتورة قياسية (A4)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintMode('thermal');
                  setActivePrintDocument({ type: 'sale-thermal', sale: printingSale });
                }}
                className={`px-4 py-2 rounded-control text-xs font-bold transition-colors cursor-pointer ${
                  printMode === 'thermal' ? 'bg-jade text-white' : 'bg-surface-2 border border-border text-muted'
                }`}
              >
                🧾 إيصال حراري (80mm)
              </button>
            </div>

            {printMode === 'a4' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-muted mb-1 block">اسم العميل (مخصص للطباعة)</label>
                  <input
                    type="text"
                    value={overrideCustomerName}
                    onChange={(e) => {
                      setOverrideCustomerName(e.target.value);
                      setActivePrintDocument({
                        type: 'sale-a4',
                        sale: printingSale,
                        overrideCustomerName: e.target.value,
                        overrideWarrantyNotes,
                        overrideStampTitle,
                      });
                    }}
                    placeholder={printingSale.customerName || 'زبون نقدي'}
                    className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs focus-visible:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted mb-1 block">عنوان الختم</label>
                  <input
                    type="text"
                    value={overrideStampTitle}
                    onChange={(e) => {
                      setOverrideStampTitle(e.target.value);
                      setActivePrintDocument({
                        type: 'sale-a4',
                        sale: printingSale,
                        overrideCustomerName,
                        overrideWarrantyNotes,
                        overrideStampTitle: e.target.value,
                      });
                    }}
                    placeholder={settingsData?.stampTitle || settingsData?.businessName || ''}
                    className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs focus-visible:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="font-bold text-muted mb-1 block">ملاحظات الضمان (مخصص للطباعة)</label>
                  <textarea
                    rows={2}
                    value={overrideWarrantyNotes}
                    onChange={(e) => {
                      setOverrideWarrantyNotes(e.target.value);
                      setActivePrintDocument({
                        type: 'sale-a4',
                        sale: printingSale,
                        overrideCustomerName,
                        overrideWarrantyNotes: e.target.value,
                        overrideStampTitle,
                      });
                    }}
                    placeholder={settingsData?.warrantyTerms || ''}
                    className="w-full rounded-control border border-line bg-surface p-2 text-xs focus-visible:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-3 border-t border-line">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-sm shadow-md flex items-center justify-center gap-2"
              >
                <Icons.Printer className="h-4 w-4" />
                <span>طباعة الفاتورة الآن</span>
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-6 py-3 border border-border text-muted font-bold text-sm rounded-control hover:text-text cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Product Create/Edit Modal */}
      <Modal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        title={editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج أو جهاز جديد'}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleProductSubmit} className="flex flex-col gap-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-muted mb-1 block">اسم المنتج *</label>
              <input
                type="text"
                required
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-muted mb-1 block">القسم / التصنيف *</label>
              <input
                type="text"
                required
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-muted mb-1 block">النوع</label>
              <select
                value={productForm.type}
                onChange={(e) => setProductForm({ ...productForm, type: e.target.value as any })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2 text-xs focus-visible:outline-none"
              >
                <option value="consumable">مادة استهلاكية</option>
                <option value="equipment">معدة / جهاز</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-muted mb-1 block">الوحدة الأساسية</label>
              <input
                type="text"
                value={productForm.baseUnit}
                onChange={(e) => setProductForm({ ...productForm, baseUnit: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-muted mb-1 block">الباركد</label>
              <input
                type="text"
                value={productForm.barcode}
                onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs mono focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-muted mb-1 block">سعر التكلفة (د.ل)</label>
              <input
                type="text"
                inputMode="decimal"
                value={productForm.costPrice}
                onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs mono focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-muted mb-1 block">سعر التجزئة (د.ل)</label>
              <input
                type="text"
                inputMode="decimal"
                value={productForm.retailPrice}
                onChange={(e) => setProductForm({ ...productForm, retailPrice: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs mono focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-muted mb-1 block">سعر الجملة (د.ل)</label>
              <input
                type="text"
                inputMode="decimal"
                value={productForm.wholesalePrice}
                onChange={(e) => setProductForm({ ...productForm, wholesalePrice: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs mono focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-muted mb-1 block">المخزون الحالي</label>
              <input
                type="number"
                value={productForm.quantity}
                onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs mono focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-muted mb-1 block">حد إعادة الطلب</label>
              <input
                type="number"
                value={productForm.reorderPoint}
                onChange={(e) => setProductForm({ ...productForm, reorderPoint: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs mono focus-visible:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-muted mb-1 block">صورة المنتج</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setProductImageFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-muted"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => {
                setShowProductModal(false);
                setEditingProduct(null);
              }}
              className="px-4 py-2 border border-border text-muted font-bold rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer"
            >
              حفظ المنتج
            </button>
          </div>
        </form>
      </Modal>

      {/* 4. Adjust Stock Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title={`تسوية المخزون: ${adjustingProduct?.name || ''}`}
      >
        <form onSubmit={handleAdjustSubmit} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="font-bold text-muted mb-1 block">الكمية الجديدة للمخزون (الوحدة الأساسية)</label>
            <input
              type="number"
              required
              value={adjustForm.quantity}
              onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
              className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm mono font-semibold focus-visible:outline-none"
            />
          </div>
          <div>
            <label className="font-bold text-muted mb-1 block">سبب التسوية / الملاحظات *</label>
            <input
              type="text"
              required
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              placeholder="مثال: جرد دفتري، تلف، تعديل رصيد افتتاحي..."
              className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-jade text-white font-bold rounded-control hover:bg-jade-2 cursor-pointer"
            >
              تأكيد التسوية
            </button>
            <button
              type="button"
              onClick={() => setShowAdjustModal(false)}
              className="flex-1 py-2.5 border border-border text-muted font-bold rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. Expense Modal */}
      <Modal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        title="تسجيل مصروف نقدي يومي"
      >
        <form onSubmit={handleExpenseSubmit} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="font-bold text-muted mb-1 block">المبلغ (د.ل) *</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm mono font-semibold focus-visible:outline-none"
            />
          </div>
          <div>
            <label className="font-bold text-muted mb-1 block">السبب / البيان *</label>
            <input
              type="text"
              required
              value={expenseForm.reason}
              onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
              placeholder="مثال: شراء أدوات نظافة، صيانة فك، وقود..."
              className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-jade text-white font-bold rounded-control hover:bg-jade-2 cursor-pointer"
            >
              تسجيل المصروف
            </button>
            <button
              type="button"
              onClick={() => setShowExpenseModal(false)}
              className="flex-1 py-2.5 border border-border text-muted font-bold rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. Open Shift Modal */}
      <Modal
        isOpen={showOpenShiftModal}
        onClose={() => setShowOpenShiftModal(false)}
        title="فتح توكة وخزينة جديدة"
      >
        <form onSubmit={handleOpenShiftSubmit} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="font-bold text-muted mb-1 block">المبلغ النقدي عند الافتتاح (رصيد الدرج د.ل)</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={openShiftForm.openingCash}
              onChange={(e) => setOpenShiftForm({ openingCash: e.target.value })}
              className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm mono font-semibold focus-visible:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-jade text-white font-bold rounded-control hover:bg-jade-2 cursor-pointer"
            >
              تأكيد فتح التوكة
            </button>
            <button
              type="button"
              onClick={() => setShowOpenShiftModal(false)}
              className="flex-1 py-2.5 border border-border text-muted font-bold rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* 7. Close Shift Modal */}
      <Modal
        isOpen={showCloseShiftModal}
        onClose={() => setShowCloseShiftModal(false)}
        title="إغلاق وجرد التوكة الخزينة"
      >
        <form onSubmit={handleCloseShiftSubmit} className="flex flex-col gap-4 text-xs">
          <div>
            <label className="font-bold text-muted mb-1 block">المبلغ النقدي الفعلي في الدرج (د.ل)</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={closeShiftForm.actualCash}
              onChange={(e) => setCloseShiftForm({ actualCash: e.target.value })}
              className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm mono font-semibold focus-visible:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-alert text-white font-bold rounded-control hover:bg-red-600 cursor-pointer"
            >
              إغلاق وجرد الخزينة
            </button>
            <button
              type="button"
              onClick={() => setShowCloseShiftModal(false)}
              className="flex-1 py-2.5 border border-border text-muted font-bold rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* 8. Customer Modal */}
      <Modal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title={editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
      >
        <form onSubmit={handleCustomerSubmit} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="font-bold text-muted mb-1 block">اسم العميل *</label>
            <input
              type="text"
              required
              value={customerForm.name}
              onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
              className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs focus-visible:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-muted mb-1 block">رقم الهاتف</label>
              <input
                type="text"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs mono focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-muted mb-1 block">فئة التسعير</label>
              <select
                value={customerForm.tier}
                onChange={(e) => setCustomerForm({ ...customerForm, tier: e.target.value as any })}
                className="w-full h-9 rounded-control border border-line bg-surface px-2 text-xs focus-visible:outline-none"
              >
                <option value="retail">تجزئة</option>
                <option value="wholesale">جملة</option>
              </select>
            </div>
          </div>
          <div>
            <label className="font-bold text-muted mb-1 block">سقف الائتمان (د.ل - 0 = بلا حد)</label>
            <input
              type="text"
              inputMode="decimal"
              value={customerForm.creditLimit}
              onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: e.target.value })}
              className="w-full h-9 rounded-control border border-line bg-surface px-2.5 text-xs mono focus-visible:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setShowCustomerModal(false)}
              className="px-4 py-2 border border-border text-muted font-bold rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-jade text-white font-bold rounded-control hover:bg-jade-2 cursor-pointer"
            >
              حفظ البيانات
            </button>
          </div>
        </form>
      </Modal>

      {/* 9. Customer Debt Payment Modal */}
      <Modal
        isOpen={showCustomerPaymentModal}
        onClose={() => setShowCustomerPaymentModal(false)}
        title={`سداد دين العميل: ${payingCustomer?.name || ''}`}
      >
        <form onSubmit={handleCustomerPaymentSubmit} className="flex flex-col gap-4 text-xs">
          <div className="p-3 bg-surface-2 rounded-control border border-line">
            <div className="text-muted">الدين المستحق الحالي:</div>
            <div className="mono font-extrabold text-alert text-xl">
              {formatLYD(payingCustomer?.creditBalance || 0)} د.ل
            </div>
          </div>
          <div>
            <label className="font-bold text-muted mb-1 block">المبلغ المسدد نقداً (د.ل) *</label>
            <input
              type="text"
              inputMode="decimal"
              required
              value={customerPaymentAmount}
              onChange={(e) => setCustomerPaymentAmount(e.target.value)}
              className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm mono font-semibold focus-visible:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-jade text-white font-bold rounded-control hover:bg-jade-2 cursor-pointer"
            >
              تسجيل السداد واستلام النقد
            </button>
            <button
              type="button"
              onClick={() => setShowCustomerPaymentModal(false)}
              className="flex-1 py-2.5 border border-border text-muted font-bold rounded-control hover:text-text cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>

      {/* 10. Special Prices Modal */}
      <Modal
        isOpen={showSpecialPricesModal}
        onClose={() => setShowSpecialPricesModal(false)}
        title={`أسعار خاصة للعميل: ${specialPricesCustomer?.name || ''}`}
        maxWidthClass="max-w-lg"
      >
        <div className="flex flex-col gap-4 text-xs">
          <form onSubmit={handleAddSpecialPriceSubmit} className="grid grid-cols-3 gap-2 bg-surface-2 p-3 rounded-control border border-line items-end">
            <div className="col-span-2">
              <label className="font-bold text-muted mb-1 block">اختر المنتج</label>
              <select
                value={specialPriceForm.productId}
                onChange={(e) => setSpecialPriceForm({ ...specialPriceForm, productId: e.target.value })}
                className="w-full h-8 rounded border border-line bg-surface px-2 text-xs focus-visible:outline-none"
              >
                <option value="">— اختر منتجاً —</option>
                {productsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (التجزئة: {formatLYD(p.retailPrice)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-muted mb-1 block">السعر الخاص</label>
              <input
                type="text"
                inputMode="decimal"
                value={specialPriceForm.price}
                onChange={(e) => setSpecialPriceForm({ ...specialPriceForm, price: e.target.value })}
                className="w-full h-8 rounded border border-line bg-surface px-2 mono text-xs focus-visible:outline-none"
              />
            </div>
            <button
              type="submit"
              className="col-span-3 py-1.5 bg-jade text-white font-bold rounded cursor-pointer mt-1"
            >
              حفظ السعر الخاص
            </button>
          </form>

          <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto">
            {specialPricesList.map((sp) => (
              <div key={sp.id} className="p-2.5 border border-line rounded bg-surface-2 flex justify-between items-center">
                <span className="font-bold">{sp.productName}</span>
                <span className="mono font-bold text-copper">{formatLYD(sp.price)} د.ل</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
};
