import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  Product,
  Sale,
  Shift,
  Expense,
  User,
  Backup,
  Settings,
  Customer,
  Supplier,
  Purchase,
  Quotation,
  Deposit,
} from '../types';
import { useAuth } from './AuthContext';
import { apiCall } from '../lib/api';

interface DataContextType {
  productsList: Product[];
  salesList: Sale[];
  shiftsList: Shift[];
  expensesList: Expense[];
  usersList: User[];
  backupsList: Backup[];
  activeShift: Shift | null;
  settingsData: Settings | null;
  auditLogsList: any[];
  customersList: Customer[];
  suppliersList: Supplier[];
  purchasesList: Purchase[];
  quotationsList: Quotation[];
  depositsList: Deposit[];
  isInitialLoading: boolean;
  dataError: string | null;
  refreshAllData: () => Promise<void>;
  loadBaseData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, currentUser, logout } = useAuth();

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
  const [quotationsList, setQuotationsList] = useState<Quotation[]>([]);
  const [depositsList, setDepositsList] = useState<Deposit[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const loadBaseData = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettingsData(data);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const refreshAllData = useCallback(async () => {
    if (!token) return;

    const onUnauthorized = () => logout();
    let hasError = false;

    const fetchArray = async (url: string) => {
      const res = await apiCall(url, 'GET', undefined, token, onUnauthorized);
      if (!res.success) {
        hasError = true;
        return [];
      }
      return res.data ?? [];
    };

    const isManager = currentUser?.role === 'manager';

    try {
      const [prods, salesRes, exp, cust, supp, pur, quo, dep] = await Promise.all([
        fetchArray('/api/products'),
        fetchArray('/api/sales'),
        fetchArray('/api/expenses'),
        fetchArray('/api/customers'),
        fetchArray('/api/suppliers'),
        fetchArray('/api/purchases'),
        fetchArray('/api/quotations'),
        fetchArray('/api/deposits'),
      ]);

      setProductsList(prods);
      setSalesList(salesRes);
      setExpensesList(exp);
      setCustomersList(cust);
      setSuppliersList(supp);
      setPurchasesList(pur);
      setQuotationsList(quo);
      setDepositsList(dep);

      const shiftRes = await apiCall('/api/shifts/active', 'GET', undefined, token, onUnauthorized);
      if (shiftRes.success) {
        setActiveShift(shiftRes.data?.active ?? null);
      } else {
        hasError = true;
      }

      if (isManager) {
        const [shf, usr, bkp, aud] = await Promise.all([
          fetchArray('/api/shifts'),
          fetchArray('/api/users'),
          fetchArray('/api/backup/list'),
          fetchArray('/api/audit-logs'),
        ]);
        setShiftsList(shf);
        setUsersList(usr);
        setBackupsList(bkp);
        setAuditLogsList(aud);
      } else {
        setShiftsList([]);
        setUsersList([]);
        setBackupsList([]);
        setAuditLogsList([]);
      }

      setDataError(hasError ? 'تعذر تحديث بعض البيانات. تحقق من الاتصال بالشبكة.' : null);
    } catch {
      setDataError('حدث خطأ أثناء تحميل البيانات من الخادم.');
    } finally {
      setIsInitialLoading(false);
    }
  }, [token, currentUser, logout]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    refreshAllData();
  }, [token, refreshAllData]);

  return (
    <DataContext.Provider
      value={{
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
        isInitialLoading,
        dataError,
        refreshAllData,
        loadBaseData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
