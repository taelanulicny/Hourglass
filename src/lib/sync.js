// Sync utility functions for cross-device data synchronization

import { supabase } from '@/lib/supabaseClient';

/**
 * Get auth headers for sync API (Supabase JWT when signed in with Apple)
 */
async function getSyncAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

/**
 * Collect all app data from localStorage
 */
export function collectAllAppData() {
  try {
    const data = {
      // Focus areas
      focusCategories: localStorage.getItem('focusCategories'),
      
      // Events
      hourglassEvents: localStorage.getItem('hourglassEvents:v1'),
      calendarEvents: localStorage.getItem('calendarEvents'),
      
      // User settings
      sleepHours: localStorage.getItem('sleepHours'),
      miscHours: localStorage.getItem('miscHours'),
      timeFormat: localStorage.getItem('timeFormat'),
      weekStart: localStorage.getItem('weekStart'),
      
      // Week-specific focus area data
      weekData: {},
      lastProcessedWeekKey: localStorage.getItem('lastProcessedWeekKey'),
    };

    // Collect all week-specific data
    const weekKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('focusAreas:week:') || key.startsWith('week:'))) {
        weekKeys.push(key);
      }
    }
    
    weekKeys.forEach(key => {
      data.weekData[key] = localStorage.getItem(key);
    });

    // Collect notes data
    const notesKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('notes:')) {
        notesKeys.push(key);
      }
    }
    
    data.notes = {};
    notesKeys.forEach(key => {
      data.notes[key] = localStorage.getItem(key);
    });

    // Collect event notes
    const eventNotesKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('eventNotes:')) {
        eventNotesKeys.push(key);
      }
    }
    
    data.eventNotes = {};
    eventNotesKeys.forEach(key => {
      data.eventNotes[key] = localStorage.getItem(key);
    });

    return data;
  } catch (error) {
    console.error('Error collecting app data:', error);
    return null;
  }
}

/**
 * Apply synced data to localStorage
 */
export function applySyncedData(syncedData) {
  try {
    if (!syncedData) return;

    // Apply focus areas
    if (syncedData.focusCategories) {
      localStorage.setItem('focusCategories', syncedData.focusCategories);
    }

    // Apply events (prefer v1, fallback to legacy)
    if (syncedData.hourglassEvents) {
      localStorage.setItem('hourglassEvents:v1', syncedData.hourglassEvents);
    }
    if (syncedData.calendarEvents) {
      localStorage.setItem('calendarEvents', syncedData.calendarEvents);
    }

    // Apply user settings
    if (syncedData.sleepHours !== undefined) {
      if (syncedData.sleepHours) {
        localStorage.setItem('sleepHours', syncedData.sleepHours);
      } else {
        localStorage.removeItem('sleepHours');
      }
    }
    if (syncedData.miscHours !== undefined) {
      if (syncedData.miscHours) {
        localStorage.setItem('miscHours', syncedData.miscHours);
      } else {
        localStorage.removeItem('miscHours');
      }
    }
    if (syncedData.timeFormat) {
      localStorage.setItem('timeFormat', syncedData.timeFormat);
    }
    if (syncedData.weekStart) {
      localStorage.setItem('weekStart', syncedData.weekStart);
    }

    // Apply week-specific data
    if (syncedData.weekData) {
      Object.entries(syncedData.weekData).forEach(([key, value]) => {
        if (value) {
          localStorage.setItem(key, value);
        }
      });
    }

    if (syncedData.lastProcessedWeekKey) {
      localStorage.setItem('lastProcessedWeekKey', syncedData.lastProcessedWeekKey);
    }

    // Apply notes
    if (syncedData.notes) {
      Object.entries(syncedData.notes).forEach(([key, value]) => {
        if (value) {
          localStorage.setItem(key, value);
        }
      });
    }

    // Apply event notes
    if (syncedData.eventNotes) {
      Object.entries(syncedData.eventNotes).forEach(([key, value]) => {
        if (value) {
          localStorage.setItem(key, value);
        }
      });
    }

    // Trigger events to notify components
    window.dispatchEvent(new Event('calendarEventsUpdated'));
    window.dispatchEvent(new Event('focusAreasUpdated'));
    window.dispatchEvent(new Event('syncDataApplied'));
  } catch (error) {
    console.error('Error applying synced data:', error);
  }
}

/**
 * Upload data to server
 */
export async function uploadData() {
  try {
    const data = collectAllAppData();
    if (!data) {
      throw new Error('Failed to collect data');
    }

    const headers = await getSyncAuthHeaders();
    const response = await fetch('/api/sync/data', {
      method: 'POST',
      headers,
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload data');
    }

    return true;
  } catch (error) {
    console.error('Error uploading data:', error);
    throw error;
  }
}

/**
 * Download data from server
 */
export async function downloadData() {
  try {
    const headers = await getSyncAuthHeaders();
    const response = await fetch('/api/sync/data', { headers });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Not authenticated');
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to download data');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error downloading data:', error);
    throw error;
  }
}

/**
 * Sync data (download and merge with local)
 */
export async function syncData(mergeStrategy = 'server') {
  try {
    const serverData = await downloadData();
    
    if (!serverData) {
      // No server data, upload local data
      await uploadData();
      return { action: 'uploaded', data: null };
    }

    if (mergeStrategy === 'server') {
      // Use server data (overwrite local)
      applySyncedData(serverData);
      return { action: 'downloaded', data: serverData };
    } else if (mergeStrategy === 'merge') {
      // Merge strategy: combine both, prefer newer data
      const localData = collectAllAppData();
      const merged = { ...localData, ...serverData };
      applySyncedData(merged);
      await uploadData(); // Upload merged data
      return { action: 'merged', data: merged };
    } else {
      // Default: upload local data (overwrite server)
      await uploadData();
      return { action: 'uploaded', data: null };
    }
  } catch (error) {
    console.error('Error syncing data:', error);
    throw error;
  }
}

