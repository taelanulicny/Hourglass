"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Hook to get safe area insets for iOS devices
const useSafeAreaInsets = () => {
  const [insets, setInsets] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check if we're on iOS and get safe area insets
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      // Get safe area insets from CSS environment variables
      const style = getComputedStyle(document.documentElement);
      const top = parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10);
      const right = parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10);
      const bottom = parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10);
      const left = parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10);
      
      setInsets({ top, right, bottom, left });
    }
  }, [isClient]);

  return insets;
};

export default function DataPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50 text-white pb-24">
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-white/70 backdrop-blur-xl border-b border-white/30 shadow-lg" style={{ paddingTop: `${Math.max(insets.top, 44)}px` }}>
          <header className="px-4 pt-4 pb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Data</h1>
          </header>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 scroll-smooth" style={{ paddingTop: `${Math.max(insets.top, 44) + 80}px` }}>
        <div className="max-w-md mx-auto py-6">
          <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pie Charts</h2>
            <p className="text-gray-700">Pie charts with labels will be displayed here.</p>
          </div>
        </div>
      </div>

      {/* Floating action button for adding events */}
      <button
        onClick={() => router.push('/calendar?new=1')}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-slate-500/80 backdrop-blur-lg text-white flex items-center justify-center shadow-xl border border-white/20 z-50 hover:bg-slate-600/80 transition-all"
        aria-label="Add Event"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Bottom navigation: Dashboard | Calendar | Data */}
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
            className="h-12 w-full rounded-2xl bg-white/40 backdrop-blur-xl text-gray-700 font-semibold border-2 border-white/50 shadow-2xl"
            disabled
            aria-current="page"
          >
            Data
          </button>
        </div>
      </div>
    </div>
  );
}

