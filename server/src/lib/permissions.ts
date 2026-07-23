export type UserRole = 'manager' | 'sales' | 'storekeeper';

export type PermissionAction =
  | 'MANAGE_SETTINGS'
  | 'MANAGE_USERS'
  | 'MANAGE_PRODUCTS'
  | 'OVERRIDE_PRICE'
  | 'OVERRIDE_STOCK'
  | 'OVERRIDE_CREDIT'
  | 'VIEW_FINANCIAL_REPORTS'
  | 'BACKUP_RESTORE'
  | 'CANCEL_SALE'
  | 'RETURN_SALE'
  | 'MANAGE_PURCHASES'
  | 'MANAGE_SUPPLIERS'
  | 'MANAGE_EXPENSES'
  | 'CLOSE_SHIFT_OTHER';

const ROLE_PERMISSIONS: Record<PermissionAction, UserRole[]> = {
  MANAGE_SETTINGS: ['manager'],
  MANAGE_USERS: ['manager'],
  MANAGE_PRODUCTS: ['manager'],
  OVERRIDE_PRICE: ['manager'],
  OVERRIDE_STOCK: ['manager'],
  OVERRIDE_CREDIT: ['manager'],
  VIEW_FINANCIAL_REPORTS: ['manager'],
  BACKUP_RESTORE: ['manager'],
  CANCEL_SALE: ['manager'],
  RETURN_SALE: ['manager'],
  MANAGE_PURCHASES: ['manager'],
  MANAGE_SUPPLIERS: ['manager'],
  MANAGE_EXPENSES: ['manager'],
  CLOSE_SHIFT_OTHER: ['manager'],
};

export function hasPermission(role: string | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;
  const allowed = ROLE_PERMISSIONS[action] || ['manager'];
  return allowed.includes(role as UserRole);
}

export function checkPermissionOrThrow(role: string | undefined | null, action: PermissionAction) {
  if (!hasPermission(role, action)) {
    const err = new Error('غير مصرح لك بإجراء هذه العملية — تتطلب صلاحيات مدير');
    (err as any).statusCode = 403;
    throw err;
  }
}
