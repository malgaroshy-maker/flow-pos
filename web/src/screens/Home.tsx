import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { currentTheme, toggleTheme } from '../theme';
import { Icons } from '../components/Icons';

interface HomeProps {
  onSelectTab: (tabId: string) => void;
  onOpenShiftModal: () => void;
  onCloseShiftModal: () => void;
  onThemeToggle: () => void;
}

export const Home: React.FC<HomeProps> = ({
  onSelectTab,
  onOpenShiftModal,
  onCloseShiftModal,
  onThemeToggle,
}) => {
  const { currentUser, logout } = useAuth();
  const { settingsData, activeShift } = useData();
  const theme = currentTheme();

  if (!currentUser) return null;

  const tabsList = [
    {
      id: 'Dashboard',
      label: 'لوحة التحكم والإحصائيات',
      desc: 'المبيعات، المصروفات، والمنتجات المنخفضة',
      icon: Icons.Dashboard,
      managerOnly: true,
    },
    {
      id: 'POS',
      label: 'شاشة الكاشير والبيع (POS)',
      desc: 'إصدار الفواتير وطباعتها وتأكيد المبيعات',
      icon: Icons.POS,
      managerOnly: false,
    },
    {
      id: 'Products',
      label: 'إدارة المنتجات والمعدات',
      desc: 'إضافة الأصناف، الأسعار، وحركات المخزون',
      icon: Icons.Products,
      managerOnly: false,
    },
    {
      id: 'Shifts',
      label: 'التوكة والخزينة اليومية',
      desc: 'فتح/إغلاق التوكة وتسجيل المصروفات',
      icon: Icons.Shifts,
      managerOnly: false,
    },
    {
      id: 'Quotations',
      label: 'سجل عروض الأسعار',
      desc: 'إعداد وتحويل عروض الأسعار لفواتير',
      icon: Icons.Receipt,
      managerOnly: false,
    },
    {
      id: 'Purchases',
      label: 'المشتريات والموردين',
      desc: 'تسجيل الفواتير وحسابات الموردين والمرتجعات',
      icon: Icons.Truck,
      managerOnly: true,
    },
    {
      id: 'Customers',
      label: 'العملاء والذمم الآجلة',
      desc: 'حسابات الديون والتحصيل وكشوف الحساب',
      icon: Icons.Users,
      managerOnly: true,
    },
    {
      id: 'Reports',
      label: 'التقارير المالية الموسعة',
      desc: 'تصدير وتقارير المبيعات والأرباح والتصدير',
      icon: Icons.Reports,
      managerOnly: true,
    },
    {
      id: 'Settings',
      label: 'إعدادات المنظومة والنسخ الاحتياطي',
      desc: 'بيانات المحل، المستخدمين، واسترجاع البيانات',
      icon: Icons.Settings,
      managerOnly: true,
    },
  ].filter((item) => !item.managerOnly || currentUser.role === 'manager');

  return (
    <div className="flex min-h-dvh items-center justify-center p-6 sm:p-10" dir="rtl">
      <div className="w-full max-w-[1000px] flex flex-col gap-6">
        {/* Header */}
        <div
          className="flex justify-between items-center p-5 rounded-2xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="Flow Dev"
              className="h-16 w-16 object-contain rounded-2xl flex-shrink-0 shadow-md"
            />
            <div>
              <h1 className="font-display text-2xl font-black" style={{ color: 'var(--text)' }}>
                {settingsData?.businessName ?? 'منظومة مستلزمات المقاهي والمطاعم'}
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                اختر القسم للبدء بالعمل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-left">
              <div
                className="text-xs mb-0.5"
                style={{ color: 'var(--text-muted)', fontFamily: 'Cairo, sans-serif' }}
              >
                مرحباً،
              </div>
              <div
                className="text-sm font-black"
                style={{ color: 'var(--text)', fontFamily: 'Cairo, sans-serif' }}
              >
                {currentUser.username}
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-black"
              style={
                currentUser.role === 'manager'
                  ? {
                      background: 'var(--jade-glow)',
                      color: 'var(--jade)',
                      border: '1px solid color-mix(in srgb, var(--jade) 30%, transparent)',
                    }
                  : {
                      background: 'var(--copper-glow)',
                      color: 'var(--copper)',
                      border: '1px solid color-mix(in srgb, var(--copper) 30%, transparent)',
                    }
              }
            >
              {currentUser.role === 'manager' ? '★ مدير' : 'كاشير'}
            </span>
            <button
              type="button"
              onClick={onThemeToggle}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-base transition-all cursor-pointer hover:-translate-y-0.5"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text-muted)',
              }}
              title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={logout}
              className="h-9 w-9 flex items-center justify-center rounded-xl transition-all cursor-pointer hover:-translate-y-0.5"
              style={{
                border: '1px solid color-mix(in srgb, var(--alert) 25%, transparent)',
                background: 'var(--alert-glow)',
                color: 'var(--alert)',
              }}
              title="تسجيل الخروج"
            >
              <Icons.Power className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Active Shift Banner */}
        {activeShift ? (
          <div
            className="flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold"
            style={{
              background: 'var(--jade-glow)',
              color: 'var(--jade)',
              border: '1px solid color-mix(in srgb, var(--jade) 25%, transparent)',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 rounded-full animate-pulse"
                style={{ background: 'var(--jade)' }}
              />
              <span>
                التوكة مفتوحة: #{activeShift.id} — بدأت الساعة{' '}
                {new Date(activeShift.openedAt).toLocaleTimeString('ar-LY')}
              </span>
            </div>
            <button
              onClick={() => {
                onSelectTab('Shifts');
                onCloseShiftModal();
              }}
              className="px-3.5 py-1 text-xs font-bold rounded-xl bg-white/20 hover:bg-white/30 transition-all cursor-pointer"
            >
              إغلاق وجرد التوكة 🔒
            </button>
          </div>
        ) : (
          <div
            className="flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold"
            style={{
              background: 'var(--alert-glow)',
              color: 'var(--alert)',
              border: '1px solid color-mix(in srgb, var(--alert) 25%, transparent)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--alert)' }} />
              <span>لا توجد توكة مفتوحة حالياً — يلزم فتح توكة لتمكين عمليات البيع</span>
            </div>
            <button
              onClick={onOpenShiftModal}
              className="px-4 py-1.5 text-xs font-black rounded-xl text-white shadow-sm transition-all cursor-pointer hover:scale-105"
              style={{ background: 'var(--gradient-jade)' }}
            >
              ⚡ فتح توكة جديدة
            </button>
          </div>
        )}

        {/* Grid Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tabsList.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="flex flex-col text-right p-6 rounded-2xl transition-all cursor-pointer group hover:-translate-y-1"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor =
                  'color-mix(in srgb, var(--jade) 40%, transparent)';
                e.currentTarget.style.boxShadow = 'var(--shadow-jade)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <div
                className="flex h-13 w-13 items-center justify-center rounded-xl mb-5 transition-all group-hover:scale-110"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                <tab.icon />
              </div>
              <h3
                className="font-display text-lg font-black mb-2 transition-colors"
                style={{ color: 'var(--text)' }}
              >
                {tab.label}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {tab.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex justify-between items-center py-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="mono">
            {new Date().toLocaleDateString('ar-LY', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <span>نظام إدارة محلي · v2.0</span>
        </div>
      </div>
    </div>
  );
};
