// Utility for localStorage caching with expiration

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // time to live in milliseconds
}

export class LocalStorageCache {
  static set<T>(key: string, data: T, ttlMinutes: number = 60): void {
    try {
      const item: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000,
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  static get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const item: CacheItem<T> = JSON.parse(cached);
      const now = Date.now();

      if (now - item.timestamp > item.ttl) {
        // Cache expired
        localStorage.removeItem(key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn('Failed to retrieve cached data:', error);
      return null;
    }
  }

  static clear(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  static clearAll(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('Failed to clear all cache:', error);
    }
  }
}

// Cache keys constants
export const CACHE_KEYS = {
  SPECIALTIES: 'specialties',
  OBRAS_SOCIALES: 'obras_sociales',
  DOCTORS: 'doctors',
  PROFILES: 'profiles',
} as const;