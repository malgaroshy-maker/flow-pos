import React, { useState } from 'react';
import type { User, Settings as SettingsType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { apiCall } from '../lib/api';
import { formatDateTime } from '../lib/datetime';

interface SettingsProps {
  onTriggerBackup: () => void;
  onRestoreDb: (filename: string) => void;
  onOpenCreateUserModal: () => void;
  onOpenEditUserModal: (user: User) => void;
  licenseInfo?: {
    active: boolean;
    machineCode: string;
    customerName?: string;
    licenseType?: string;
    expiresAt?: string | null;
  } | null;
}

export const SettingsScreen: React.FC<SettingsProps> = ({
  onTriggerBackup,
  onRestoreDb,
  onOpenCreateUserModal,
  onOpenEditUserModal,
  licenseInfo,
}) => {
  const { currentUser } = useAuth();
  const { settingsData, backupsList, usersList, auditLogsList, refreshAllData, loadBaseData } = useData();
  const { triggerToast } = useToast();

  const [formSettings, setFormSettings] = useState<SettingsType | null>(settingsData);

  // Keep internal form in sync when settingsData loads
  React.useEffect(() => {
    setFormSettings(settingsData);
  }, [settingsData]);

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSettings) return;
    const res = await apiCall('/api/settings', 'PUT', formSettings);
    if (res.success) {
      triggerToast('تم حفظ الإعدادات والبيانات التجارية بنجاح');
      loadBaseData();
    } else {
      triggerToast(res.error || 'فشل حفظ الإعدادات', 'alert');
    }
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <div>
        <span className="mono text-xs tracking-widest text-copper">التحكم والإدارة</span>
        <h1 className="text-3xl font-extrabold">الإعدادات العامة للنشاط</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Store Branded details and tax settings */}
        <div className="lg:col-span-2 rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold">بيانات النشاط التجاري والفواتير</h2>

          <form onSubmit={handleSettingsSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold">
                  اسم النشاط (يظهر في الفاتورة)
                </label>
                <input
                  type="text"
                  value={formSettings?.businessName || ''}
                  onChange={(e) =>
                    setFormSettings(
                      formSettings ? { ...formSettings, businessName: e.target.value } : null
                    )
                  }
                  className="w-full h-10 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold">هاتف النشاط</label>
                <input
                  type="text"
                  value={formSettings?.businessPhone || ''}
                  onChange={(e) =>
                    setFormSettings(
                      formSettings ? { ...formSettings, businessPhone: e.target.value } : null
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
                value={formSettings?.businessAddress || ''}
                onChange={(e) =>
                  setFormSettings(
                    formSettings ? { ...formSettings, businessAddress: e.target.value } : null
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
                    checked={formSettings?.taxEnabled || false}
                    onChange={(e) =>
                      setFormSettings(
                        formSettings ? { ...formSettings, taxEnabled: e.target.checked } : null
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300 text-jade focus:ring-jade"
                  />
                  <span>تفعيل ضريبة المبيعات الإضافية</span>
                </label>

                {formSettings?.taxEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">نسبة الضريبة (بالميل ×10):</span>
                    <input
                      type="number"
                      value={formSettings?.taxRatePermille || 0}
                      onChange={(e) =>
                        setFormSettings(
                          formSettings
                            ? { ...formSettings, taxRatePermille: Number(e.target.value) }
                            : null
                        )
                      }
                      className="w-20 text-left h-8 rounded border border-border bg-surface px-2 mono text-xs focus-visible:outline-none"
                    />
                    <span className="text-xs text-muted">
                      ({((formSettings?.taxRatePermille || 0) / 10).toFixed(1)}%)
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
                  value={formSettings?.discountCapPercent ?? 10}
                  onChange={(e) =>
                    setFormSettings(
                      formSettings
                        ? { ...formSettings, discountCapPercent: Number(e.target.value) }
                        : null
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
          {/* License Information */}
          <div className="rounded-card border border-line bg-surface p-6 flex flex-col gap-3">
            <h2 className="text-lg font-bold">ترخيص المنظومة وهُوية الجهاز</h2>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center border-b border-line pb-2">
                <span className="text-muted font-semibold">حالة الترخيص:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    licenseInfo?.active
                      ? 'bg-jade/10 text-jade border border-jade/30'
                      : 'bg-alert/10 text-alert border border-alert/30'
                  }`}
                >
                  {licenseInfo?.active ? 'مفعل ونشط ✔' : 'غير مفعل ✖'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-line pb-2">
                <span className="text-muted font-semibold">اسم المحل / العميل:</span>
                <span className="font-bold">
                  {licenseInfo?.customerName || settingsData?.businessName || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-line pb-2">
                <span className="text-muted font-semibold">كود الجهاز (Machine Code):</span>
                <span className="mono font-bold text-copper">{licenseInfo?.machineCode || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted font-semibold">نوع الترخيص:</span>
                <span className="font-bold">
                  {licenseInfo?.licenseType === 'commercial'
                    ? 'ترخيص تجاري دائم'
                    : licenseInfo?.licenseType || 'تجاري'}
                </span>
              </div>
            </div>
          </div>

          {/* Backups registry */}
          <div className="rounded-card border border-line bg-surface p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold">النسخ الاحتياطي والاستعادة</h2>

            <button
              onClick={onTriggerBackup}
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
                      onClick={() => onRestoreDb(bk.filename)}
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
                  if (currentUser?.role !== 'manager') {
                    triggerToast('صلاحية المدير مطلوبة لإضافة مستخدمين', 'alert');
                    return;
                  }
                  onOpenCreateUserModal();
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
                      if (currentUser?.role !== 'manager') {
                        triggerToast('صلاحية المدير مطلوبة لتعديل المستخدمين', 'alert');
                        return;
                      }
                      onOpenEditUserModal(usr);
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
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="p-3 font-bold text-text">
                      {log.username || 'نظام تلقائي'}
                    </td>
                    <td className="p-3 mono font-bold text-jade">{log.action}</td>
                    <td className="p-3 text-muted">{log.details || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
