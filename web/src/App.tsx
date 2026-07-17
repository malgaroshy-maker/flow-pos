import { useEffect, useState } from 'react';
import { currentTheme, toggleTheme, type Theme } from './theme';

type Health = { status: string; serverTime: string };
type Settings = { businessName: string; currency: string };

const NAV_ITEMS = [
  { label: 'لوحة التحكم', active: true },
  { label: 'نقطة البيع', active: false },
  { label: 'المنتجات', active: false },
  { label: 'حركة المخزون', active: false },
  { label: 'الورديات والخزينة', active: false },
  { label: 'التقارير', active: false },
  { label: 'الإعدادات', active: false },
];

export function App() {
  const [theme, setThemeState] = useState<Theme>(() => currentTheme());
  const [health, setHealth] = useState<Health | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setServerDown(true));
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then(setSettings)
      .catch(() => {});
  }, []);

  return (
    <div className="grid min-h-dvh grid-cols-[272px_1fr] max-[900px]:grid-cols-1">
      {/* Sidebar — quiet chrome: neutral paper, jade only on the active item */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-e border-line bg-surface p-6 min-[901px]:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-jade font-mono text-xs font-bold text-white">
            POS
          </div>
          <div>
            <div className="font-display text-sm font-extrabold">
              {settings?.businessName ?? 'نظام المبيعات والمخزون'}
            </div>
            <div className="mono text-[11px] text-muted">v0.1.0</div>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 text-sm">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href="#"
              className={
                'flex min-h-10 items-center rounded-[9px] border px-3 py-2 transition-colors ' +
                (item.active
                  ? 'border-line bg-surface-2 font-semibold text-jade'
                  : 'border-transparent text-muted hover:bg-surface-2 hover:text-fg')
              }
            >
              {item.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setThemeState(toggleTheme())}
          className="mt-auto flex min-h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface-2 px-4 text-sm text-muted transition-colors hover:text-fg"
        >
          {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الليلي'}
        </button>
      </aside>

      <main className="p-6 md:p-10">
        <p className="mono mb-2 text-xs tracking-[0.08em] text-copper">المرحلة 1 · الأساس</p>
        <h1 className="mb-6 font-display text-3xl font-extrabold">لوحة التحكم</h1>

        <div className="max-w-[560px] rounded-card border border-line bg-surface p-6">
          <h2 className="mb-2 font-display text-base font-bold">حالة النظام</h2>
          {serverDown ? (
            <p className="text-sm text-alert">
              الخادم غير متصل — شغّل الخادم ثم أعد تحميل الصفحة.
            </p>
          ) : health ? (
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">الخادم</dt>
                <dd className="font-semibold text-jade">متصل</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">توقيت الخادم</dt>
                <dd className="mono text-xs">{health.serverTime}</dd>
              </div>
              {settings && (
                <div className="flex items-center justify-between">
                  <dt className="text-muted">العملة</dt>
                  <dd className="mono text-xs">{settings.currency}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted">جارٍ الاتصال بالخادم…</p>
          )}
        </div>
      </main>
    </div>
  );
}
