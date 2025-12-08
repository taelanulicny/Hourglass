"use client";

import { useEffect } from 'react';
import { initAutoSync } from '@/lib/autoSync';

export default function SyncProvider() {
  useEffect(() => {
    // Initialize auto-sync when component mounts
    initAutoSync();
    
    // Cleanup on unmount (though this component should never unmount)
    return () => {
      // Auto-sync cleanup is handled internally
    };
  }, []);

  return null; // This component doesn't render anything
}

