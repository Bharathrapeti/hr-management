export type Role = 'employee' | 'hr' | 'manager';
export type LoginMode = 'login' | 'signup' | 'reset';
export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: 'EMPLOYEE' | 'HR_ADMIN';
  effectiveRoles?: string[];
  permissions?: string[];
};
export type AuthMessage = { message: string };

export const authBaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'https://hr-management-2-5b76.onrender.com';

let inMemoryCsrfToken: string | null = null;
let csrfInFlight: Promise<string | null> | null = null;

export function getInMemoryCsrfToken(): string | null {
  return inMemoryCsrfToken;
}

export function setInMemoryCsrfToken(token: string | null): void {
  inMemoryCsrfToken = token;
}

export function resetCsrfState(): void {
  inMemoryCsrfToken = null;
  csrfInFlight = null;
}

export function csrfCookie(): string | undefined {
  if (typeof document === 'undefined' || !document.cookie) return undefined;
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('XSRF-TOKEN='))
    ?.split('=')[1];
}

export async function ensureCsrf(force = false): Promise<string | null> {
  if (!force && inMemoryCsrfToken) return inMemoryCsrfToken;
  if (csrfInFlight) return csrfInFlight;

  csrfInFlight = (async () => {
    try {
      const data = await authRequest<{ token?: string }>('/api/auth/csrf');
      if (data?.token) {
        inMemoryCsrfToken = data.token;
      }
      return inMemoryCsrfToken;
    } finally {
      csrfInFlight = null;
    }
  })();

  return csrfInFlight;
}

export async function authRequest<T>(
  path: string,
  options: RequestInit = {},
  retryOnCsrf = false
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');

  if (method !== 'GET') {
    const token = inMemoryCsrfToken || csrfCookie();
    if (token) headers.set('X-XSRF-TOKEN', decodeURIComponent(token));
  }

  let response: Response;
  try {
    response = await fetch(`${authBaseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new Error('Unable to connect to the authentication service. Please check that the backend is running.');
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const isCsrfFailure = response.status === 403 && method !== 'GET' && !body?.error;

    if (isCsrfFailure) {
      inMemoryCsrfToken = null;

      // Safe, single-retry mechanism:
      // Only retry when explicitly opted in (e.g. login), never on requests that create accounts or dispatch OTPs
      if (retryOnCsrf) {
        try {
          await ensureCsrf(true);
          return await authRequest<T>(path, options, false);
        } catch {
          // If retry fails, proceed to standard error throw below
        }
      }
    }

    if (body?.error && typeof body.error === 'string') {
      throw new Error(body.error);
    }
    if (body?.message && typeof body.message === 'string') {
      throw new Error(body.message);
    }

    if (response.status === 403) {
      throw new Error('Security validation failed. Please refresh the page and try again.');
    }
    if (response.status === 400) {
      throw new Error('Invalid request. Please check the entered information.');
    }
    if (response.status === 429) {
      throw new Error('Too many requests. Please try again later.');
    }
    if (response.status >= 500) {
      throw new Error('Authentication service error. Please try again shortly.');
    }

    throw new Error('Authentication request failed.');
  }

  return body as T;
}
