"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { syncData, uploadData, downloadData, applySyncedData } from '@/lib/sync';
import { supabase } from '@/lib/supabaseClient';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userName, setUserName] = useState('Your Name');
  const [profilePicture, setProfilePicture] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [tempEmail, setTempEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [defaultGoal, setDefaultGoal] = useState('8');
  const [miscHours, setMiscHours] = useState('0');
  const [timeFormat, setTimeFormat] = useState('12');
  const [weekStart, setWeekStart] = useState('monday');
  const [isLoading, setIsLoading] = useState(false);
  
  // Google Calendar integration state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Sign in with Apple (Supabase Auth)
  const [appleUser, setAppleUser] = useState(null);
  const [appleLoading, setAppleLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Check Google Calendar connection status
  const checkGoogleConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/google/status');
      const data = await response.json();
      setGoogleConnected(data.connected || false);
      return data.connected || false;
    } catch (error) {
      console.error('Error checking Google connection:', error);
      setGoogleConnected(false);
      return false;
    }
  }, []);

  // Connect to Google Calendar
  const connectGoogleCalendar = () => {
    window.location.href = '/api/auth/google/authorize';
  };

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

  // Disconnect from Google Calendar
  const disconnectGoogleCalendar = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? Your Google events will no longer appear in the calendar.')) {
      return;
    }
    
    setGoogleLoading(true);
    try {
      const response = await fetch('/api/auth/google/disconnect', { method: 'POST' });
      if (response.ok) {
        setGoogleConnected(false);
      } else {
        alert('Failed to disconnect. Please try again.');
      }
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      alert('Error disconnecting Google Calendar. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Load sleep and misc hours from local storage on component mount
  useEffect(() => {
    const savedSleepHours = localStorage.getItem('sleepHours');
    const savedMiscHours = localStorage.getItem('miscHours');
    const savedUserName = localStorage.getItem('userName');
    const savedProfilePicture = localStorage.getItem('profilePicture');
    const savedEmail = localStorage.getItem('userEmail');
    const savedPassword = localStorage.getItem('userPassword');
    if (savedSleepHours) {
      setDefaultGoal(savedSleepHours);
    }
    if (savedMiscHours) {
      setMiscHours(savedMiscHours);
    }
    if (savedUserName) {
      setUserName(savedUserName);
    }
    if (savedProfilePicture) {
      setProfilePicture(savedProfilePicture);
    }
    if (savedEmail) {
      setEmail(savedEmail);
    }
    if (savedPassword) {
      setPassword(savedPassword);
    }
    
    // Check Google Calendar connection status
    checkGoogleConnection();
  }, [checkGoogleConnection]);

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

  // Handle OAuth callback - automatically sync data when connecting
  useEffect(() => {
    const googleConnected = searchParams?.get('google_connected');
    const error = searchParams?.get('error');
    
    if (googleConnected === 'true') {
      setGoogleConnected(true);
      // Automatically sync data when first connecting (download from cloud)
      // This will pull in data from other devices if it exists
      syncData('server').then(() => {
        // Reload page to apply synced data
        window.location.reload();
      }).catch(err => {
        console.error('Auto-sync failed (this is OK if first time connecting):', err);
        // Don't show error - it's normal if there's no data to sync yet
      });
      // Clean URL
      router.replace('/settings', { scroll: false });
    } else if (error) {
      alert(`Google Calendar connection error: ${error}`);
      // Clean URL
      router.replace('/settings', { scroll: false });
    }
  }, [searchParams, router]);


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

  const handleExportData = () => {
    // Export logic will go here
    alert('Export functionality coming soon!');
  };

  const handleBackupData = () => {
    // Backup logic will go here
    alert('Backup functionality coming soon!');
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset all app data? This cannot be undone.')) {
      // Reset logic will go here
      alert('Reset functionality coming soon!');
    }
  };

  const handleClearAIHistory = () => {
    if (confirm('Are you sure you want to delete all AI conversation history? This cannot be undone.')) {
      try {
        // Get all localStorage keys that start with 'aiHistory:'
        const keys = Object.keys(localStorage);
        const aiHistoryKeys = keys.filter(key => key.startsWith('aiHistory:'));
        
        // Delete all AI history keys
        aiHistoryKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        
        alert(`Successfully deleted ${aiHistoryKeys.length} AI conversation histories.`);
      } catch (error) {
        console.error('Error clearing AI history:', error);
        alert('Error clearing AI history. Please try again.');
      }
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

  const handleProfilePictureChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Check if file is an image
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      
      // Check file size (limit to 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Please select an image smaller than 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target.result;
        setProfilePicture(base64String);
        localStorage.setItem('profilePicture', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfilePicture = () => {
    setProfilePicture(null);
    localStorage.removeItem('profilePicture');
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    localStorage.setItem('userEmail', value);
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    localStorage.setItem('userPassword', value);
  };

  const openAccountModal = () => {
    setTempEmail('');
    setTempPassword('');
    setShowTempPassword(false);
    setShowAccountModal(true);
  };

  const closeAccountModal = () => {
    setShowAccountModal(false);
    setTempEmail('');
    setTempPassword('');
    setShowTempPassword(false);
  };

  const finishCreatingAccount = () => {
    if (!tempEmail || !tempPassword) {
      alert('Please fill in both email and password.');
      return;
    }
    
    // Save to localStorage
    setEmail(tempEmail);
    setPassword(tempPassword);
    localStorage.setItem('userEmail', tempEmail);
    localStorage.setItem('userPassword', tempPassword);
    
    // Close modal and clear temp values
    setShowAccountModal(false);
    setTempEmail('');
    setTempPassword('');
    
    alert('Account information saved!');
  };

  const openLoginModal = () => {
    setLoginEmail('');
    setLoginPassword('');
    setShowLoginPassword(false);
    setShowLoginModal(true);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setLoginEmail('');
    setLoginPassword('');
    setShowLoginPassword(false);
  };

  const handleLogin = () => {
    if (!loginEmail || !loginPassword) {
      alert('Please fill in both email and password.');
      return;
    }
    
    // Set UI state
    setEmail(loginEmail);
    setPassword(loginPassword);
    
    // Save to localStorage
    localStorage.setItem('userEmail', loginEmail);
    localStorage.setItem('userPassword', loginPassword);
    
    // Close modal and clear temp values
    closeLoginModal();
    
    alert('Login successful!');
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout? This will clear your account information.')) {
      // Clear account data from state and localStorage
      setEmail('');
      setPassword('');
      setShowPassword(false);
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userPassword');
      alert('Logged out successfully!');
    }
  };

  // Check authentication state for showing buttons
  const showCreateAccountButton = !email && !password;
  const showLogoutButton = email && email.trim() !== '';

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
        {/* Profile Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Account Information Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                placeholder="No email set"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password ? (showPassword ? password : "••••••••") : ""}
                  readOnly
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl bg-gray-50 text-gray-600"
                  placeholder="No password set"
                />
                {password && (
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      // Eye closed icon
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      // Eye open icon
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Logout Button */}
            {showLogoutButton && (
              <button
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full mt-4 px-4 py-3 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {isLoading ? 'Logging out...' : 'Logout'}
              </button>
            )}

            {/* Create Account and Login Buttons */}
            {showCreateAccountButton && (
              <>
                <button
                  onClick={openAccountModal}
                  disabled={isLoading}
                  className="w-full mt-4 px-6 py-4 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Create Account'}
                </button>
                <button
                  onClick={openLoginModal}
                  disabled={isLoading}
                  className="w-full mt-3 px-6 py-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Login'}
                </button>
              </>
            )}

            <div className="border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  localStorage.setItem('userName', e.target.value);
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                placeholder="Enter your name"
              />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <div className="font-medium text-gray-900">Profile Picture</div>
                <div className="text-sm text-gray-600">
                  {profilePicture ? 'Tap to change' : 'Tap to add a profile picture'}
                </div>
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ zIndex: 1 }}
                />
                <div className="w-12 h-12 bg-[#8CA4AF] rounded-full flex items-center justify-center text-white font-semibold overflow-hidden relative">
                  {profilePicture ? (
                    <img
                      src={profilePicture}
                      alt="Profile"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    userName.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
            </div>
            
            {profilePicture && (
              <button
                onClick={removeProfilePicture}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove Profile Picture
              </button>
            )}
          </div>
        </section>

        {/* Integrations Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Sign in with Apple */}
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-1.25 1.62-2.56 3.22-4.32 4.64zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Sign in with Apple</div>
                  <div className="text-sm text-gray-600">
                    {appleUser ? `Signed in${appleUser.email ? ` as ${appleUser.email}` : ''}` : 'Sign in to sync your data across devices'}
                  </div>
                </div>
              </div>
              {appleUser ? (
                <div className="flex flex-col gap-2 items-end">
                  <div className="flex gap-2">
                    <button
                      onClick={handleUploadToCloud}
                      disabled={syncLoading}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {syncLoading ? '…' : 'Upload to cloud'}
                    </button>
                    <button
                      onClick={handleDownloadFromCloud}
                      disabled={syncLoading}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                      {syncLoading ? '…' : 'Download from cloud'}
                    </button>
                    <button
                      onClick={signOutApple}
                      disabled={appleLoading}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      {appleLoading ? '…' : 'Sign out'}
                    </button>
                  </div>
                  {syncMessage && (
                    <span className="text-xs text-gray-600">{syncMessage}</span>
                  )}
                </div>
              ) : (
                <button
                  onClick={signInWithApple}
                  disabled={appleLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-800 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {appleLoading ? 'Redirecting...' : 'Sign in'}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5 text-blue-600"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Google Calendar</div>
                  <div className="text-sm text-gray-600">
                    {googleConnected ? 'Connected - Your Google Calendar events will appear in the calendar' : 'Connect your Google Calendar to sync events'}
                  </div>
                </div>
              </div>
              {googleConnected ? (
                <button
                  onClick={disconnectGoogleCalendar}
                  disabled={googleLoading}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {googleLoading ? 'Disconnecting...' : 'Disconnect'}
                </button>
              ) : (
                <button
                  onClick={connectGoogleCalendar}
                  disabled={googleLoading}
                  className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  {googleLoading ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
            
            {/* Auto-sync info */}
            {googleConnected && (
              <div className="mt-4 p-3 border border-green-200 rounded-xl bg-green-50">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-green-800">
                    <div className="font-medium mb-1">Automatic Sync Enabled</div>
                    <div className="text-xs text-green-700">
                      Your data automatically syncs across all devices. When you connect Google Calendar on a new device, your data will be there automatically.
                    </div>
                  </div>
                </div>
              </div>
            )}
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



        {/* AI Data Management Section */}
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
            
            <button
              onClick={handleClearAIHistory}
              className="w-full flex items-center justify-between p-4 border border-orange-200 rounded-xl hover:bg-orange-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-orange-900">Clear AI History</div>
                  <div className="text-sm text-orange-600">Delete all AI conversation histories</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              onClick={handleExportData}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Export Data</div>
                  <div className="text-sm text-gray-600">Download your focus area data</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button
              onClick={handleBackupData}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">Backup Data</div>
                  <div className="text-sm text-gray-600">Save your data locally</div>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

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

      {/* Account Creation Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Account</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={tempEmail}
                  onChange={(e) => setTempEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                  placeholder="Enter your email"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showTempPassword ? "text" : "password"}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                    placeholder="Create your password"
                  />
                  <button
                    onClick={() => setShowTempPassword(!showTempPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showTempPassword ? (
                      // Eye closed icon
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      // Eye open icon
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={closeAccountModal}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={finishCreatingAccount}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
              >
                Finish Making Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Login</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                  placeholder="Enter your email"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                    placeholder="Enter your password"
                  />
                  <button
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showLoginPassword ? (
                      // Eye closed icon
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      // Eye open icon
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={closeLoginModal}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogin}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      )}
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
