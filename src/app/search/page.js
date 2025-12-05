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

// Helper function to convert hex to RGBA
function hexToRGBA(hex, alpha = 0.4) {
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

// Format date and time helpers
function formatDate(date) {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateTime(date) {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

export default function SearchPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isClient, setIsClient] = useState(false);
  const [events, setEvents] = useState([]);
  const [focusAreas, setFocusAreas] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFocusArea, setSelectedFocusArea] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all"); // all, past, future

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load focus areas
  useEffect(() => {
    const areas = loadFocusAreasSafe();
    setFocusAreas(areas);
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

  // Filter and search events
  const filteredEvents = useMemo(() => {
    if (!isClient) return [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filtered = events.filter(ev => {
      const evStart = new Date(ev.start);
      const evDate = new Date(evStart);
      evDate.setHours(0, 0, 0, 0);
      
      // Time filter (past/future/all)
      if (timeFilter === "past" && evDate >= today) return false;
      if (timeFilter === "future" && evDate < today) return false;
      
      // Focus area filter
      if (selectedFocusArea !== "all" && ev.area !== selectedFocusArea) return false;
      
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = (ev.title || "").toLowerCase();
        const notes = (ev.notes || "").toLowerCase();
        const area = (ev.area || "").toLowerCase();
        
        if (!title.includes(query) && !notes.includes(query) && !area.includes(query)) {
          return false;
        }
      }
      
      return true;
    });
    
    // Sort by date (most recent first for past, soonest first for future)
    filtered.sort((a, b) => {
      const dateA = new Date(a.start);
      const dateB = new Date(b.start);
      if (timeFilter === "past") {
        return dateB - dateA; // Most recent first
      } else if (timeFilter === "future") {
        return dateA - dateB; // Soonest first
      } else {
        // All: past events first (most recent), then future events (soonest)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateAOnly = new Date(dateA);
        dateAOnly.setHours(0, 0, 0, 0);
        const dateBOnly = new Date(dateB);
        dateBOnly.setHours(0, 0, 0, 0);
        
        const aIsPast = dateAOnly < today;
        const bIsPast = dateBOnly < today;
        
        if (aIsPast && !bIsPast) return -1; // Past before future
        if (!aIsPast && bIsPast) return 1; // Future after past
        if (aIsPast && bIsPast) return dateB - dateA; // Most recent past first
        return dateA - dateB; // Soonest future first
      }
    });
    
    return filtered;
  }, [events, searchQuery, selectedFocusArea, timeFilter, isClient]);

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
            <div className="flex items-center gap-2">
              <button 
                onClick={() => router.back()}
                className="text-gray-900 hover:opacity-70 transition-all duration-200 p-2"
                aria-label="Back"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="font-semibold text-lg text-gray-900">Search Events</h1>
            </div>
          </header>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto" style={{ paddingTop: `${Math.max(insets.top, 44) + 80}px` }}>
        {!isClient ? (
          <div className="text-center text-gray-600 py-8">Loading...</div>
        ) : (
          <div className="px-4 py-4 max-w-md mx-auto">
            {/* Search bar */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search events, notes, focus areas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-10 bg-white/90 backdrop-blur-lg rounded-xl border border-white/30 shadow-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
                <svg 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filters */}
            <div className="mb-4 flex gap-2 flex-wrap">
              {/* Time filter */}
              <div className="flex gap-2 bg-white/90 backdrop-blur-lg rounded-xl p-2 border border-white/30 shadow-lg">
                <button
                  onClick={() => setTimeFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    timeFilter === "all"
                      ? "bg-slate-500 text-white"
                      : "text-gray-700 hover:bg-white/50"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTimeFilter("past")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    timeFilter === "past"
                      ? "bg-slate-500 text-white"
                      : "text-gray-700 hover:bg-white/50"
                  }`}
                >
                  Past
                </button>
                <button
                  onClick={() => setTimeFilter("future")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    timeFilter === "future"
                      ? "bg-slate-500 text-white"
                      : "text-gray-700 hover:bg-white/50"
                  }`}
                >
                  Future
                </button>
              </div>

              {/* Focus area filter */}
              {focusAreas.length > 0 && (
                <select
                  value={selectedFocusArea}
                  onChange={(e) => setSelectedFocusArea(e.target.value)}
                  className="px-3 py-1.5 bg-white/90 backdrop-blur-lg rounded-xl border border-white/30 shadow-lg text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="all">All Focus Areas</option>
                  {focusAreas.map((area) => (
                    <option key={area.label} value={area.label}>
                      {area.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Results count */}
            <div className="mb-4 text-sm text-gray-700">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} found
            </div>

            {/* Results */}
            {filteredEvents.length === 0 ? (
              <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-6 text-center">
                <p className="text-gray-700">
                  {searchQuery.trim() || selectedFocusArea !== "all" || timeFilter !== "all"
                    ? "No events match your search criteria."
                    : "No events found. Add events from the calendar."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEvents.map((ev) => {
                  const evStart = new Date(ev.start);
                  const evEnd = new Date(ev.end);
                  const evDate = new Date(evStart);
                  evDate.setHours(0, 0, 0, 0);
                  const isPast = evDate < today;
                  const isToday = evDate.getTime() === today.getTime();
                  const areaColor = getAreaColor(ev.area, focusAreas);

                  return (
                    <div
                      key={ev.id || `${ev.title}-${ev.start}`}
                      onClick={() => {
                        const evDate = new Date(ev.start);
                        const dateStr = `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, '0')}-${String(evDate.getDate()).padStart(2, '0')}`;
                        router.push(`/calendar?edit=${ev.id}&date=${dateStr}&view=Day`);
                      }}
                      className="bg-white/90 backdrop-blur-lg rounded-xl border border-white/30 shadow-lg p-4 cursor-pointer hover:shadow-xl transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {/* Color indicator */}
                        <div
                          className="w-1 h-full rounded-full flex-shrink-0"
                          style={{ backgroundColor: areaColor, minHeight: '40px' }}
                        />
                        
                        <div className="flex-1 min-w-0">
                          {/* Title */}
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {ev.title || ev.area || "Untitled Event"}
                          </h3>
                          
                          {/* Date and time */}
                          <div className="text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>
                                {formatDate(evStart)} • {formatTime(evStart)} - {formatTime(evEnd)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Focus area */}
                          {ev.area && (
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: areaColor }}
                              />
                              <span className="text-xs text-gray-600">{ev.area}</span>
                            </div>
                          )}
                          
                          {/* Notes */}
                          {ev.notes && (
                            <p className="text-sm text-gray-600 line-clamp-2">{ev.notes}</p>
                          )}
                          
                          {/* Past/Future indicator */}
                          <div className="mt-2">
                            {isToday ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                Today
                              </span>
                            ) : isPast ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Past
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
            className="h-12 w-full rounded-2xl bg-white/40 backdrop-blur-xl text-gray-700 font-semibold border-2 border-white/50 shadow-2xl"
            disabled
            aria-current="page"
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}

