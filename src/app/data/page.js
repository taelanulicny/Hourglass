"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";

// Hook to get safe area insets for iOS devices
const useSafeAreaInsets = () => {
  const [insets, setInsets] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
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

const COLORS = ["#DDE5ED","#F8E1D9","#E9E5F9","#E6F4EA","#FFF3BF","#FCE1E4","#E0F2FE"];

// Load focus areas from localStorage
function loadFocusAreasSafe() {
  try {
    const raw = localStorage.getItem("focusCategories");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Normalize labels for matching
function normalizeLabel(s) {
  return (s || "").toString().trim().toLowerCase().replace(/[-_]+/g, " ");
}

// Get color for a focus area
function getAreaColor(label, focusAreas) {
  if (!label) return COLORS[2];
  const hit = focusAreas.find(a => normalizeLabel(a.label) === normalizeLabel(label));
  return hit?.color || COLORS[2];
}

// Start of week (Monday)
function startOfWeekMon(d) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Format date helpers
function formatWeekRange(start, end) {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}

function formatDay(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function DataPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isClient, setIsClient] = useState(false);
  const [events, setEvents] = useState([]);
  const [focusAreas, setFocusAreas] = useState([]);
  const [visibleFocusAreas, setVisibleFocusAreas] = useState(new Set());

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load focus areas
  useEffect(() => {
    const areas = loadFocusAreasSafe();
    setFocusAreas(areas);
    // Initialize all focus areas as visible by default
    const visible = new Set(areas.map(a => a.label));
    setVisibleFocusAreas(visible);
    
    // Load saved visibility preferences
    try {
      const saved = localStorage.getItem('schedule:visibleFocusAreas');
      if (saved) {
        const savedSet = new Set(JSON.parse(saved));
        setVisibleFocusAreas(savedSet);
      }
    } catch {}
  }, []);

  // Load events
  useEffect(() => {
    if (!isClient) return;
    
    const loadEvents = () => {
      try {
        const keys = ["hourglassEvents:v1", "calendarEvents", "calendar-items", "events"];
        const allEvents = [];
        const seen = new Set();
        
        for (const key of keys) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          try {
            const arr = JSON.parse(raw) || [];
            if (Array.isArray(arr)) {
              for (const ev of arr) {
                const id = ev?.id || `${ev.title || ""}-${ev.start || ""}`;
                if (id && !seen.has(id)) {
                  seen.add(id);
                  allEvents.push(ev);
                }
              }
            }
          } catch {}
        }
        
        setEvents(allEvents);
      } catch (e) {
        console.warn("Failed to load events", e);
      }
    };
    
    loadEvents();
    
    // Listen for event updates
    const handleUpdate = () => loadEvents();
    window.addEventListener('calendarEventsUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    
    return () => {
      window.removeEventListener('calendarEventsUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [isClient]);

  // Toggle focus area visibility
  const toggleFocusArea = (label) => {
    setVisibleFocusAreas(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      // Save to localStorage
      try {
        localStorage.setItem('schedule:visibleFocusAreas', JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  // Calculate date range: 12 months back to 12 months forward
  const dateRange = useMemo(() => {
    if (!isClient) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setMonth(start.getMonth() - 12);
    start.setDate(1); // Start of month
    
    const end = new Date(today);
    end.setMonth(end.getMonth() + 12);
    end.setDate(0); // Last day of month
    
    return { start, end };
  }, [isClient]);

  // Filter and group events
  const groupedEvents = useMemo(() => {
    if (!isClient || events.length === 0) return [];
    
    // Filter events by date range (show all events, but style unchecked ones differently)
    const filtered = events.filter(ev => {
      const evStart = new Date(ev.start);
      if (evStart < dateRange.start || evStart > dateRange.end) return false;
      return true;
    });

    // Sort by start time
    filtered.sort((a, b) => new Date(a.start) - new Date(b.start));

    // Group by date
    const byDate = new Map();
    filtered.forEach(ev => {
      const evStart = new Date(ev.start);
      const dateKey = evStart.toDateString();
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey).push(ev);
    });

    // Convert to array and group by weeks
    const result = [];
    const processedDates = new Set();
    
    // Get all unique dates sorted
    const sortedDates = Array.from(byDate.keys()).sort((a, b) => 
      new Date(a) - new Date(b)
    );

    sortedDates.forEach(dateStr => {
      const date = new Date(dateStr);
      const weekStart = startOfWeekMon(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekKey = `${weekStart.toDateString()}-${weekEnd.toDateString()}`;
      
      if (!processedDates.has(weekKey)) {
        processedDates.add(weekKey);
        result.push({
          type: 'week',
          weekStart,
          weekEnd,
          dates: []
        });
      }
      
      const weekGroup = result[result.length - 1];
      weekGroup.dates.push({
        date,
        events: byDate.get(dateStr)
      });
    });

    return result;
  }, [events, dateRange, visibleFocusAreas, isClient]);

  // Detect month transitions
  const scheduleWithMonths = useMemo(() => {
    if (groupedEvents.length === 0) return [];
    
    const result = [];
    let currentMonth = null;
    
    groupedEvents.forEach((weekGroup, idx) => {
      const firstDate = weekGroup.dates[0]?.date;
      if (!firstDate) return;
      
      const month = firstDate.getMonth();
      const year = firstDate.getFullYear();
      const monthKey = `${year}-${month}`;
      
      if (currentMonth !== monthKey) {
        currentMonth = monthKey;
        result.push({
          type: 'month',
          month: firstDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          monthShort: firstDate.toLocaleDateString('en-US', { month: 'short' }),
          year: firstDate.getFullYear()
        });
      }
      
      result.push(weekGroup);
    });
    
    return result;
  }, [groupedEvents]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50 text-white pb-24">
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="bg-white/70 backdrop-blur-xl border-b border-white/30 shadow-lg" style={{ paddingTop: `${Math.max(insets.top, 44)}px` }}>
          <header className="px-4 pt-4 pb-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Schedule</h1>
          </header>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 scroll-smooth" style={{ paddingTop: `${Math.max(insets.top, 44) + 80}px` }}>
        <div className="max-w-md mx-auto py-6">
          {!isClient ? (
            <div className="text-center text-gray-600 py-8">Loading...</div>
          ) : scheduleWithMonths.length === 0 ? (
            <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-6 text-center">
              <p className="text-gray-700">No events scheduled. Tap the + button to add events.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {scheduleWithMonths.map((item, idx) => {
                if (item.type === 'month') {
                  return (
                    <div key={`month-${idx}`} className="relative">
                      {/* Month banner */}
                      <div className="sticky top-0 z-10 bg-gradient-to-r from-green-100 to-green-50 border-2 border-green-200 rounded-lg p-4 mb-4 shadow-md">
                        <h2 className="text-lg font-bold text-gray-900">
                          {item.monthShort} {item.year}
                        </h2>
                      </div>
                    </div>
                  );
                }
                
                // Week group
                return (
                  <div key={`week-${idx}`} className="space-y-2">
                    {/* Week header */}
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-2">
                      {formatWeekRange(item.weekStart, item.weekEnd)}
                    </div>
                    
                    {/* Days in week */}
                    {item.dates.map((dayData, dayIdx) => {
                      const isToday = dayData.date.toDateString() === today.toDateString();
                      
                      return (
                        <div key={`day-${dayIdx}`} className="space-y-2">
                          {/* Day header */}
                          <div className="flex items-center gap-2 px-2">
                            <div className={`text-sm font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                              {formatDay(dayData.date)} {dayData.date.getDate()}
                            </div>
                            {dayData.events.length === 0 && (
                              <div className="text-xs text-gray-500">Nothing planned. Tap to create.</div>
                            )}
                          </div>
                          
                          {/* Events for this day */}
                          {dayData.events.map((ev, evIdx) => {
                            const evStart = new Date(ev.start);
                            const evEnd = new Date(ev.end);
                            const areaColor = getAreaColor(ev.area, focusAreas);
                            
                            // Check if this focus area is checked or unchecked
                            // If no area, treat as checked
                            const isChecked = !ev.area || visibleFocusAreas.has(ev.area);
                            
                            return (
                              <div
                                key={ev.id || evIdx}
                                className="rounded-lg p-3 mx-2 cursor-pointer hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: isChecked ? hexToRGBA(areaColor, 0.4) : 'transparent',
                                  borderWidth: '3px',
                                  borderStyle: isChecked ? 'solid' : 'dashed',
                                  borderColor: areaColor,
                                  opacity: isChecked ? 1 : 0.7
                                }}
                                onClick={() => router.push(`/calendar?edit=${ev.id}`)}
                              >
                                <div className={`font-semibold ${isChecked ? 'text-gray-900' : 'text-gray-700'}`}>
                                  {ev.title || ev.area}
                                </div>
                                <div className={`text-sm mt-1 ${isChecked ? 'text-gray-700' : 'text-gray-600'}`}>
                                  {formatTime(evStart)} - {formatTime(evEnd)}
                                </div>
                                {ev.notes && (
                                  <div className={`text-xs mt-1 ${isChecked ? 'text-gray-600' : 'text-gray-500'}`}>
                                    {ev.notes}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
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
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper function to convert hex to RGBA
function hexToRGBA(hex, alpha = 0.55) {
  if (!hex) return `rgba(140, 164, 175, ${alpha})`;
  let h = hex.trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
