type RuntimeConfig = {
  API_BASE_URL?: string;
};

declare global {
  interface Window {
    __BLUEGRID_CONFIG__?: RuntimeConfig;
  }
}

export function getApiBaseUrl(): string {
  const runtimeApiUrl = window.__BLUEGRID_CONFIG__?.API_BASE_URL;
  const configuredApiUrl =
    runtimeApiUrl !== undefined ? runtimeApiUrl : import.meta.env.VITE_API_BASE_URL;

  if (configuredApiUrl !== undefined && configuredApiUrl !== null) {
    return configuredApiUrl.replace(/\/+$/, '');
  }

  return (window.location.protocol === 'https:' ? 'https://localhost:8000' : 'http://localhost:8000')
    .replace(/\/+$/, '');
}
