// Auto-sync utility - syncs data to server when localStorage changes

let syncTimeout = null;
let isSyncing = false;

/**
 * Returns true if user is signed in with Apple (Supabase).
 */
async function hasSyncAuth() {
  try {
    const { supabase } = await import('@/lib/supabaseClient');
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Debounced sync function - waits for changes to settle before syncing
 */
async function debouncedSync() {
  if (syncTimeout) clearTimeout(syncTimeout);

  syncTimeout = setTimeout(async () => {
    if (isSyncing) return;
    try {
      if (!(await hasSyncAuth())) return;
      isSyncing = true;
      const { uploadData } = await import('./sync');
      await uploadData();
      console.log('Auto-sync completed');
    } catch (error) {
      console.error('Auto-sync error:', error);
    } finally {
      isSyncing = false;
    }
  }, 1000); // 1s debounce so uploads happen quickly for near-instant sync on other devices
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
      e.key === 'sleepHours' ||
      e.key === 'miscHours' ||
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
      key === 'sleepHours' ||
      key === 'miscHours' ||
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
      key === 'sleepHours' ||
      key === 'miscHours' ||
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

