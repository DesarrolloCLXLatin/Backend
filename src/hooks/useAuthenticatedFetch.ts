// useAuthenticatedFetch.ts
import { useCallback } from 'react';

interface FetchOptions extends RequestInit {
  headers?: HeadersInit;
}

export const useAuthenticatedFetch = (iframeToken: string | null) => {
  const authenticatedFetch = useCallback(async (url: string, options: FetchOptions = {}) => {
    if (!iframeToken) {
      throw new Error('No iframe token available');
    }

    const headers = new Headers(options.headers || {});
    
    // Agregar el token del iframe
    headers.set('X-Iframe-Token', iframeToken);
    
    // Mantener Content-Type si está presente
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    return response;
  }, [iframeToken]);

  return authenticatedFetch;
};