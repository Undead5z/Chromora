import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const CONNECTION_ERROR = 'Cannot connect to Chromora server. Confirm the backend is running and this phone is on the same network.';
export const BACKEND_CONFIGURATION_ERROR = CONNECTION_ERROR;

let lastLoggedApiUrl;
const debugApiConfig = config => { if (__DEV__ && config.apiUrl !== lastLoggedApiUrl) { lastLoggedApiUrl = config.apiUrl; console.info(`[Chromora mobile] Resolved API URL (${config.source}): ${config.apiUrl || 'unresolved'}`); } return config; };
const normalizeApiUrl = value => String(value || '').trim().replace(/\/$/, '');

const hostFromRuntimeValue = value => {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value.includes('://') ? value : `http://${value}`);
    return url.hostname || null;
  } catch {
    return null;
  }
};

const metroHost = () => {
  const candidates = [
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoGoConfig?.hostUri,
    Constants.expoConfig?.hostUri,
    Constants.expoConfig?.extra?.expoClient?.hostUri,
    Constants.linkingUri,
    Constants.manifest2?.extra?.expoClient?.hostUri,
    Constants.manifest?.debuggerHost,
    Constants.manifest?.hostUri
  ];
  return candidates.map(hostFromRuntimeValue).find(host => host && host !== 'localhost' && host !== '127.0.0.1') || null;
};

export const getApiConfig = () => {
  const explicitUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);
  if (explicitUrl) return debugApiConfig({ apiUrl: explicitUrl, source: 'environment' });

  const host = __DEV__ ? metroHost() : null;
  if (host) return debugApiConfig({ apiUrl: `http://${host}:4000/api`, source: 'expo-lan' });

  // localhost is only valid when Expo is running in a browser on this computer.
  if (Platform.OS === 'web') return debugApiConfig({ apiUrl: 'http://localhost:4000/api', source: 'web-localhost' });

  return debugApiConfig({ apiUrl: null, source: 'unresolved', error: BACKEND_CONFIGURATION_ERROR });
};

export const getApiUrl = () => {
  const config = getApiConfig();
  if (!config.apiUrl) throw new Error(config.error);
  return config.apiUrl;
};

export const checkBackendHealth = async () => {
  const config = getApiConfig();
  if (!config.apiUrl) return { available: false, ...config }; 
  const url = `${config.apiUrl}/auth/me`;
  if (__DEV__) console.info(`[Chromora mobile] API request: GET ${url}`, { authenticated: false, reachabilityCheck: true });

  try {
    // /auth/me is authenticated, but its expected 401 response still proves the API is reachable.
    const response = await fetch(url);
    const raw = await response.text();
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { message: raw }; }
    if (__DEV__) console.info(`[Chromora mobile] API response: GET ${url} -> ${response.status}`, body);
    if (response.status >= 500) return { available: false, ...config, status: response.status, message: 'The Chromora server encountered an error. Please try again.' };
    return { available: true, ...config };
  } catch (error) {
    if (__DEV__) console.info(`[Chromora mobile] API network failure: GET ${url}`, error?.message || String(error));
    return { available: false, ...config, error, message: CONNECTION_ERROR };
  }
};
