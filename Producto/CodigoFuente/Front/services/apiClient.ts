import { bgoLog } from './logger';

export function getAuthToken(): string | null {
  return localStorage.getItem('bluegridocr_token');
}

export function clearAuthToken(): void {
  localStorage.removeItem('bluegridocr_token');
}

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();

  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('ngrok-skip-browser-warning', 'true');

  const method = (options.method || 'GET').toUpperCase();
  const shortUrl = url.replace(/^https?:\/\/[^/]+/, '');
  bgoLog.step('API', `${method} ${shortUrl}`);
  const t0 = Date.now();

  const response = await fetch(url, { ...options, headers });

  const ms = Date.now() - t0;
  if (response.ok) {
    bgoLog.info('API', `${method} ${shortUrl} → ${response.status} (${ms}ms)`);
  } else {
    bgoLog.error('API', `${method} ${shortUrl} → ${response.status} (${ms}ms)`);
  }

  return response;
}
