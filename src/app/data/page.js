"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";

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
      const monthKey = `${year}-${month + 1}`; // Use 1-based month for consistency
      
      if (currentMonth !== monthKey) {
        currentMonth = monthKey;
        result.push({
          type: 'month',
          month: firstDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          monthShort: firstDate.toLocaleDateString('en-US', { month: 'short' }),
          year: firstDate.getFullYear(),
          monthIndex: month + 1 // Store 1-based month index
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

  const [showSideMenu, setShowSideMenu] = useState(false);
  const scheduleContainerRef = useRef(null);
  const todayRef = useRef(null);
  const [visibleMonth, setVisibleMonth] = useState(null);
  const monthRefs = useRef(new Map());

  // Initialize visible month to current month
  useEffect(() => {
    if (isClient && !visibleMonth) {
      const now = new Date();
      setVisibleMonth({
        month: now.toLocaleDateString('en-US', { month: 'long' }),
        year: now.getFullYear()
      });
    }
  }, [isClient, visibleMonth]);

  // Scroll to today when schedule loads
  useEffect(() => {
    if (isClient && scheduleContainerRef.current && todayRef.current && scheduleWithMonths.length > 0) {
      // Wait for DOM to render
      setTimeout(() => {
        if (scheduleContainerRef.current && todayRef.current) {
          const containerRect = scheduleContainerRef.current.getBoundingClientRect();
          const todayRect = todayRef.current.getBoundingClientRect();
          const scrollTop = scheduleContainerRef.current.scrollTop;
          const targetScrollTop = scrollTop + todayRect.top - containerRect.top - 20; // 20px offset from top
          
          scheduleContainerRef.current.scrollTo({ top: targetScrollTop, behavior: "smooth" });
        }
      }, 200);
    }
  }, [isClient, scheduleWithMonths]);

  // Track visible month as user scrolls
  useEffect(() => {
    if (!isClient || !scheduleContainerRef.current) return;

    const container = scheduleContainerRef.current;
    
    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerTop = containerRect.top;
      const viewportMiddle = containerTop + (containerRect.height / 2);
      
      // Find which month banner is most visible
      let closestMonth = null;
      let closestDistance = Infinity;
      
      monthRefs.current.forEach((ref, key) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        const monthMiddle = rect.top + (rect.height / 2);
        const distance = Math.abs(viewportMiddle - monthMiddle);
        
        if (distance < closestDistance && rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
          closestDistance = distance;
          closestMonth = key;
        }
      });
      
      // If no month is in viewport, find the closest one
      if (!closestMonth) {
        monthRefs.current.forEach((ref, key) => {
          if (!ref) return;
          const rect = ref.getBoundingClientRect();
          const distance = Math.abs(rect.top - containerTop);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestMonth = key;
          }
        });
      }
      
      if (closestMonth) {
        const [year, month] = closestMonth.split('-');
        const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        setVisibleMonth({
          month: monthDate.toLocaleDateString('en-US', { month: 'long' }),
          year: parseInt(year)
        });
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    // Also check on initial load
    handleScroll();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isClient, scheduleWithMonths]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-50 to-pink-50 text-white pb-24">
      {/* Fixed header */}
      <div className="fixed top-0 left-0 right-0 z-50">
        {/* Main header content with safe area padding */}
        <div className="bg-white/70 backdrop-blur-xl border-b border-white/30 shadow-lg" style={{ paddingTop: `${Math.max(insets.top, 44)}px` }}>
          {/* Top bar */}
          <header className="px-4 pt-4 pb-4 flex items-center justify-between relative">
            <div className="flex items-center gap-2">
              {/* Hamburger menu button */}
              <button 
                onClick={() => setShowSideMenu(true)}
                className="text-gray-900 hover:opacity-70 transition-all duration-200 p-2"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
              <div className="font-semibold text-lg text-gray-900">
                {visibleMonth ? `${visibleMonth.month} ${visibleMonth.year}` : 'Schedule'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Today button */}
              <button
                onClick={() => {
                  if (scheduleContainerRef.current && todayRef.current) {
                    const containerRect = scheduleContainerRef.current.getBoundingClientRect();
                    const todayRect = todayRef.current.getBoundingClientRect();
                    const scrollTop = scheduleContainerRef.current.scrollTop;
                    const targetScrollTop = scrollTop + todayRect.top - containerRect.top - 20;
                    scheduleContainerRef.current.scrollTo({ top: targetScrollTop, behavior: "smooth" });
                  }
                }}
                title="Go to today"
                aria-label="Go to today"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-lg border border-white/20 shadow-lg text-gray-900 hover:bg-white/30 transition-all duration-200 font-semibold text-sm"
              >
                {today.getDate()}
              </button>
              <button
                onClick={() => router.push('/settings')}
                title="Settings"
                aria-label="Settings"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-lg border border-white/20 shadow-lg text-gray-900 hover:bg-white/30 transition-all duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </header>
        </div>
      </div>
      
      {/* Side Menu */}
      {showSideMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setShowSideMenu(false)}
          />
          {/* Side menu - positioned below header */}
          <div 
            className="fixed left-0 bottom-0 w-64 bg-white/95 backdrop-blur-xl border-r border-white/30 shadow-2xl z-50 overflow-y-auto scroll-smooth rounded-r-2xl"
            style={{ top: `${Math.max(insets.top, 44) + 76}px` }}
          >
            <div className="p-4">
              {/* View Options */}
              <div className="mb-8">
                <div className="space-y-1">
                  <button
                    className="w-full text-left px-4 py-3 rounded-lg transition-colors text-gray-900 hover:bg-white/20"
                    onClick={() => { router.push('/calendar'); setShowSideMenu(false); }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Calendar</span>
                    </div>
                  </button>
                  <button
                    className="w-full text-left px-4 py-3 rounded-lg transition-colors bg-white/30 text-gray-900 font-medium"
                    onClick={() => { setShowSideMenu(false); }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Schedule</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Focus Areas Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 px-4">Focus Areas</h3>
                <div className="space-y-2">
                  {focusAreas.length > 0 ? (
                    focusAreas.map((area) => {
                      const areaColor = area.color || COLORS[0];
                      const isVisible = visibleFocusAreas.has(area.label);
                      return (
                        <div
                          key={area.label}
                          className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFocusArea(area.label);
                            }}
                            className="flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                            style={{
                              backgroundColor: isVisible ? areaColor : 'transparent',
                              borderColor: areaColor
                            }}
                            aria-label={`${isVisible ? 'Hide' : 'Show'} ${area.label}`}
                          >
                            {isVisible && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          <div
                            className="flex-1 flex items-center gap-3 cursor-pointer"
                            onClick={() => {
                              router.push(`/?focus=${encodeURIComponent(area.label)}`);
                              setShowSideMenu(false);
                            }}
                          >
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: areaColor }}
                            />
                            <span className="text-sm text-gray-900 truncate">{area.label}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-600">No focus areas yet</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main content */}
      <div ref={scheduleContainerRef} className="flex-1 overflow-y-auto scroll-smooth" style={{ paddingTop: `${Math.max(insets.top, 44) + 80}px` }}>
        {!isClient ? (
          <div className="text-center text-gray-600 py-8">Loading...</div>
        ) : scheduleWithMonths.length === 0 ? (
          <div className="px-4">
            <div className="max-w-md mx-auto bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-6 text-center">
              <p className="text-gray-700">No events scheduled. Tap the + button to add events.</p>
            </div>
          </div>
        ) : (
          <div>
            {scheduleWithMonths.map((item, idx) => {
              if (item.type === 'month') {
                // Create a proper month key (year-month format, e.g., "2024-12")
                const monthKey = `${item.year}-${item.monthIndex}`;
                
                return (
                  <div key={`month-${idx}`} className="relative w-full">
                    {/* Month banner - full width */}
                    <div 
                      ref={(el) => {
                        if (el) {
                          monthRefs.current.set(monthKey, el);
                        } else {
                          monthRefs.current.delete(monthKey);
                        }
                      }}
                      className="sticky top-0 z-10 w-full bg-gradient-to-r from-green-100 via-green-50 to-green-100 border-y-2 border-green-200 py-4 px-4 shadow-md"
                    >
                      <h2 className="text-lg font-bold text-gray-900">
                        {item.monthShort} {item.year}
                      </h2>
                    </div>
                  </div>
                );
              }
              
              // Week group - constrained width
              return (
                <div key={`week-${idx}`} className="px-4">
                  <div className="max-w-md mx-auto space-y-2 py-2">
                    {/* Week header */}
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-2">
                      {formatWeekRange(item.weekStart, item.weekEnd)}
                    </div>
                    
                    {/* Days in week */}
                    {item.dates.map((dayData, dayIdx) => {
                      const isToday = dayData.date.toDateString() === today.toDateString();
                      
                      return (
                        <div key={`day-${dayIdx}`} className="space-y-2" ref={isToday ? todayRef : null}>
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
                                className="rounded-lg px-3 py-2 mx-2 cursor-pointer hover:opacity-80 transition-opacity"
                                style={{
                                  backgroundColor: isChecked ? hexToRGBA(areaColor, 0.4) : 'transparent',
                                  borderWidth: '2px',
                                  borderStyle: isChecked ? 'solid' : 'dashed',
                                  borderColor: areaColor,
                                  opacity: isChecked ? 1 : 0.7
                                }}
                                onClick={() => router.push(`/calendar?edit=${ev.id}`)}
                              >
                                <div className={`font-semibold text-sm ${isChecked ? 'text-gray-900' : 'text-gray-700'}`}>
                                  {ev.title || ev.area}
                                </div>
                                <div className={`text-xs mt-0.5 ${isChecked ? 'text-gray-700' : 'text-gray-600'}`}>
                                  {formatTime(evStart)} - {formatTime(evEnd)}
                                </div>
                                {ev.notes && (
                                  <div className={`text-xs mt-0.5 ${isChecked ? 'text-gray-600' : 'text-gray-500'}`}>
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
                </div>
              );
            })}
          </div>
        )}
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
