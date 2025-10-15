"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState('Your Name');
  const [profilePicture, setProfilePicture] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [defaultGoal, setDefaultGoal] = useState('8');
  const [miscHours, setMiscHours] = useState('0');
  const [timeFormat, setTimeFormat] = useState('12');
  const [weekStart, setWeekStart] = useState('monday');

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
  }, []);

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

  const handleCreateAccount = () => {
    if (!email || !password) {
      alert('Please fill in both email and password.');
      return;
    }
    // TODO: Implement actual account creation logic
    alert('Account creation functionality will be implemented.');
  };

  // Check if neither email nor password are filled to show Create Account button
  const showCreateAccountButton = !email && !password;

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

      {/* Content with top padding to account for fixed header */}
      <div className="pt-24 px-4 py-6 space-y-6">
        {/* Profile Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
          </div>
          <div className="p-6 space-y-4">
            {/* Account Creation Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                placeholder="Enter your email"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#8CA4AF] focus:border-transparent transition-colors"
                  placeholder="Create your password"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              </div>
            </div>

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

            {/* Create Account Button */}
            {showCreateAccountButton && (
              <button
                onClick={handleCreateAccount}
                className="w-full mt-6 px-6 py-4 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
              >
                Create Account
              </button>
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
            <h2 className="text-lg font-semibold text-gray-900">AI Data Management</h2>
          </div>
          <div className="p-6 space-y-4">
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
              Version 1.0.0
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
