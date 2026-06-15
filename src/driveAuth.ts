// Intercept all Firebase Auth toolkit requests to bypass CORS/Referrer policy restrictions
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  const customFetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let targetInput = input;
    if (typeof input === 'string') {
      if (input.includes('identitytoolkit.googleapis.com')) {
        const url = new URL(input);
        const proxyPath = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        targetInput = `/api/firebase-proxy/identitytoolkit/${proxyPath}${url.search}`;
        console.log(`[Firebase Interceptor] Routing identitytoolkit to proxy:`, targetInput);
      } else if (input.includes('securetoken.googleapis.com')) {
        const url = new URL(input);
        const proxyPath = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
        targetInput = `/api/firebase-proxy/securetoken/${proxyPath}${url.search}`;
        console.log(`[Firebase Interceptor] Routing securetoken to proxy:`, targetInput);
      }
    } else if (input instanceof URL) {
      if (input.host === 'identitytoolkit.googleapis.com') {
        const proxyPath = input.pathname.startsWith('/') ? input.pathname.substring(1) : input.pathname;
        targetInput = `/api/firebase-proxy/identitytoolkit/${proxyPath}${input.search}`;
        console.log(`[Firebase Interceptor] Routing URL identitytoolkit to proxy:`, targetInput);
      } else if (input.host === 'securetoken.googleapis.com') {
        const proxyPath = input.pathname.startsWith('/') ? input.pathname.substring(1) : input.pathname;
        targetInput = `/api/firebase-proxy/securetoken/${proxyPath}${input.search}`;
        console.log(`[Firebase Interceptor] Routing URL securetoken to proxy:`, targetInput);
      }
    } else if (input && typeof input === 'object' && 'url' in input) {
      const reqUrl = (input as any).url;
      if (typeof reqUrl === 'string') {
        if (reqUrl.includes('identitytoolkit.googleapis.com')) {
          const url = new URL(reqUrl);
          const proxyPath = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
          const proxyUrl = `/api/firebase-proxy/identitytoolkit/${proxyPath}${url.search}`;
          console.log(`[Firebase Interceptor] Routing Request identitytoolkit to proxy:`, proxyUrl);
          try {
            const newReq = new Request(proxyUrl, input as RequestInit);
            return originalFetch(newReq, init);
          } catch (err) {
            console.error("Failed to construct proxy Request object:", err);
          }
        } else if (reqUrl.includes('securetoken.googleapis.com')) {
          const url = new URL(reqUrl);
          const proxyPath = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
          const proxyUrl = `/api/firebase-proxy/securetoken/${proxyPath}${url.search}`;
          console.log(`[Firebase Interceptor] Routing Request securetoken to proxy:`, proxyUrl);
          try {
            const newReq = new Request(proxyUrl, input as RequestInit);
            return originalFetch(newReq, init);
          } catch (err) {
            console.error("Failed to construct proxy Request object:", err);
          }
        }
      }
    }
    return originalFetch(targetInput, init);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch (error) {
    console.warn("[Firebase Interceptor] Object.defineProperty(window, 'fetch') failed, trying Window.prototype:", error);
    try {
      Object.defineProperty(Window.prototype, 'fetch', {
        value: customFetch,
        configurable: true,
        writable: true,
        enumerable: true
      });
    } catch (protoError) {
      console.error("[Firebase Interceptor] Critical: Failed to override window.fetch:", protoError);
    }
  }
}

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

const provider = new GoogleAuthProvider();
// Request Workspace Drive scopes
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive');

let isSigningIn = false;

// Attempt to restore token from localStorage upon initial load
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;
let cachedUserInfo: any = null;

try {
  cachedAccessToken = localStorage.getItem('google_drive_access_token');
  tokenExpiry = Number(localStorage.getItem('google_drive_token_expiry') || '0');
  const storedUser = localStorage.getItem('google_drive_user_info');
  if (storedUser) {
    cachedUserInfo = JSON.parse(storedUser);
  }
  
  if (cachedAccessToken && tokenExpiry) {
    const isExpired = Date.now() >= tokenExpiry - 30000; // 30 seconds safety margin
    if (isExpired) {
      cachedAccessToken = null;
      tokenExpiry = 0;
      cachedUserInfo = null;
      localStorage.removeItem('google_drive_access_token');
      localStorage.removeItem('google_drive_token_expiry');
      localStorage.removeItem('google_drive_user_info');
    } else {
      window.googleDriveAccessToken = cachedAccessToken;
    }
  }
} catch (e) {
  console.error('Failed to restore Google Drive token from localStorage:', e);
}

// Function to check if the token is valid
const isTokenValid = (): boolean => {
  if (!cachedAccessToken || !tokenExpiry) return false;
  return Date.now() < tokenExpiry - 30000;
};

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: any, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Force clean if it expired while page was idling
  if (!isTokenValid()) {
    cachedAccessToken = null;
    tokenExpiry = 0;
    cachedUserInfo = null;
    try {
      localStorage.removeItem('google_drive_access_token');
      localStorage.removeItem('google_drive_token_expiry');
      localStorage.removeItem('google_drive_user_info');
    } catch (e) {}
    window.googleDriveAccessToken = null;
  }

  // Set the token immediately on window just in case
  if (cachedAccessToken) {
    window.googleDriveAccessToken = cachedAccessToken;
  }

  // Fire success immediately if we have a valid cached token and user info
  if (isTokenValid() && cachedAccessToken && cachedUserInfo) {
    window.dispatchEvent(new CustomEvent('google-drive-ready', { detail: cachedAccessToken }));
    if (onAuthSuccess) onAuthSuccess(cachedUserInfo, cachedAccessToken);
  } else if (!isTokenValid()) {
    window.dispatchEvent(new CustomEvent('google-drive-lost'));
    if (onAuthFailure) onAuthFailure();
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (isTokenValid() && cachedAccessToken) {
        window.googleDriveAccessToken = cachedAccessToken;
        const userInfo = {
          displayName: user.displayName || cachedUserInfo?.displayName,
          email: user.email || cachedUserInfo?.email,
          photoURL: user.photoURL || cachedUserInfo?.photoURL
        };
        cachedUserInfo = userInfo;
        try {
          localStorage.setItem('google_drive_user_info', JSON.stringify(userInfo));
        } catch (e) {
          console.warn('Unable to persist Google Drive user info:', e);
        }
        window.dispatchEvent(new CustomEvent('google-drive-ready', { detail: cachedAccessToken }));
        if (onAuthSuccess) onAuthSuccess(userInfo, cachedAccessToken);
      } else {
        // Token has expired or is missing
        cachedAccessToken = null;
        tokenExpiry = 0;
        cachedUserInfo = null;
        try {
          localStorage.removeItem('google_drive_access_token');
          localStorage.removeItem('google_drive_token_expiry');
          localStorage.removeItem('google_drive_user_info');
        } catch (e) {}
        window.googleDriveAccessToken = null;
        window.dispatchEvent(new CustomEvent('google-drive-lost'));
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      // Firebase might lose the session, but if we still have a valid token, DO NOT CLEAR IT!
      // Only clear if the token itself is invalid.
      if (!isTokenValid() || !cachedUserInfo) {
        cachedAccessToken = null;
        tokenExpiry = 0;
        cachedUserInfo = null;
        try {
          localStorage.removeItem('google_drive_access_token');
          localStorage.removeItem('google_drive_token_expiry');
          localStorage.removeItem('google_drive_user_info');
        } catch (e) {}
        window.googleDriveAccessToken = null;
        window.dispatchEvent(new CustomEvent('google-drive-lost'));
        if (onAuthFailure) onAuthFailure();
      } else {
        // Token is still valid, but Firebase User is null. We treat it as success.
        window.googleDriveAccessToken = cachedAccessToken;
        window.dispatchEvent(new CustomEvent('google-drive-ready', { detail: cachedAccessToken }));
        if (onAuthSuccess) onAuthSuccess(cachedUserInfo, cachedAccessToken!);
      }
    }
  });
};

// Start Google sign-in flow
export const googleSignIn = async (): Promise<{ user: any; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    // access tokens usually expire in 3600 seconds. Set slightly lower for safety margin.
    tokenExpiry = Date.now() + 3550 * 1000; 

    const userInfo = {
      displayName: result.user.displayName,
      email: result.user.email,
      photoURL: result.user.photoURL
    };
    cachedUserInfo = userInfo;

    try {
      localStorage.setItem('google_drive_access_token', cachedAccessToken);
      localStorage.setItem('google_drive_token_expiry', String(tokenExpiry));
      localStorage.setItem('google_drive_user_info', JSON.stringify(userInfo));
    } catch (e) {
      console.warn('Unable to persist Google Drive token to localStorage:', e);
    }

    window.googleDriveAccessToken = cachedAccessToken;
    window.dispatchEvent(new CustomEvent('google-drive-ready', { detail: cachedAccessToken }));
    return { user: userInfo, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (e) {
    console.error('Firebase signOut error:', e);
  }
  cachedAccessToken = null;
  tokenExpiry = 0;
  cachedUserInfo = null;
  try {
    localStorage.removeItem('google_drive_access_token');
    localStorage.removeItem('google_drive_token_expiry');
    localStorage.removeItem('google_drive_user_info');
  } catch (e) {
    console.warn('Unable to remove items from localStorage:', e);
  }
  window.googleDriveAccessToken = null;
  window.dispatchEvent(new CustomEvent('google-drive-lost'));
};

export const getAccessToken = async (): Promise<string | null> => {
  if (isTokenValid()) {
    return cachedAccessToken;
  }
  return null;
};

// Support manual token entry as a robust fallback for iframe/cookie restrictions
export const manualTokenSignIn = async (accessToken: string, email?: string): Promise<{ user: any; accessToken: string }> => {
  cachedAccessToken = accessToken;
  tokenExpiry = Date.now() + 3550 * 1000; // 1 hour expiry
  const userInfo = {
    displayName: "Session Google Drive (Manuel)",
    email: email || "conducteur@convoyage.com",
    photoURL: null
  };
  cachedUserInfo = userInfo;
  try {
    localStorage.setItem('google_drive_access_token', cachedAccessToken);
    localStorage.setItem('google_drive_token_expiry', String(tokenExpiry));
    localStorage.setItem('google_drive_user_info', JSON.stringify(userInfo));
  } catch (e) {
    console.warn('Unable to persist Google Drive token to localStorage:', e);
  }
  window.googleDriveAccessToken = cachedAccessToken;
  window.dispatchEvent(new CustomEvent('google-drive-ready', { detail: cachedAccessToken }));
  return { user: userInfo, accessToken: cachedAccessToken };
};

// Declare types on window
declare global {
  interface Window {
    googleDriveAccessToken: string | null;
  }
}
