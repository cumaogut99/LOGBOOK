import { useState, useEffect } from 'react';

// Generic hook for fetching data from API
export function useQuery<T>(fetchFn: () => Promise<T>, deps: any[] = []): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await fetchFn();
        if (isMounted) {
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, deps);

  return data;
}

// Hook to trigger re-fetch
export function useRefetch() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const refetch = () => {
    setRefreshKey(prev => prev + 1);
  };

  return { refreshKey, refetch };
}

