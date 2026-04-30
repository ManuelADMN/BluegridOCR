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

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  headers.set('ngrok-skip-browser-warning', 'true');

  return fetch(url, {
    ...options,
    headers,
  });
}
