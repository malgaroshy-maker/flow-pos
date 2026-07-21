import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const { triggerToast } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const res = await r.json();
      if (!r.ok) {
        setError(res.message || 'بيانات الدخول غير صحيحة');
        return;
      }
      login(res.token, res.user);
      triggerToast(`مرحباً بك، ${res.user.username}`);
      if (onSuccess) onSuccess();
    } catch {
      setError('فشل الاتصال بالخادم');
    }
  };

  return (
    <div className="flex min-h-dvh" dir="rtl">
      {/* Left decorative panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: 'var(--gradient-warm)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, var(--jade) 0, var(--jade) 1px, transparent 0, transparent 50%)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10">
          <img
            src="/logo.png"
            alt="Flow Dev Logo"
            className="h-36 w-36 object-contain mb-6 rounded-2xl drop-shadow-xl"
          />
          <h1
            className="text-4xl font-black leading-tight mb-4"
            style={{ color: '#F0EBE0', fontFamily: 'Cairo, sans-serif' }}
          >
            منظومة المبيعات
            <br />
            والمخزون
          </h1>
          <p className="text-base leading-relaxed" style={{ color: '#8C8070' }}>
            نظام متكامل لإدارة مستلزمات المقاهي والمطاعم —<br />
            مبيعات، مخزون، خزينة، وموردين في مكان واحد.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { label: 'إدارة المخزون', icon: '📦' },
            { label: 'نقطة البيع', icon: '🧾' },
            { label: 'إدارة الموردين', icon: '🚚' },
            { label: 'تقارير مالية', icon: '📊' },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-3 rounded-xl p-3"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span className="text-xl">{f.icon}</span>
              <span className="text-xs font-bold" style={{ color: '#C8C0B0' }}>
                {f.label}
              </span>
            </div>
          ))}
        </div>

        <div className="relative z-10 text-xs" style={{ color: '#4A4440' }}>
          © {new Date().getFullYear()} — نظام إدارة متكامل · نسخة محلية بدون إنترنت
        </div>
      </div>

      {/* Right form panel */}
      <div
        className="flex flex-1 items-center justify-center p-8"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex justify-center mb-6">
            <img
              src="/logo.png"
              alt="Flow Dev Logo"
              className="h-28 w-28 object-contain rounded-2xl drop-shadow-lg"
            />
          </div>

          <div className="mb-8">
            <h2
              className="font-display text-2xl font-black mb-1.5"
              style={{ color: 'var(--text)' }}
            >
              مرحباً بك 👋
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              سجّل دخولك للبدء بإدارة المنظومة
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-alert/10 border border-alert/30 text-alert text-xs rounded-control font-bold">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-muted mb-1 block">اسم المستخدم</label>
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-11 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none focus:border-jade"
                placeholder="أدخل اسم المستخدم"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted mb-1 block">كلمة المرور</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-control border border-line bg-surface px-3 text-sm focus-visible:outline-none focus:border-jade"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full h-12 mt-2 bg-jade text-white font-bold rounded-control hover:bg-jade-2 transition-colors cursor-pointer text-sm shadow-md"
            >
              تسجيل الدخول
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
