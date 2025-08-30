// Enhanced data persistence for PWA home screen apps
// Provides fallback storage and better data management

class DataPersistence {
  constructor() {
    this.dbName = 'TimeMacrosDB';
    this.dbVersion = 1;
    this.db = null;
    this.isIndexedDBSupported = typeof window !== 'undefined' && 'indexedDB' in window;
    this.isLocalStorageSupported = typeof window !== 'undefined' && 'localStorage' in window;
  }

  // Initialize IndexedDB
  async initDB() {
    if (typeof window === 'undefined') return false;
    if (!this.isIndexedDBSupported) return false;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores for different data types
        if (!db.objectStoreNames.contains('focusAreas')) {
          const focusAreasStore = db.createObjectStore('focusAreas', { keyPath: 'key' });
          focusAreasStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('events')) {
          const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
          eventsStore.createIndex('date', 'date', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // Store data with fallback strategy
  async setItem(key, value, options = {}) {
    if (typeof window === 'undefined') return false;
    
    const data = {
      value,
      timestamp: Date.now(),
      version: options.version || '1.0'
    };

    // Try IndexedDB first (larger storage, better for PWA)
    if (this.isIndexedDBSupported && this.db) {
      try {
        const transaction = this.db.transaction(['focusAreas', 'events', 'settings'], 'readwrite');
        const store = this.getStoreForKey(key, transaction);
        
        if (store) {
          await new Promise((resolve, reject) => {
            const request = store.put({ key, ...data });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
          return true;
        }
      } catch (error) {
        console.warn('IndexedDB storage failed, falling back to localStorage:', error);
      }
    }

    // Fallback to localStorage
    if (this.isLocalStorageSupported) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error('localStorage also failed:', error);
        return false;
      }
    }

    return false;
  }

  // Retrieve data with fallback strategy
  async getItem(key, defaultValue = null) {
    if (typeof window === 'undefined') return defaultValue;
    
    // Try IndexedDB first
    if (this.isIndexedDBSupported && this.db) {
      try {
        const transaction = this.db.transaction(['focusAreas', 'events', 'settings'], 'readonly');
        const store = this.getStoreForKey(key, transaction);
        
        if (store) {
          const data = await new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          
          if (data) {
            return data.value;
          }
        }
      } catch (error) {
        console.warn('IndexedDB retrieval failed, trying localStorage:', error);
      }
    }

    // Fallback to localStorage
    if (this.isLocalStorageSupported) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          return data.value;
        }
      } catch (error) {
        console.error('localStorage retrieval failed:', error);
      }
    }

    return defaultValue;
  }

  // Remove data
  async removeItem(key) {
    if (typeof window === 'undefined') return;
    
    // Try IndexedDB first
    if (this.isIndexedDBSupported && this.db) {
      try {
        const transaction = this.db.transaction(['focusAreas', 'events', 'settings'], 'readwrite');
        const store = this.getStoreForKey(key, transaction);
        
        if (store) {
          await new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
      } catch (error) {
        console.warn('IndexedDB removal failed:', error);
      }
    }

    // Also remove from localStorage
    if (this.isLocalStorageSupported) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('localStorage removal failed:', error);
      }
    }
  }

  // Get store based on key pattern
  getStoreForKey(key, transaction) {
    if (key.includes('focusCategories') || key.includes('focusNotes')) {
      return transaction.objectStore('focusAreas');
    } else if (key.includes('Events') || key.includes('Reminders')) {
      return transaction.objectStore('events');
    } else {
      return transaction.objectStore('settings');
    }
  }

  // Export all data for backup
  async exportData() {
    const data = {};
    
    // Export from IndexedDB
    if (this.isIndexedDBSupported && this.db) {
      try {
        const stores = ['focusAreas', 'events', 'settings'];
        for (const storeName of stores) {
          const transaction = this.db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const allData = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          data[storeName] = allData;
        }
      } catch (error) {
        console.warn('IndexedDB export failed:', error);
      }
    }

    // Export from localStorage
    if (this.isLocalStorageSupported) {
      try {
        data.localStorage = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            data.localStorage[key] = localStorage.getItem(key);
          }
        }
      } catch (error) {
        console.error('localStorage export failed:', error);
      }
    }

    return data;
  }

  // Import data from backup
  async importData(data) {
    try {
      // Import to IndexedDB
      if (this.isIndexedDBSupported && this.db && data.focusAreas) {
        const transaction = this.db.transaction(['focusAreas', 'events', 'settings'], 'readwrite');
        
        for (const storeName of ['focusAreas', 'events', 'settings']) {
          if (data[storeName]) {
            const store = transaction.objectStore(storeName);
            for (const item of data[storeName]) {
              await new Promise((resolve, reject) => {
                const request = store.put(item);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              });
            }
          }
        }
      }

      // Import to localStorage
      if (this.isLocalStorageSupported && data.localStorage) {
        for (const [key, value] of Object.entries(data.localStorage)) {
          localStorage.setItem(key, value);
        }
      }

      return true;
    } catch (error) {
      console.error('Data import failed:', error);
      return false;
    }
  }

  // Clear all data
  async clearAll() {
    // Clear IndexedDB
    if (this.isIndexedDBSupported && this.db) {
      try {
        const stores = ['focusAreas', 'events', 'settings'];
        for (const storeName of stores) {
          const transaction = this.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          await new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }
      } catch (error) {
        console.warn('IndexedDB clear failed:', error);
      }
    }

    // Clear localStorage
    if (this.isLocalStorageSupported) {
      try {
        localStorage.clear();
      } catch (error) {
        console.error('localStorage clear failed:', error);
      }
    }
  }

  // Get storage usage info
  async getStorageInfo() {
    const info = {
      localStorage: { used: 0, available: 0 },
      indexedDB: { used: 0, available: 0 }
    };

    // Check localStorage usage
    if (this.isLocalStorageSupported) {
      try {
        let used = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            used += localStorage.getItem(key).length;
          }
        }
        info.localStorage.used = used;
        info.localStorage.available = 5 * 1024 * 1024; // 5MB typical limit
      } catch (error) {
        console.error('localStorage info failed:', error);
      }
    }

    // Check IndexedDB usage (approximate)
    if (this.isIndexedDBSupported && this.db) {
      try {
        const stores = ['focusAreas', 'events', 'settings'];
        let totalSize = 0;
        
        for (const storeName of stores) {
          const transaction = this.db.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const allData = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          
          totalSize += JSON.stringify(allData).length;
        }
        
        info.indexedDB.used = totalSize;
        info.indexedDB.available = 50 * 1024 * 1024; // 50MB typical limit
      } catch (error) {
        console.warn('IndexedDB info failed:', error);
      }
    }

    return info;
  }
}

// Create singleton instance
const dataPersistence = new DataPersistence();

// Initialize on module load (only on client side)
if (typeof window !== 'undefined') {
  dataPersistence.initDB().catch(console.error);
}

export default dataPersistence;
