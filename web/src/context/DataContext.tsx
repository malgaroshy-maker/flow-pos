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

    const fetchArray = async (url: string) => {
      const res = await apiCall(url, 'GET', undefined, token, onUnauthorized);
      return res.success ? res.data : [];
    };

    const isManager = currentUser?.role === 'manager';

    fetchArray('/api/products').then(setProductsList);
    fetchArray('/api/sales').then(setSalesList);
    fetchArray('/api/expenses').then(setExpensesList);
    fetchArray('/api/customers').then(setCustomersList);
    fetchArray('/api/suppliers').then(setSuppliersList);
    fetchArray('/api/purchases').then(setPurchasesList);
    fetchArray('/api/quotations').then(setQuotationsList);
    fetchArray('/api/deposits').then(setDepositsList);

    apiCall('/api/shifts/active', 'GET', undefined, token, onUnauthorized).then((res) => {
      setActiveShift(res.success ? res.data?.active ?? null : null);
    });

    // Manager-only data: skip for sales role (server 403s /api/shifts; the
    // rest is only consumed by manager-only screens anyway)
    if (isManager) {
      fetchArray('/api/shifts').then(setShiftsList);
      fetchArray('/api/users').then(setUsersList);
      fetchArray('/api/backup/list').then(setBackupsList);
      fetchArray('/api/audit-logs').then(setAuditLogsList);
    } else {
      setShiftsList([]);
      setUsersList([]);
      setBackupsList([]);
      setAuditLogsList([]);
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
