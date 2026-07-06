import { getApiBaseUrl } from '../../services/runtimeConfig';

describe('runtimeConfig', () => {
  afterEach(() => {
    delete window.__BLUEGRID_CONFIG__;
  });

  it('prefers runtime configuration over build-time configuration', () => {
    window.__BLUEGRID_CONFIG__ = { API_BASE_URL: 'https://api.bluegrid.test///' };
    expect(getApiBaseUrl()).toBe('https://api.bluegrid.test');
  });

  it('preserves an empty runtime URL for same-origin proxy deployments', () => {
    window.__BLUEGRID_CONFIG__ = { API_BASE_URL: '' };
    expect(getApiBaseUrl()).toBe('');
  });

  it('falls back to the local backend during local development', () => {
    expect(getApiBaseUrl()).toBe('http://localhost:8000');
  });
});
