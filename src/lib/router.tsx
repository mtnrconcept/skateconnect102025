import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface AppLocation {
  pathname: string;
  search: string;
  hash: string;
}

interface RouterContextValue {
  location: AppLocation;
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

const defaultLocation: AppLocation = {
  pathname: '/',
  search: '',
  hash: '',
};

const RouterContext = createContext<RouterContextValue>({
  location: defaultLocation,
  navigate: () => {
    /* noop */
  },
});

const getCurrentLocation = (): AppLocation => {
  if (typeof window === 'undefined') {
    return defaultLocation;
  }

  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
  };
};

interface RouterProviderProps {
  children: React.ReactNode;
}

export function RouterProvider({ children }: RouterProviderProps) {
  const [location, setLocation] = useState<AppLocation>(() => getCurrentLocation());

  useEffect(() => {
    const handlePopState = () => {
      setLocation(getCurrentLocation());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(to, window.location.origin);
    if (options?.replace) {
      window.history.replaceState(null, '', url);
    } else {
      window.history.pushState(null, '', url);
    }

    setLocation({
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    });
  }, []);

  const value = useMemo<RouterContextValue>(() => ({ location, navigate }), [location, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  return useContext(RouterContext);
}

