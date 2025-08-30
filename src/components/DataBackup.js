"use client";
import { useState, useEffect } from 'react';
import dataPersistence from '../utils/dataPersistence';

const DataBackup = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [message, setMessage] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const exportData = async () => {
    setIsExporting(true);
    setMessage('');
    
    try {
      const data = await dataPersistence.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `time-macros-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage('✅ Data exported successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      setMessage('❌ Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const importData = async () => {
    if (!importFile) {
      setMessage('❌ Please select a file to import.');
      return;
    }

    setIsImporting(true);
    setMessage('');
    
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      
      // Validate the data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid backup file format');
      }
      
      await dataPersistence.importData(data);
      setMessage('✅ Data imported successfully! The page will reload to apply changes.');
      
      // Reload page after successful import
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error('Import failed:', error);
      setMessage('❌ Import failed. Please check your backup file.');
    } finally {
      setIsImporting(false);
      setImportFile(null);
    }
  };

  const getStorageInfo = async () => {
    try {
      if (typeof window === 'undefined') return;
      const info = await dataPersistence.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to get storage info:', error);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Don't render on server side
  if (!isClient) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Backup & Storage</h3>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Backup & Storage</h3>
      
      {/* Storage Information */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Storage Usage</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">localStorage</div>
            {storageInfo ? (
              <div className="text-sm">
                <div className="font-medium text-gray-900">
                  {formatBytes(storageInfo.localStorage.used)}
                </div>
                <div className="text-xs text-gray-500">
                  of {formatBytes(storageInfo.localStorage.available)}
                </div>
              </div>
            ) : (
              <button
                onClick={getStorageInfo}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Check Usage
              </button>
            )}
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">IndexedDB</div>
            {storageInfo ? (
              <div className="text-sm">
                <div className="font-medium text-gray-900">
                  {formatBytes(storageInfo.indexedDB.used)}
                </div>
                <div className="text-xs text-gray-500">
                  of {formatBytes(storageInfo.indexedDB.available)}
                </div>
              </div>
            ) : (
              <button
                onClick={getStorageInfo}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Check Usage
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Export Section */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Export Data</h4>
        <p className="text-xs text-gray-500 mb-3">
          Download a backup of all your focus areas, events, and settings. This file can be used to restore your data on another device or after clearing browser data.
        </p>
        <button
          onClick={exportData}
          disabled={isExporting}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isExporting ? 'Exporting...' : 'Export All Data'}
        </button>
      </div>

      {/* Import Section */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Import Data</h4>
        <p className="text-xs text-gray-500 mb-3">
          Restore your data from a backup file. This will replace all existing data, so make sure to export first if needed.
        </p>
        
        <div className="flex space-x-2">
          <input
            type="file"
            accept=".json"
            onChange={(e) => setImportFile(e.target.files[0])}
            className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={importData}
            disabled={!importFile || isImporting}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isImporting ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-3 rounded-md text-sm ${
          message.startsWith('✅') 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {/* PWA Benefits */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Pro Tip</h4>
        <p className="text-xs text-blue-800">
          For the best data persistence experience, add Time Macros to your home screen. This provides offline access and better data storage capabilities.
        </p>
      </div>
    </div>
  );
};

export default DataBackup;
