"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { syncData, uploadData, downloadData, applySyncedData } from '@/lib/sync';
import { supabase } from '@/lib/supabaseClient';

function SettingsContent() {
  const router = useRouter();
  const [defaultGoal, setDefaultGoal] = useState('8');
  const [miscHours, setMiscHours] = useState('0');
  const [timeFormat, setTimeFormat] = useState('12');
  const [weekStart, setWeekStart] = useState('monday');

  // Sign in with Apple (Supabase Auth)
  const [appleUser, setAppleUser] = useState(null);
  const [appleLoading, setAppleLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Sign in with Apple
  const signInWithApple = async () => {
    if (!supabase) {
      alert('Sign in is not configured. Check your environment variables.');
      return;
    }
    setAppleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/settings` : undefined,
        },
      });
      if (error) throw error;
      // Redirect happens via OAuth; no need to update state here
    } catch (err) {
      console.error('Sign in with Apple error:', err);
      alert(err?.message || 'Sign in failed. Please try again.');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleUploadToCloud = async () => {
    if (!appleUser) return;
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      await uploadData();
      setSyncMessage('Data uploaded to cloud.');
      setTimeout(() => setSyncMessage(null), 3000);
    } catch (err) {
      setSyncMessage(err?.message || 'Upload failed.');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDownloadFromCloud = async () => {
    if (!appleUser) return;
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const data = await downloadData();
      if (data) {
        applySyncedData(data);
        setSyncMessage('Data downloaded. Reloading…');
        setTimeout(() => window.location.reload(), 800);
      } else {
        setSyncMessage('No data on cloud yet.');
        setTimeout(() => setSyncMessage(null), 3000);
      }
    } catch (err) {
      setSyncMessage(err?.message || 'Download failed.');
    } finally {
      setSyncLoading(false);
    }
  };

  // Sign out from Apple
  const signOutApple = async () => {
    if (!supabase) return;
    setAppleLoading(true);
    try {
      await supabase.auth.signOut();
      setAppleUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setAppleLoading(false);
    }
  };

  // Load sleep and misc hours from local storage on component mount
  useEffect(() => {
    const savedSleepHours = localStorage.getItem('sleepHours');
    const savedMiscHours = localStorage.getItem('miscHours');
    if (savedSleepHours) {
      setDefaultGoal(savedSleepHours);
    }
    if (savedMiscHours) {
      setMiscHours(savedMiscHours);
    }
  }, []);

  // Supabase Auth: session and OAuth callback
  useEffect(() => {
    if (!supabase) return;
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setAppleUser(session?.user ?? null);
    };
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAppleUser(session?.user ?? null);
    });
    return () => subscription?.unsubscribe();
  }, []);

  // After OAuth redirect: sync first (while hash is still in URL so session is set), then clean URL and reload
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const hash = window.location.hash;
    if (hash.includes('access_token') || hash.includes('refresh_token')) {
      syncData('server').then(() => {
        router.replace('/settings', { scroll: false });
        window.location.reload();
      }).catch((err) => {
        console.error('Sync after Apple sign-in:', err);
        router.replace('/settings', { scroll: false });
      });
    }
  }, [router]);

  // Save sleep hours to local storage when it changes
  const handleSleepHoursChange = (value) => {
    setDefaultGoal(value);
    localStorage.setItem('sleepHours', value);
    // Trigger a custom event to notify the main page
    window.dispatchEvent(new CustomEvent('sleepHoursChanged', { detail: value }));
  };

  // Save misc hours to local storage when it changes
  const handleMiscHoursChange = (value) => {
    setMiscHours(value);
    if (value && parseFloat(value) > 0) {
      localStorage.setItem('miscHours', value);
    } else {
      localStorage.removeItem('miscHours');
    }
    // Trigger a custom event to notify the main page
    window.dispatchEvent(new CustomEvent('miscHoursChanged', { detail: value }));
  };

  const handleResetData = async () => {
    const alsoCloud = appleUser
      ? ' This will also clear your data from the cloud for this account.'
      : '';
    if (!confirm(`Are you sure you want to reset all app data? This cannot be undone.${alsoCloud}`)) {
      return;
    }
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (
          key === 'focusCategories' ||
          key === 'hourglassEvents:v1' ||
          key === 'calendarEvents' ||
          key === 'calendar-items' ||
          key === 'events' ||
          key === 'sleepHours' ||
          key === 'miscHours' ||
          key === 'timeFormat' ||
          key === 'weekStart' ||
          key === 'lastProcessedWeekKey' ||
          key === 'calendar:visibleFocusAreas' ||
          key.startsWith('focusAreas:week:') ||
          key.startsWith('week:') ||
          key.startsWith('notes:') ||
          key.startsWith('eventNotes:')
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      if (appleUser) {
        try {
          await uploadData();
        } catch (e) {
          console.error('Error clearing cloud data:', e);
          alert('Local data cleared. Cloud update failed — other devices may still have old data.');
        }
      }
      alert('App data cleared. The app will reload.');
      window.location.reload();
    } catch (e) {
      console.error('Error resetting app data:', e);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleClearCache = async () => {
    if (confirm('Clear all cached data and reload the app? This will ensure you have the latest version.')) {
      try {
        // Unregister service workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let registration of registrations) {
            await registration.unregister();
          }
        }
        
        // Clear all caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        alert('Cache cleared! The page will now reload.');
        window.location.reload(true);
      } catch (error) {
        console.error('Error clearing cache:', error);
        alert('Error clearing cache. Please try manually: Settings > Clear browsing data > Cached images and files');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-900">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg shadow-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 pt-16 pb-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back</span>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>
      </header>

      {/* Content with top padding to account for fixed header and bottom padding for navigation */}
      <div className="pt-24 pb-32 px-4 py-6 space-y-6">
        {/* Integrations Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Sign in with Apple */}
            <div className="w-full min-w-0 p-4 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex-shrink-0 bg-black rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-1.25 1.62-2.56 3.22-4.32 4.64zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">Sign in with Apple</div>
                  <div className="text-sm text-gray-600 truncate">
                    {appleUser ? `Signed in${appleUser.email ? ` as ${appleUser.email}` : ''}` : 'Sign in to sync your data across devices'}
                  </div>
                </div>
                {!appleUser && (
                  <button
                    onClick={signInWithApple}
                    disabled={appleLoading}
                    className="flex-shrink-0 px-4 py-2 text-sm font-medium text-gray-800 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {appleLoading ? 'Redirecting...' : 'Sign in'}
                  </button>
                )}
              </div>
              {appleUser && (
                <div className="mt-4 w-full min-w-0">
                  <div className="grid grid-cols-3 gap-2 w-full">
                    <button
                      onClick={handleUploadToCloud}
                      disabled={syncLoading}
                      className="min-w-0 px-2 py-2.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 truncate"
                    >
                      {syncLoading ? '…' : 'Upload to cloud'}
                    </button>
                    <button
                      onClick={handleDownloadFromCloud}
                      disabled={syncLoading}
                      className="min-w-0 px-2 py-2.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 truncate"
                    >
                      {syncLoading ? '…' : 'Download from cloud'}
                    </button>
                    <button
                      onClick={signOutApple}
                      disabled={appleLoading}
                      className="min-w-0 px-2 py-2.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 truncate"
                    >
                      {appleLoading ? '…' : 'Sign out'}
                    </button>
                  </div>
                  {syncMessage && (
                    <p className="mt-2 text-xs text-gray-600 truncate">{syncMessage}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* App Preferences Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">App Preferences</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sleep Hours
              </label>
              <input
                type="number"
                value={defaultGoal}
                onChange={(e) => handleSleepHoursChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                min="0"
                step="0.25"
                max="24"
              />
              <div className="text-xs text-gray-500 mt-1">
                Hours reserved for sleep each day (24 - sleep hours = available planning time)
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Miscellaneous Time (Optional)
              </label>
              <input
                type="number"
                value={miscHours}
                onChange={(e) => handleMiscHoursChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                min="0"
                step="0.25"
                max="8"
                placeholder="0.0"
              />
              <div className="text-xs text-gray-500 mt-1">
                Optional time for leisure, breaks, or unplanned activities
              </div>
            </div>
            
            {/* Productive Hours Summary */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-sm text-gray-700">
                <strong>Daily Productive Hours:</strong> {Math.max(0, 24 - parseFloat(defaultGoal || 8) - parseFloat(miscHours || 0))} hours
                <br />
                <strong>Weekly Productive Hours:</strong> {Math.max(0, (24 - parseFloat(defaultGoal || 8) - parseFloat(miscHours || 0)) * 7)} hours
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Format
              </label>
              <select
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
              >
                <option value="12">12-hour (1:30 PM)</option>
                <option value="24">24-hour (13:30)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Week Starts On
              </label>
              <select
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </div>
        </section>



        {/* App Maintenance Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">App Maintenance</h2>
          </div>
          <div className="p-6 space-y-4">
            <button
              onClick={handleClearCache}
              className="w-full flex items-center justify-between p-4 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-purple-900">Clear App Cache</div>
                  <div className="text-sm text-purple-600">Fix issues by clearing cached data</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </section>

        {/* Data Management Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Data Management</h2>
          </div>
          <div className="p-6 space-y-4">
            <button
              onClick={handleResetData}
              className="w-full flex items-center justify-between p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-red-900">Reset App Data</div>
                  <div className="text-sm text-red-600">Clear all data and start fresh</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </section>

        {/* About Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">About</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#8CA4AF] rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Time Macros</div>
                  <div className="text-sm text-gray-600">Focus Area Tracker</div>
                </div>
              </div>
            </div>
            
            <div className="text-center text-sm text-gray-600">
              Version 1.0.1
            </div>
          </div>
        </section>
      </div>

      {/* Bottom navigation: Dashboard | Calendar | Search */}
      <div className="fixed bottom-0 left-0 right-0 p-3 pb-7 z-[9999]">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
          <button
            onClick={() => router.push('/')}
            className="h-12 w-full rounded-2xl bg-white/40 backdrop-blur-xl text-gray-700 font-medium border-2 border-white/50 hover:bg-white/50 transition-all duration-200 shadow-2xl"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push('/calendar')}
            className="h-12 w-full rounded-2xl bg-white/40 backdrop-blur-xl text-gray-700 font-medium border-2 border-white/50 hover:bg-white/50 transition-all duration-200 shadow-2xl"
          >
            Calendar
          </button>
          <button
            onClick={() => router.push('/search')}
            className="h-12 w-full rounded-2xl bg-white/40 backdrop-blur-xl text-gray-700 font-medium border-2 border-white/50 hover:bg-white/50 transition-all duration-200 shadow-2xl"
          >
            Search
          </button>
        </div>
      </div>

    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
