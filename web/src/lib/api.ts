// API helper functions for the Flow POS application.

const TOKEN_KEY = 'pos-token';
const USER_KEY = 'pos-user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): any | null {
  const saved = localStorage.getItem(USER_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: any): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export type ApiResponse<T = any> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function apiCall<T = any>(
  url: string,
  method: string = 'GET',
  body?: any,
  token?: string | null,
  onUnauthorized?: () => void
): Promise<ApiResponse<T>> {
  const activeToken = token !== undefined ? token : getStoredToken();
  if (!activeToken) {
    return { success: false, error: 'no_token' };
  }

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${activeToken}`,
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      if (onUnauthorized) {
        onUnauthorized();
      }
      throw new Error('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || data.error || 'حدث خطأ غير متوقع');
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function uploadProductImage(
  productId: number,
  file: File,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const r = await fetch(`/api/products/${productId}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return { success: false, error: data.message || 'فشل رفع صورة المنتج' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
