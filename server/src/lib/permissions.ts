import type { FastifyReply, FastifyRequest } from 'fastify';

export type UserRole = 'manager' | 'sales';

/**
 * Central permission registry mapping system actions to allowed roles.
 * Adding future roles (e.g. 'storekeeper') is purely a data change here.
 */
export const PERMISSIONS: Record<string, UserRole[]> = {
  // Manager-only actions
  'manage_users': ['manager'],
  'manage_settings': ['manager'],
  'manage_products': ['manager'],
  'manage_suppliers': ['manager'],
  'manage_customers': ['manager'],
  'manage_purchases': ['manager'],
  'view_reports': ['manager'],
  'backup_restore': ['manager'],
  'apply_stocktake_variance': ['manager'],

  // Shared actions (manager + sales)
  'create_sale': ['manager', 'sales'],
  'create_quotation': ['manager', 'sales'],
  'open_close_shift': ['manager', 'sales'],
  'record_customer_payment': ['manager', 'sales'],
  'view_products': ['manager', 'sales'],
  'view_notifications': ['manager', 'sales'],
};

export function hasPermission(role: UserRole, action: string): boolean {
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function checkPermission(req: FastifyRequest, reply: FastifyReply, action: string): boolean {
  const role = req.user?.role as UserRole | undefined;
  if (!role || !hasPermission(role, action)) {
    reply.code(403).send({
      error: 'forbidden',
      message: 'ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء',
    });
    return false;
  }
  return true;
}
