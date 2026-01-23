// Auto-sync utility - syncs data to server when localStorage changes

let syncTimeout = null;
let isSyncing = false;

/**
 * Debounced sync function - waits for changes to settle before syncing
 */
async function debouncedSync() {
  // Clear existing timeout
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  // Set new timeout - sync after 2 seconds of no changes
  syncTimeout = setTimeout(async () => {
    if (isSyncing) return;
    
    try {
      // Check if Google Calendar is connected
      const response = await fetch('/api/auth/google/status');
      const data = await response.json();
      
      if (!data.connected) {
        // Not connected, skip sync
        return;
      }

      isSyncing = true;
      const { uploadData } = await import('./sync');
      await uploadData();
      console.log('Auto-sync completed');
    } catch (error) {
      console.error('Auto-sync error:', error);
      // Don't show error to user - auto-sync should be silent
    } finally {
      isSyncing = false;
    }
  }, 2000); // Wait 2 seconds after last change
}

/**
 * Initialize auto-sync - listens for localStorage changes
 */
export function initAutoSync() {
  if (typeof window === 'undefined') return;

  // Listen for storage events (cross-tab)
  window.addEventListener('storage', (e) => {
    if (e.key && (
      e.key.startsWith('hourglassEvents') ||
      e.key.startsWith('calendarEvents') ||
      e.key === 'focusCategories' ||
      e.key.startsWith('googleEventCustomizations') ||
      e.key === 'sleepHours' ||
      e.key === 'miscHours' ||
      e.key === 'userName' ||
      e.key === 'profilePicture' ||
      e.key.startsWith('focusAreas:week:') ||
      e.key.startsWith('week:') ||
      e.key.startsWith('notes:') ||
      e.key.startsWith('eventNotes:')
    )) {
      debouncedSync();
    }
  });

  // Override localStorage.setItem to detect changes
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    
    // Check if this is a key we care about
    if (
      key.startsWith('hourglassEvents') ||
      key.startsWith('calendarEvents') ||
      key === 'focusCategories' ||
      key.startsWith('googleEventCustomizations') ||
      key === 'sleepHours' ||
      key === 'miscHours' ||
      key === 'userName' ||
      key === 'profilePicture' ||
      key.startsWith('focusAreas:week:') ||
      key.startsWith('week:') ||
      key.startsWith('notes:') ||
      key.startsWith('eventNotes:')
    ) {
      debouncedSync();
    }
  };

  // Override localStorage.removeItem to detect changes
  const originalRemoveItem = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function(key) {
    originalRemoveItem.apply(this, arguments);
    
    // Check if this is a key we care about
    if (
      key.startsWith('hourglassEvents') ||
      key.startsWith('calendarEvents') ||
      key === 'focusCategories' ||
      key.startsWith('googleEventCustomizations') ||
      key === 'sleepHours' ||
      key === 'miscHours' ||
      key === 'userName' ||
      key === 'profilePicture' ||
      key.startsWith('focusAreas:week:') ||
      key.startsWith('week:') ||
      key.startsWith('notes:') ||
      key.startsWith('eventNotes:')
    ) {
      debouncedSync();
    }
  };
}

/**
 * Stop auto-sync
 */
export function stopAutoSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
    syncTimeout = null;
  }
}

