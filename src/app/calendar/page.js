// REPLACED FILE: day view calendar, not week view
"use client";
import { useEffect, useMemo, useState, useRef, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

// Add client-side only rendering hook to prevent hydration mismatches
const useClientOnly = () => {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
};

// Hook to get safe area insets for iOS devices
const useSafeAreaInsets = () => {
  const [insets, setInsets] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const isClient = useClientOnly();

  useEffect(() => {
    if (!isClient) return;

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

// Hours shown in the day view (24h: 0..23)
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 24h: 0..23
const DAYS = ["Su","M","Tu","W","Th","F","Sa"]; // for the top strip only


function formatHour(h) {
  const period = h < 12 ? "AM" : "PM";
  const disp = h % 12 === 0 ? 12 : h % 12;
  return `${disp} ${period}`;
}

// Format a Date or timestamp as "h:mm AM/PM"
function formatTime12(dateOrMs){
  const d = new Date(dateOrMs);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr12 = ((h + 11) % 12) + 1;
  return `${hr12}:${m} ${ampm}`;
}


// Soft colors for events
const COLORS = ["#DDE5ED","#F8E1D9","#E9E5F9","#E6F4EA","#FFF3BF","#FCE1E4","#E0F2FE"];

// Load current focus areas from storage (safe)
function loadFocusAreasSafe() {
  try {
    const raw = localStorage.getItem("focusCategories");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}


// Convert a hex or rgb(a) color to rgba with given alpha (0..1)
function toRGBA(color, alpha = 0.4) {
  if (!color) return `rgba(0,0,0,${alpha})`;
  const c = color.trim();

  // #RRGGBB or #RGB
  if (/^#([0-9a-f]{3}){1,2}$/i.test(c)) {
    let r, g, b;
    if (c.length === 4) {
      r = parseInt(c[1] + c[1], 16);
      g = parseInt(c[2] + c[2], 16);
      b = parseInt(c[3] + c[3], 16);
    } else {
      r = parseInt(c.slice(1, 3), 16);
      g = parseInt(c.slice(3, 5), 16);
      b = parseInt(c.slice(5, 7), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // rgb(...) or rgba(...)
  const rgbMatch = c.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map(x => x.trim());
    const [r, g, b] = parts;
    return `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, ${alpha})`;
  }

  // Fallback: keep original (browser will handle it)
  return c;
}

// --- Ring formatting helpers to match Dashboard ---
function fmt1(n){
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return v.toFixed(1).replace(/\.0$/, '');
}
function hrUnit(n){
  return Number(n) === 1 ? 'hr' : 'hrs';
}
// Show minutes if under 1 hour, else hours with one decimal (no space, e.g. "1hr")
function formatCenterAmount(hoursFloat){
  const h = Math.max(0, Number(hoursFloat) || 0);
  if (h < 1) {
    const mins = Math.round(h * 60);
    // Use shorter text to fit better in the ring
    const unit = mins === 1 ? 'min' : 'min';
    return `${mins}${unit}`; // "0min", "30min" instead of "0 mins", "30 mins"
  }
  return `${fmt1(h)}${hrUnit(h)}`;
}

// Cross‑browser UUID (iOS Safari fallback)
function makeId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      // Set version (4) and variant bits per RFC 4122
      buf[6] = (buf[6] & 0x0f) | 0x40;
      buf[8] = (buf[8] & 0x3f) | 0x80;
      const hex = Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  } catch {}
  // Last‑ditch unique-ish id
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
}


const DEFAULT_DRAFT = {
  title: "",
  area: "",
  dateYMD: "", // yyyy-mm-dd of the event day
  start: "09:00",
  end: "10:00",
  notes: "",
};

// Returns default start/end times rounded to the next hour and capped at day-end
function nextHourDefaults(baseDate = new Date()) {
  const d = new Date(baseDate);
  const mins = d.getMinutes();
  let startH = d.getHours();

  // Round up to next hour if there are minutes.
  if (mins > 0) {
    startH += 1;
    // If the rounded hour would be 11 PM, default to 12:00–01:00 instead.
    if (startH === 23) {
      return { start: "00:00", end: "01:00" };
    }
  }

  // Safety clamp if ever beyond the day.
  if (startH >= 24) {
    return { start: "23:00", end: "23:59" };
  }

  const endH = Math.min(23, startH + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return { start: `${pad(startH)}:00`, end: `${pad(endH)}:00` };
}

function startOfWeek(d) {
  const x = new Date(d);
  // Make Sunday the first day of week (match screenshots)
  const day = x.getDay(); // 0 = Su
  x.setHours(0,0,0,0);
  x.setDate(x.getDate() - day);
  return x;
}

function msToHHMM(ms) {
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function hhmmToMsOfDay(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  return (hh * 60 + mm) * 60000;
}
function endFromStartAndDur(startHHMM, durMs) {
  const startMs = hhmmToMsOfDay(startHHMM);
  const minsTotal = Math.floor((startMs + (durMs || 0)) / 60000);
  const clampedMins = Math.min(Math.max(minsTotal, 0), 23 * 60 + 59); // cap at 23:59
  const h = Math.floor(clampedMins / 60);
  const m = clampedMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Parse YYYY-MM-DD as local date (avoid timezone shifts)
function parseYMD(s) {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// Format yyyy-mm-dd
function ymd(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// Start of week (Monday) for weekly snapshots used by Dashboard
function startOfWeekMon(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  const day = x.getDay(); // 0..6 (Sun..Sat)
  // shift so Monday is 0
  const diff = (day + 6) % 7; // Su=6, Mo=0, Tu=1, ...
  x.setDate(x.getDate() - diff);
  return x;
}

// Prefer the weekly snapshot for the selected week; fall back to live list
function loadFocusAreasForDate(dateLike) {
  try {
    const weekKey = `focusCategories:week:${ymd(startOfWeekMon(dateLike))}`;
    const snapRaw = localStorage.getItem(weekKey);
    if (snapRaw) {
      const snap = JSON.parse(snapRaw);
      if (Array.isArray(snap)) return snap;
    }
  } catch {}
  // Fallback to the current live set
  return loadFocusAreasSafe();
}

// ---- Mini month picker (no external deps) -------------------------------
function formatLongYMD(ymdStr){
  const d = parseYMD(ymdStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
}
function monthStart(date){ const d = new Date(date); d.setDate(1); d.setHours(0,0,0,0); return d; }
function addMonths(date, delta){ const d = new Date(date); d.setMonth(d.getMonth() + delta); return d; }
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function buildMonthGrid(viewDate){
  const first = monthStart(viewDate);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const days = [];
  for(let i=0;i<35;i++){ const d = new Date(start); d.setDate(start.getDate()+i); days.push(d); }
  return days;
}
function MiniMonthPicker({ valueYMD, onChange, onClose }){
  const initial = valueYMD ? parseYMD(valueYMD) : new Date();
  const [view, setView] = useState(monthStart(initial));
  const grid = buildMonthGrid(view);
  const today = new Date(); today.setHours(0,0,0,0);
  const selected = parseYMD(valueYMD || ymd(new Date()));
  return (
    <div className="absolute z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <button className="px-2 py-1 rounded hover:bg-gray-100" onClick={()=>setView(addMonths(view,-1))} aria-label="Previous month">‹</button>
        <div className="font-semibold text-[#374151]">{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <button className="px-2 py-1 rounded hover:bg-gray-100" onClick={()=>setView(addMonths(view,1))} aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-gray-500">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=> <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d, idx)=>{
          const inMonth = d.getMonth() === view.getMonth();
          const isSel = valueYMD && sameDay(d, selected);
          const isToday = sameDay(d, today);
          return (
            <button
              key={idx}
              onClick={()=>{ onChange && onChange(ymd(d)); onClose && onClose(); }}
              className={`h-9 rounded-md text-sm ${inMonth? 'text-[#374151]':'text-gray-400'} ${isSel? 'bg-[#6B7280] text-white' : 'hover:bg-gray-100'} ${isToday && !isSel ? 'ring-1 ring-[#6B7280]' : ''}`}
              title={d.toDateString()}
            >{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
}

// Calendar component that uses useSearchParams
function CalendarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClient = useClientOnly(); // Add client-side only rendering
  const insets = useSafeAreaInsets(); // Get safe area insets for iOS

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Month view state
  const [viewMonth, setViewMonth] = useState(null); // Start with null to prevent hydration mismatch
  useEffect(() => {
    // Set initial month only on client
    setViewMonth(monthStart(new Date()));
  }, []);

  // Side menu state
  const [showSideMenu, setShowSideMenu] = useState(false);

  // View mode state (Day, Week, Month)
  const [currentView, setCurrentView] = useState('Month');

  // Selected day (for modals/editing)
  const [selectedDate, setSelectedDate] = useState(null);
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  }, []);

  // Focus areas from Dashboard/localStorage (prefer weekly snapshot based on selectedDate)
  const [focusAreas, setFocusAreas] = useState([]);
  const [visibleFocusAreas, setVisibleFocusAreas] = useState(new Set());
  
  useEffect(() => {
    setFocusAreas(loadFocusAreasForDate(new Date())); // initial load (today)
  }, []);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key && (e.key.startsWith("focusCategories") || e.key === "focusCategories")) {
        if (selectedDate) {
          setFocusAreas(loadFocusAreasForDate(selectedDate));
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [selectedDate]);

  // Load visible focus areas from localStorage (for calendar views)
  useEffect(() => {
    const areas = loadFocusAreasForDate(new Date());
    const visible = new Set(areas.map(a => a.label));
    setVisibleFocusAreas(visible);
    
    try {
      const saved = localStorage.getItem('calendar:visibleFocusAreas');
      if (saved) {
        const savedSet = new Set(JSON.parse(saved));
        setVisibleFocusAreas(savedSet);
      }
    } catch {}
  }, [focusAreas]);

  // Toggle focus area visibility
  const toggleFocusAreaVisibility = (label) => {
    setVisibleFocusAreas(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      try {
        localStorage.setItem('calendar:visibleFocusAreas', JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  // Helper function to filter events by visible focus areas
  const filterEventsByVisibility = useCallback((eventList) => {
    return eventList.filter(ev => {
      // If event has no focus area, show it
      if (!ev.area) return true;
      // If focus area is visible, show it
      return visibleFocusAreas.has(ev.area);
    });
  }, [visibleFocusAreas]);
  
  // Modal state must be defined before the effects that use it
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [draft, setDraft] = useState(() => ({
    ...DEFAULT_DRAFT,
    ...nextHourDefaults(new Date()),
    dateYMD: ymd(new Date()),
  }));
  useEffect(() => {
    if (showModal || showEditModal) {
      if (selectedDate) {
        const list = loadFocusAreasForDate(selectedDate);
        setFocusAreas(list);
        // If the currently selected area no longer exists, clear it
        setDraft((prev) => {
          if (!prev?.area) return prev;
          const exists = (list || []).some(a => a.label === prev.area);
          return exists ? prev : { ...prev, area: "" };
        });
      }
    }
  }, [showModal, showEditModal, selectedDate]);

  const getAreaColor = (label) => {
    const hit = (focusAreas || []).find(a => a.label === label);
    return hit?.color || COLORS[2];
  };

  // Events persisted locally (versioned) + cross-tab/route sync (compat with older keys)
  const PRIMARY_EVENTS_KEY = "hourglassEvents:v1";
  const COMPAT_EVENT_KEYS = useMemo(() => ["hourglassEvents:v1", "calendarEvents", "calendar-items", "events"], []); // read from any, write to primary+legacy
  const [events, setEvents] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  // Google Calendar integration state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState(null);
  
  // Store Google event customizations (focus areas, etc.) in localStorage
  const GOOGLE_EVENT_CUSTOMIZATIONS_KEY = "googleEventCustomizations:v1";
  const [googleEventCustomizations, setGoogleEventCustomizations] = useState({});
  
  // Load Google event customizations on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(GOOGLE_EVENT_CUSTOMIZATIONS_KEY);
      if (saved) {
        setGoogleEventCustomizations(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load Google event customizations:', e);
    }
  }, []);
  
  // Save Google event customizations when they change
  useEffect(() => {
    try {
      localStorage.setItem(GOOGLE_EVENT_CUSTOMIZATIONS_KEY, JSON.stringify(googleEventCustomizations));
      // Trigger event update so other pages can refresh
      try {
        window.dispatchEvent(new Event('calendarEventsUpdated'));
      } catch {}
    } catch (e) {
      console.warn('Failed to save Google event customizations:', e);
    }
  }, [googleEventCustomizations]);

  // Load once on mount (avoid clobbering existing storage with empty array). Merge from any legacy key.
  useEffect(() => {
    try {
      console.log('Calendar: Loading events on mount...');
      const collected = [];
      const seen = new Set();
      for (const k of COMPAT_EVENT_KEYS) {
        const raw = localStorage.getItem(k);
        console.log(`Calendar: Checking localStorage key "${k}":`, raw ? 'has data' : 'empty');
        if (!raw) continue;
        try {
          const arr = JSON.parse(raw) || [];
          if (Array.isArray(arr)) {
            console.log(`Calendar: Found ${arr.length} events in ${k}:`, arr);
            for (const ev of arr) {
              const id = ev && (ev.id || `${ev.title || ""}-${ev.start || ""}`);
              if (id && !seen.has(id)) { seen.add(id); collected.push(ev); }
            }
          }
        } catch (e) {
          console.warn(`Calendar: Failed to parse ${k}:`, e);
        }
      }
      console.log('Calendar: Total collected events:', collected.length, collected);
      if (collected.length) setEvents(collected);
    } catch (e) {
      console.warn("Failed to read events from storage", e);
    } finally {
      setEventsLoaded(true);
    }
  }, [COMPAT_EVENT_KEYS]);

  // Persist on change (after initial load completes)
  useEffect(() => {
    if (!eventsLoaded) return;
    try {
      const json = JSON.stringify(events);
      localStorage.setItem(PRIMARY_EVENTS_KEY, json);
      // Mirror to legacy key for older pages/components
      localStorage.setItem("calendarEvents", json);
      // Don't dispatch calendarEventsUpdated from calendar page to prevent infinite loops
      // This event is only for cross-page communication (dashboard -> calendar)
    } catch (e) {
      console.warn("Failed to write events to storage", e);
    }
  }, [events, eventsLoaded]);

  // Keep in sync with other tabs/windows or pages using the storage event
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key) return;
      if (!COMPAT_EVENT_KEYS.includes(e.key)) return;
      try {
        console.log('Calendar: Storage event detected:', e.key, e.newValue);
        const incoming = e.newValue ? JSON.parse(e.newValue) : null;
        if (Array.isArray(incoming)) {
          console.log('Calendar: Updating events from storage event:', incoming);
          setEvents(incoming);
        }
      } catch (e) {
        console.warn('Calendar: Failed to parse storage event:', e);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [COMPAT_EVENT_KEYS]);

  // Keep in sync with custom events from other pages (like dashboard)
  useEffect(() => {
    const onCalendarEventsUpdated = () => {
      try {
        console.log('Calendar: Received calendarEventsUpdated event, refreshing events...');
        
        // Re-read events from localStorage to get the latest data
        const collected = [];
        const seen = new Set();
        for (const k of COMPAT_EVENT_KEYS) {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          try {
            console.log('Calendar: Reading from key:', k);
            const arr = JSON.parse(raw) || [];
            if (Array.isArray(arr)) {
              for (const ev of arr) {
                const id = ev && (ev.id || `${ev.title || ""}-${ev.start || ""}`);
                if (id && !seen.has(id)) { seen.add(id); collected.push(ev); }
              }
            }
          } catch {}
        }
        
        // Always update events (even if empty) to ensure sync
        console.log('Calendar: Updating events from localStorage:', {
          collectedCount: collected.length,
          events: collected
        });
        setEvents(collected);
      } catch (e) {
        console.warn("Failed to read events from storage on calendarEventsUpdated", e);
      }
    };
    
    window.addEventListener('calendarEventsUpdated', onCalendarEventsUpdated);
    return () => window.removeEventListener('calendarEventsUpdated', onCalendarEventsUpdated);
  }, [COMPAT_EVENT_KEYS]);

  useEffect(() => {
    setFocusAreas(loadFocusAreasForDate(selectedDate));
    // also clear an area that no longer exists in this week
    setDraft((prev) => {
      if (!prev?.area) return prev;
      const exists = (loadFocusAreasForDate(selectedDate) || []).some(a => a.label === prev.area);
      return exists ? prev : { ...prev, area: "" };
    });
  }, [selectedDate]);

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

  // Fetch Google Calendar events
  const fetchGoogleEvents = useCallback(async (startDate, endDate) => {
    if (!googleConnected) {
      setGoogleEvents([]);
      return;
    }

    setGoogleLoading(true);
    setGoogleError(null);

    try {
      // Calculate date range based on view
      const timeMin = new Date(startDate);
      timeMin.setHours(0, 0, 0, 0);
      
      const timeMax = new Date(endDate);
      timeMax.setHours(23, 59, 59, 999);

      console.log('Fetching Google Calendar events:', {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString()
      });

      const response = await fetch(
        `/api/calendar/google/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}`
      );

      console.log('Google Calendar API response status:', response.status);

      if (response.status === 401) {
        // Not authenticated, disconnect
        setGoogleConnected(false);
        setGoogleEvents([]);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Google Calendar API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || errorData.details || 'Failed to fetch Google Calendar events');
      }

      const data = await response.json();
      console.log('Google Calendar events received:', data.events?.length || 0, 'events');
      setGoogleEvents(data.events || []);
      
      // Also store in localStorage for other pages to access
      try {
        localStorage.setItem('googleEvents:v1', JSON.stringify(data.events || []));
      } catch (e) {
        console.warn('Failed to store Google events in localStorage:', e);
      }
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      setGoogleError(error.message);
      setGoogleEvents([]);
    } finally {
      setGoogleLoading(false);
    }
  }, [googleConnected]);

  // Check connection status on mount
  useEffect(() => {
    if (!isClient) return;
    checkGoogleConnection();
  }, [isClient, checkGoogleConnection]);

  // Fetch Google events when connected and date range changes
  useEffect(() => {
    if (!isClient || !googleConnected) return;

    // Calculate date range for current view
    let startDate, endDate;
    
    if (currentView === 'Day' && selectedDate) {
      startDate = new Date(selectedDate);
      endDate = new Date(selectedDate);
    } else if (currentView === '3 Day' && selectedDate) {
      startDate = new Date(selectedDate);
      endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 2);
    } else if (currentView === 'Week' && selectedDate) {
      const weekStart = startOfWeek(selectedDate);
      startDate = new Date(weekStart);
      endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
    } else if (currentView === 'Month') {
      // For month view, use viewMonth if available, otherwise use selectedDate
      const monthStartDate = viewMonth || (selectedDate ? monthStart(selectedDate) : monthStart(new Date()));
      startDate = new Date(monthStartDate);
      const monthEnd = new Date(monthStartDate);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0); // Last day of month
      endDate = monthEnd;
    } else {
      // Default to current month if nothing else is set
      const today = new Date();
      startDate = monthStart(today);
      const monthEnd = new Date(startDate);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      endDate = monthEnd;
    }

    console.log('Triggering Google Calendar fetch for view:', currentView, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      googleConnected,
      viewMonth: viewMonth?.toISOString(),
      selectedDate: selectedDate?.toISOString()
    });

    fetchGoogleEvents(startDate, endDate);
  }, [isClient, googleConnected, currentView, selectedDate, viewMonth, fetchGoogleEvents]);


  // Merge local and Google events for display, applying customizations
  const allEvents = useMemo(() => {
    // Filter out Google events that might conflict with local events
    const localEventIds = new Set(events.map(e => e.id));
    const googleEventsFiltered = googleEvents.map(ev => {
      // Apply customizations (focus area, color) if they exist
      const customization = googleEventCustomizations[ev.id];
      if (customization) {
        return {
          ...ev,
          area: customization.area || ev.area,
          color: customization.area ? getAreaColor(customization.area) : ev.color,
        };
      }
      return ev;
    }).filter(e => !localEventIds.has(e.id));
    return [...events, ...googleEventsFiltered];
  }, [events, googleEvents, googleEventCustomizations]);

  // Auto-open Add modal when arriving with ?new=1 (prefill date & focus)
  useEffect(() => {
    if (!searchParams) return;
    const isNew = searchParams.get('new');
    if (isNew !== '1' && isNew !== 'true') return;

    const d = searchParams.get('date'); // yyyy-mm-dd
    const f = searchParams.get('focus');

    if (d) {
      try { setSelectedDate(parseYMD(d)); } catch {}
    }

    setDraft(prev => ({
      ...DEFAULT_DRAFT,
      ...nextHourDefaults(new Date()),
      area: f ? decodeURIComponent(f) : prev.area,
      dateYMD: d ? d : ymd(selectedDate),
    }));

    setShowModal(true);

    // Clean the URL so refresh doesn't re-open the modal
    try { router.replace('/calendar', { scroll: false }); } catch {}
  }, [searchParams, router, selectedDate]);

  // Auto-open Edit modal when arriving with ?edit=id&date=yyyy-mm-dd&view=Day
  useEffect(() => {
    if (!searchParams) return;
    const editId = searchParams.get('edit');
    if (!editId) return;

    const dateParam = searchParams.get('date'); // yyyy-mm-dd
    const viewParam = searchParams.get('view'); // Day, Week, Month

    // Find the event
    const event = events.find(ev => ev.id === editId);
    if (!event) return;

    // Set the date from URL or event date
    if (dateParam) {
      try {
        const eventDate = parseYMD(dateParam);
        setSelectedDate(eventDate);
      } catch {}
    } else {
      const eventDate = new Date(event.start);
      eventDate.setHours(0, 0, 0, 0);
      setSelectedDate(eventDate);
    }

    // Switch to Day view if specified
    if (viewParam === 'Day') {
      setCurrentView('Day');
    }

    // Open edit modal
    setEditingId(event.id);
    setEditDurMs(Math.max(0, (event.end || 0) - (event.start || 0)) || 60 * 60 * 1000);
    setDraft({
      title: event.title || '',
      area: event.area || '',
      dateYMD: dateParam || ymd(new Date(event.start)),
      start: msToHHMM(event.start),
      end: msToHHMM(event.end),
      notes: event.notes || '',
    });
    setShowEditModal(true);

    // Clean the URL so refresh doesn't re-open the modal
    try { router.replace('/calendar', { scroll: false }); } catch {}
  }, [searchParams, router, events]);

  const headerLabel = useMemo(() => {
    if (!selectedDate) return "Loading...";
    return selectedDate.toLocaleDateString("en-US", {
      weekday: "short", month: "long", day: "numeric"
    });
  }, [selectedDate]);

  // --- Refs for horizontal day strip scroll ---
  const stripRef = useRef(null);
  const stripBtnRefs = useRef([]);

  // Refs to help scroll the day grid to the current time
  const gridRootRef = useRef(null);
  const dayColRef = useRef(null);
  
  // Ref for focus area rings horizontal scrolling
  const focusRingsRef = useRef(null);

  const stripDays = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 14);
    return Array.from({ length: 29 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [today]);

  // Scroll horizontal day strip so previous day is at left edge, with extra left space
  useEffect(() => {
    if (!stripRef.current || !stripBtnRefs.current?.length || !selectedDate) return;

    // Find index of the selected day within stripDays
    const idx = stripDays.findIndex(
      (d) => d.toDateString() === selectedDate.toDateString()
    );
    if (idx === -1) return;

    // We want the previous day (if any) to be at the left edge
    const targetIdx = Math.max(0, idx - 1);
    const targetEl = stripBtnRefs.current[targetIdx];
    if (!targetEl) return;

    // Nudge slightly to the RIGHT so there's a bit less left padding (back to -8).
    const left = targetEl.offsetLeft - 24;
    stripRef.current.scrollTo({ left, top: 0, behavior: "smooth" });
  }, [selectedDate, stripDays]);

  // Center focus rings when focus areas change
  useEffect(() => {
    if (focusRingsRef.current && focusAreas.length > 0) {
      // Calculate the center position to center the rings
      const containerWidth = focusRingsRef.current.clientWidth;
      const contentWidth = focusRingsRef.current.scrollWidth;
      const scrollLeft = Math.max(0, (contentWidth - containerWidth) / 2);
      
      // Center the rings
      focusRingsRef.current.scrollTo({ left: scrollLeft, top: 0, behavior: "smooth" });
      
      // Also try centering after a short delay to ensure DOM is fully rendered
      setTimeout(() => {
        if (focusRingsRef.current) {
          const updatedContainerWidth = focusRingsRef.current.clientWidth;
          const updatedContentWidth = focusRingsRef.current.scrollWidth;
          const updatedScrollLeft = Math.max(0, (updatedContentWidth - updatedContainerWidth) / 2);
          focusRingsRef.current.scrollTo({ left: updatedScrollLeft, top: 0, behavior: "auto" });
        }
      }, 100);
    }
  }, [focusAreas]);

  // Modal state for new event (showModal/showEditModal/draft declared above)
  const [editingId, setEditingId] = useState(null);
  const [editDurMs, setEditDurMs] = useState(60 * 60 * 1000);
  
  // Repeating event state
  const [isRepeating, setIsRepeating] = useState(false);
  const [repeatType, setRepeatType] = useState('none'); // 'none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'
  const [customRepeat, setCustomRepeat] = useState({
    frequency: 'weekly', // 'daily', 'weekly', 'monthly', 'yearly'
    interval: 1, // every X days/weeks/months/years
    daysOfWeek: [], // for weekly: [0,1,2,3,4,5,6] (Sunday=0)
    endDate: null // when to stop repeating (max 1 year)
  });
  const [showCustomRepeat, setShowCustomRepeat] = useState(false);

  // Hoisted state for Add Modal date picker
  const [showAddDatePicker, setShowAddDatePicker] = useState(false);
  const addDatePickerRef = useRef();

  // Hoisted state for Edit Modal date picker
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const editDatePickerRef = useRef();

  const openForSlot = (hour) => {
    if (!selectedDate) return;
    setDraft({
      ...DEFAULT_DRAFT,
      dateYMD: ymd(selectedDate),
      start: `${String(hour).padStart(2, "0")}:00`,
      end: hour === 23 ? "23:59" : `${String(hour + 1).padStart(2, "0")}:00`,
    });
    setShowModal(true);
  };

  const generateRepeatingEvents = ({ title, area, start, end, color, notes, repeatType, customRepeat, baseDate }) => {
    const events = [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    const duration = endDate.getTime() - startDate.getTime();
    
    // Calculate end date for repeating (max 1 year from start)
    const maxEndDate = new Date(startDate);
    maxEndDate.setFullYear(maxEndDate.getFullYear() + 1);
    
    let currentDate = new Date(startDate);
    let eventCount = 0;
    const maxEvents = 365; // Safety limit
    
    while (currentDate <= maxEndDate && eventCount < maxEvents) {
      const eventStart = new Date(currentDate);
      const eventEnd = new Date(eventStart.getTime() + duration);
      
      events.push({
        id: makeId(),
        title,
        area,
        start: eventStart.getTime(),
        end: eventEnd.getTime(),
        color,
        notes,
        isRepeating: true,
        repeatType,
        originalDate: startDate.getTime()
      });
      
      // Calculate next occurrence based on repeat type
      if (repeatType === 'daily') {
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (repeatType === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (repeatType === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else if (repeatType === 'yearly') {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
      } else if (repeatType === 'custom') {
        if (customRepeat.frequency === 'daily') {
          currentDate.setDate(currentDate.getDate() + customRepeat.interval);
        } else if (customRepeat.frequency === 'weekly') {
          if (customRepeat.daysOfWeek.length > 0) {
            // Find next occurrence on specified days
            const currentDay = currentDate.getDay();
            let nextDay = null;
            
            // Find next day in the week
            for (let i = 1; i <= 7; i++) {
              const checkDay = (currentDay + i) % 7;
              if (customRepeat.daysOfWeek.includes(checkDay)) {
                nextDay = checkDay;
                break;
              }
            }
            
            if (nextDay !== null) {
              const daysToAdd = (nextDay - currentDay + 7) % 7;
              currentDate.setDate(currentDate.getDate() + daysToAdd);
            } else {
              // No more days this week, go to next week
              currentDate.setDate(currentDate.getDate() + (7 - currentDay) + customRepeat.daysOfWeek[0] + (customRepeat.interval - 1) * 7);
            }
          } else {
            currentDate.setDate(currentDate.getDate() + customRepeat.interval * 7);
          }
        } else if (customRepeat.frequency === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + customRepeat.interval);
        } else if (customRepeat.frequency === 'yearly') {
          currentDate.setFullYear(currentDate.getFullYear() + customRepeat.interval);
        }
      }
      
      eventCount++;
    }
    
    return events;
  };

  const addEvent = () => {
    if (!draft.title && !draft.area || !selectedDate) return;
    const base = parseYMD(draft.dateYMD || ymd(selectedDate));
    const mk = (hms) => {
      const [h, m] = hms.split(":").map(Number);
      const t = new Date(base);
      t.setHours(h, m, 0, 0);
      return t.getTime();
    };
    const startMs = mk(draft.start);
    let endMs = mk(draft.end);
    if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000; // crosses midnight
    const areaColor = getAreaColor(draft.area);
    
    if (isRepeating && repeatType !== 'none') {
      // Create repeating events
      const newEvents = generateRepeatingEvents({
        title: draft.title || draft.area,
        area: draft.area || "",
        start: startMs,
        end: endMs,
        color: areaColor,
        notes: draft.notes || "",
        repeatType,
        customRepeat,
        baseDate: base
      });
      const next = [...events, ...newEvents];
      setEvents(next);
    } else {
      // Single event
      const newEvent = {
        id: makeId(),
        title: draft.title || draft.area,
        area: draft.area || "",
        start: startMs,
        end: endMs,
        color: areaColor,
        notes: draft.notes || "",
      };
      const next = [...events, newEvent];
      setEvents(next);
    }
    
    setSelectedDate(new Date(base));
    setShowModal(false);
    setDraft(DEFAULT_DRAFT);
    setIsRepeating(false);
    setRepeatType('none');
    setCustomRepeat({
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [],
      endDate: null
    });
  };

  const openEdit = (ev) => {
    setEditingId(ev.id);
    const isGoogleEvent = ev.source === 'google';
    
    // For Google events, get customization if it exists
    const customization = isGoogleEvent ? googleEventCustomizations[ev.id] : null;
    
    setEditDurMs(Math.max(0, (ev.end || 0) - (ev.start || 0)) || 60 * 60 * 1000);
    setDraft({
      title: ev.title || '',
      area: customization?.area || ev.area || '',
      dateYMD: ymd(new Date(ev.start)),
      start: msToHHMM(ev.start),
      end: msToHHMM(ev.end),
      notes: ev.notes || '',
    });
    setShowEditModal(true);
  };

  const updateEvent = async () => {
    if (!editingId) return;
    
    // Check if this is a Google event
    const currentEvent = allEvents.find(e => e.id === editingId);
    const isGoogleEvent = currentEvent?.source === 'google';
    
    if (isGoogleEvent) {
      // For Google events, update both the Google Calendar event and local customizations
      try {
        const base = parseYMD(draft.dateYMD || ymd(selectedDate));
        const mk = (hms) => {
          const [h, m] = hms.split(':').map(Number);
          const t = new Date(base);
          t.setHours(h, m, 0, 0);
          return t.getTime();
        };
        const startMs = mk(draft.start);
        let endMs = mk(draft.end);
        if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000; // crosses midnight

        // Update the Google Calendar event
        // Convert milliseconds to ISO strings with timezone
        const startDate = new Date(startMs);
        const endDate = new Date(endMs);
        
        const response = await fetch('/api/calendar/google/events/update', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: editingId,
            title: draft.title || draft.area || currentEvent.title,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            description: draft.notes || '',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.details || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
          
          // Check for permission errors
          if (response.status === 403 || errorData.code === 403) {
            throw new Error('Permission denied. Please disconnect and reconnect Google Calendar to grant write permissions.');
          }
          
          throw new Error(errorMessage);
        }

        // Save focus area customization locally
        if (draft.area) {
          setGoogleEventCustomizations(prev => ({
            ...prev,
            [editingId]: {
              area: draft.area || '',
            }
          }));
        }

        // Refresh Google events to get the updated data
        // Trigger a refetch by updating the date range
        if (viewMonth) {
          const startDate = new Date(viewMonth);
          const monthEnd = new Date(viewMonth);
          monthEnd.setMonth(monthEnd.getMonth() + 1);
          monthEnd.setDate(0);
          fetchGoogleEvents(startDate, monthEnd);
        }

        setShowEditModal(false);
        setEditingId(null);
      } catch (error) {
        console.error('Error updating Google Calendar event:', error);
        alert(`Failed to update Google Calendar event: ${error.message}`);
      }
      return;
    }
    
    // For local events, update normally
    const base = parseYMD(draft.dateYMD || ymd(selectedDate));
    const mk = (hms) => {
      const [h, m] = hms.split(':').map(Number);
      const t = new Date(base);
      t.setHours(h, m, 0, 0);
      return t.getTime();
    };
    const startMs = mk(draft.start);
    let endMs = mk(draft.end);
    if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000; // crosses midnight
    const next = events.map((ev) =>
      ev.id === editingId
        ? {
            ...ev,
            title: draft.title || draft.area,
            area: draft.area || '',
            start: startMs,
            end: endMs,
            color: getAreaColor(draft.area || ev.area),
            notes: draft.notes || '',
          }
        : ev
    );
    setEvents(next);
    setShowEditModal(false);
    setEditingId(null);
  };

  const deleteEvent = (deleteAllFuture = false) => {
    if (!editingId) return;
    
    const currentEvent = events.find(e => e.id === editingId);
    if (!currentEvent) return;
    
    // Don't allow deleting Google Calendar events
    if (currentEvent.source === 'google') {
      return;
    }
    
    let next;
    if (deleteAllFuture && currentEvent.isRepeating) {
      // Delete all future occurrences of this repeating event
      const currentDate = new Date(currentEvent.start);
      next = events.filter((ev) => {
        if (ev.isRepeating && ev.originalDate === currentEvent.originalDate && ev.title === currentEvent.title) {
          const evDate = new Date(ev.start);
          return evDate < currentDate; // Keep only past events
        }
        return ev.id !== editingId; // Keep all non-repeating events
      });
    } else {
      // Delete only this specific event
      next = events.filter((ev) => ev.id !== editingId);
    }
    
    setEvents(next);
    setShowEditModal(false);
    setEditingId(null);
  };

  const duplicateEvent = () => {
    if (!editingId) return;
    
    const currentEvent = events.find(e => e.id === editingId);
    if (!currentEvent) return;
    
    // Get tomorrow's date
    const tomorrow = new Date(currentEvent.start);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Pre-fill the draft with duplicated data
    setDraft({
      title: currentEvent.title || '',
      area: currentEvent.area || '',
      dateYMD: ymd(tomorrow),
      start: msToHHMM(currentEvent.start),
      end: msToHHMM(currentEvent.end),
      notes: '', // Don't copy notes as requested
    });
    
    // Close edit modal and open new event modal
    setShowEditModal(false);
    setEditingId(null);
    setShowModal(true);
  };

  // Layout helpers

  // ---- Now indicator (red line for current time) ---------------------------
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  // Track current time (updates every 30s)
  const [nowMs, setNowMs] = useState(0); // Start with 0 to prevent hydration mismatch
  useEffect(() => {
    // Set initial time only on client
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const pxPerHour = 64; // vertical spacing

  // --- Drag & drop support (move blocks vertically without resizing) ---
  const SNAP_MINUTES = 5; // snap to 5-minute grid
  const snapMs = (ms) => Math.round(ms / (SNAP_MINUTES*60000)) * (SNAP_MINUTES*60000);

  // Drag state
  const [draggingId, setDraggingId] = useState(null);
  const [dragGhostTop, setDragGhostTop] = useState(null); // live pixel top while dragging
  const [dragDelayActive, setDragDelayActive] = useState(false); // true when waiting for hold delay
  const [dragDelayEventId, setDragDelayEventId] = useState(null); // event ID waiting for delay
  const [resizingId, setResizingId] = useState(null); // event ID being resized
  const [resizeHandle, setResizeHandle] = useState(null); // 'top' or 'bottom' handle being dragged
  const [resizeGhost, setResizeGhost] = useState(null); // force re-render during resize
  const dragRef = useRef({
    startY: 0,
    origStart: 0,
    origEnd: 0,
    duration: 0,
    lastStartMs: null,
    moved: false,
  });
  const resizeRef = useRef({
    startY: 0,
    origStart: 0,
    origEnd: 0,
    lastStartMs: null,
    lastEndMs: null,
    moved: false,
  });

  // Helper function to start resize from a handle
  const startResize = (ev, handle, clientY) => {
    if (dragDelayTimerRef.current) {
      clearTimeout(dragDelayTimerRef.current);
      dragDelayTimerRef.current = null;
    }
    setDragDelayActive(false);
    setDragDelayEventId(null);
    setResizingId(ev.id);
    setResizeHandle(handle);
    resizeRef.current = {
      startY: clientY,
      origStart: ev.start,
      origEnd: ev.end,
      lastStartMs: ev.start,
      lastEndMs: ev.end,
      moved: false,
    };
  };
  const dragDelayTimerRef = useRef(null); // timer for drag delay
  const startTouchRef = useRef(null);
  const unmountedRef = useRef(false);

  const dayStartMs = useMemo(() => {
    if (!selectedDate) return 0;
    const t = new Date(selectedDate);
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }, [selectedDate]);

  const dayEndMs = useMemo(() => {
    if (!dayStartMs) return 0;
    return dayStartMs + 24 * 60 * 60 * 1000;
  }, [dayStartMs]);

  // Define clampToDay after dayStartMs and dayEndMs are defined
  const clampToDay = useCallback((startMs, endMs) => {
    // keep duration same, clamp within the day
    const dur = endMs - startMs;
    let s = Math.max(dayStartMs, Math.min(startMs, dayEndMs - dur));
    let e = s + dur;
    return [s, e];
  }, [dayStartMs, dayEndMs]);

  // Pixel offset of the "now" line, only if selectedDate is today
  const nowTopPx = useMemo(() => {
    if (!selectedDate || !nowMs) return null;
    const now = new Date(nowMs);
    if (!isSameDay(now, selectedDate)) return null;
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 60) * pxPerHour; // hours -> px
  }, [nowMs, selectedDate, pxPerHour]);

  // When viewing today, scroll the window so the now line is comfortably in view (only once ever)
  useEffect(() => {
    if (nowTopPx == null) return;
    if (!dayColRef.current) return;
    
    // Check if we've already done the initial scroll (persisted in localStorage)
    const hasScrolledKey = 'calendar:hasInitiallyScrolled';
    if (typeof window !== 'undefined' && localStorage.getItem(hasScrolledKey) === 'true') {
      return; // Already scrolled once, don't do it again
    }
    
    // Delay scroll to current time (wait 2 seconds before scrolling)
    const scrollTimer = setTimeout(() => {
      if (!dayColRef.current) return;
    
    // Where the day column starts relative to the page
    const rect = dayColRef.current.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;
    // Aim to put the red line about 2 hours (240px) below the top of the viewport
    const target = Math.max(0, pageTop + nowTopPx - 240);
    window.scrollTo({ top: target, behavior: 'smooth' });
    
      // Mark that we've done the initial scroll (persist in localStorage)
      if (typeof window !== 'undefined') {
        localStorage.setItem(hasScrolledKey, 'true');
      }
    }, 2000); // 2 second delay
    
    return () => clearTimeout(scrollTimer);
  }, [nowTopPx]);

  useEffect(() => {
    if (!draggingId) return;

    // Disable page scrolling/selection while dragging
    const prevTouchAction = document.body.style.touchAction;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.touchAction = 'none';
    document.body.style.userSelect = 'none';

    const onMove = (e) => {
      if (e.cancelable) e.preventDefault();
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dy = clientY - dragRef.current.startY;
      const deltaMs = (dy / pxPerHour) * 3600000; // px → hours → ms

      // compute new start based on original start + delta
      let newStart = dragRef.current.origStart + deltaMs;
      let newEnd = newStart + dragRef.current.duration;
      // snap and clamp
      newStart = snapMs(newStart);
      newEnd = newStart + dragRef.current.duration;
      ;[newStart, newEnd] = clampToDay(newStart, newEnd);

      // remember for commit and update ghost pixel top only (no re-render of all events)
      dragRef.current.lastStartMs = newStart;
      dragRef.current.moved = true;

      const vs = new Date(Math.max(newStart, dayStartMs));
      const topPx = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
      setDragGhostTop(Math.max(0, topPx));
    };

    const onUp = () => {
      if (unmountedRef.current) return;
      // Commit only once when the drag finishes
      const moved = dragRef.current.moved;
      const finalStart = dragRef.current.lastStartMs;
      const dur = dragRef.current.duration;
      setDraggingId(null);
      setDragGhostTop(null);
      dragRef.current = { startY: 0, origStart: 0, origEnd: 0, duration: 0, lastStartMs: null, moved: false };
      if (!moved || finalStart == null) return;
      const finalEnd = finalStart + dur;
      setEvents((prev) => prev.map((x) => (x.id === draggingId ? { ...x, start: finalStart, end: finalEnd } : x)));
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: true });

    return () => {
      document.body.style.touchAction = prevTouchAction;
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [draggingId, pxPerHour, dayStartMs, dayEndMs, clampToDay]);

  // Global resize effect
  useEffect(() => {
    if (!resizingId || !resizeHandle) return;

    // Disable page scrolling/selection while resizing
    const prevTouchAction = document.body.style.touchAction;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.touchAction = 'none';
    document.body.style.userSelect = 'none';

    const onMove = (e) => {
      if (e.cancelable) e.preventDefault();
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dy = clientY - resizeRef.current.startY;
      const deltaMs = (dy / pxPerHour) * 3600000; // px → hours → ms

      let newStart = resizeRef.current.origStart;
      let newEnd = resizeRef.current.origEnd;

      if (resizeHandle === 'top-left' || resizeHandle === 'top-right') {
        // Resizing from top - adjust start time
        newStart = resizeRef.current.origStart + deltaMs;
        newStart = snapMs(newStart);
        // Ensure start doesn't go past end
        newStart = Math.min(newStart, newEnd - 15 * 60 * 1000); // minimum 15 minutes
      } else if (resizeHandle === 'bottom-left' || resizeHandle === 'bottom-right') {
        // Resizing from bottom - adjust end time
        newEnd = resizeRef.current.origEnd + deltaMs;
        newEnd = snapMs(newEnd);
        // Ensure end doesn't go before start
        newEnd = Math.max(newEnd, newStart + 15 * 60 * 1000); // minimum 15 minutes
      }

      // Clamp to day boundaries
      [newStart, newEnd] = clampToDay(newStart, newEnd);

      // Remember for commit
      resizeRef.current.lastStartMs = newStart;
      resizeRef.current.lastEndMs = newEnd;
      resizeRef.current.moved = true;
      
      // Force re-render to show live updates
      setResizeGhost({ start: newStart, end: newEnd });
    };

    const onUp = () => {
      if (unmountedRef.current) return;
      // Commit resize
      const moved = resizeRef.current.moved;
      const finalStart = resizeRef.current.lastStartMs;
      const finalEnd = resizeRef.current.lastEndMs;
      setResizingId(null);
      setResizeHandle(null);
      setResizeGhost(null);
      resizeRef.current = { startY: 0, origStart: 0, origEnd: 0, lastStartMs: null, lastEndMs: null, moved: false };
      
      if (moved && finalStart != null && finalEnd != null) {
        setEvents((prev) => prev.map((x) => (x.id === resizingId ? { ...x, start: finalStart, end: finalEnd } : x)));
      }
    };

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp, { passive: true });

    return () => {
      document.body.style.touchAction = prevTouchAction;
      document.body.style.userSelect = prevUserSelect;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [resizingId, resizeHandle, pxPerHour, dayStartMs, dayEndMs, clampToDay, snapMs]);

  // Cleanup drag delay timer on unmount
  useEffect(() => {
    return () => {
      if (dragDelayTimerRef.current) {
        clearTimeout(dragDelayTimerRef.current);
      }
    };
  }, []);

  // Add new effect (after dragDelay cleanup effect):
  useEffect(() => {
    const hardReset = () => {
      if (dragDelayTimerRef.current) {
        clearTimeout(dragDelayTimerRef.current);
        dragDelayTimerRef.current = null;
      }
      setDraggingId(null);
      setDragGhostTop(null);
      document.body.style.touchAction = '';
      document.body.style.userSelect = '';
      setDragDelayActive(false);
      setDragDelayEventId(null);
    };

    window.addEventListener('pagehide', hardReset);
    window.addEventListener('blur', hardReset);
    document.addEventListener('visibilitychange', hardReset);

    return () => {
      unmountedRef.current = true;
      window.removeEventListener('pagehide', hardReset);
      window.removeEventListener('blur', hardReset);
      document.removeEventListener('visibilitychange', hardReset);
      hardReset();
    };
  }, []);

  // Clear drag delay when dragging actually starts
  useEffect(() => {
    if (draggingId) {
      if (dragDelayTimerRef.current) {
        clearTimeout(dragDelayTimerRef.current);
      }
      setDragDelayActive(false);
      setDragDelayEventId(null);
    }
  }, [draggingId]);

  // Add non-passive touch event listeners for calendar events
  useEffect(() => {
    if (!isClient) return;

    const eventElements = document.querySelectorAll('.calendar-event');
    const MOVE_TOL = 10;
    
    const onTouchStart = (e) => {
      const eventId = e.currentTarget.getAttribute('data-event-id');
      if (!eventId) return;
      const ev = events.find(x => x.id === eventId);
      if (!ev) return;
      if (dragDelayTimerRef.current) clearTimeout(dragDelayTimerRef.current);

      const t = e.touches[0];
      startTouchRef.current = { x: t.clientX, y: t.clientY };

      setDragDelayActive(true);
      setDragDelayEventId(ev.id);

      dragDelayTimerRef.current = setTimeout(() => {
        if (unmountedRef.current) return;
        const dur = ev.end - ev.start;
        setDraggingId(ev.id);
        setDragDelayActive(false);
        setDragDelayEventId(null);
        dragRef.current = {
          startY: t.clientY,
          origStart: ev.start,
          origEnd: ev.end,
          duration: dur,
          lastStartMs: null,
          moved: false,
        };
        const vs = new Date(Math.max(ev.start, dayStartMs));
        const topPxSeed = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
        setDragGhostTop(Math.max(0, topPxSeed));
      }, 500);
    };

    const onTouchMove = (e) => {
      if (!dragDelayActive || !dragDelayEventId) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      const sx = startTouchRef.current?.x ?? t.clientX;
      const sy = startTouchRef.current?.y ?? t.clientY;
      const moved = Math.hypot(t.clientX - sx, t.clientY - sy) > MOVE_TOL;
      if (moved) {
        if (dragDelayTimerRef.current) {
          clearTimeout(dragDelayTimerRef.current);
          dragDelayTimerRef.current = null;
        }
        setDragDelayActive(false);
        setDragDelayEventId(null);
      }
    };

    const onTouchEnd = () => {
      if (dragDelayActive && dragDelayEventId) {
        if (dragDelayTimerRef.current) clearTimeout(dragDelayTimerRef.current);
        setDragDelayActive(false);
        setDragDelayEventId(null);
      }
    };

    const onTouchCancel = onTouchEnd;

    eventElements.forEach(el => {
      el.addEventListener('touchstart', onTouchStart, { passive: false });
      el.addEventListener('touchmove', onTouchMove, { passive: true });
      el.addEventListener('touchend', onTouchEnd, { passive: false });
      el.addEventListener('touchcancel', onTouchCancel, { passive: false });
    });

    return () => {
      eventElements.forEach(el => {
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        el.removeEventListener('touchcancel', onTouchCancel);
      });
    };
  }, [isClient, events, dayStartMs, pxPerHour, dragDelayActive, dragDelayEventId]);

  const eventsForSelected = useMemo(() => {
    // include events that overlap the selected day window [dayStartMs, dayEndMs)
    if (!dayStartMs || !dayEndMs) return [];
    const dayEvents = allEvents.filter((ev) => ev.end > dayStartMs && ev.start < dayEndMs);
    // Filter by visible focus areas
    return filterEventsByVisibility(dayEvents);
  }, [allEvents, dayStartMs, dayEndMs, visibleFocusAreas, filterEventsByVisibility]);

  // Calculate overlapping event layout (columns, widths, positions)
  const eventLayouts = useMemo(() => {
    if (!eventsForSelected.length) return new Map();
    
    const layouts = new Map();
    const processed = new Set();
    
    // Helper to check if two events overlap
    const eventsOverlap = (ev1, ev2) => {
      return ev1.start < ev2.end && ev1.end > ev2.start;
    };
    
    // For each event, find all events that overlap with it
    eventsForSelected.forEach((ev) => {
      if (processed.has(ev.id)) return;
      
      // Find all events that overlap with this one (including itself)
      const overlappingGroup = eventsForSelected.filter((otherEv) => {
        if (processed.has(otherEv.id)) return false;
        return eventsOverlap(ev, otherEv);
      });
      
      if (overlappingGroup.length === 1) {
        // No overlaps, full width
        layouts.set(ev.id, { column: 0, totalColumns: 1, width: 1, left: 0 });
        processed.add(ev.id);
      } else {
        // Multiple overlapping events - assign columns
        // Sort by start time, then by end time
        overlappingGroup.sort((a, b) => {
          if (a.start !== b.start) return a.start - b.start;
          return a.end - b.end;
        });
        
        // Assign columns using a greedy algorithm
        const columns = new Array(overlappingGroup.length).fill(0);
        overlappingGroup.forEach((currentEv, idx) => {
          // Find the first available column
          const usedColumns = new Set();
          overlappingGroup.forEach((otherEv, otherIdx) => {
            if (otherIdx < idx && eventsOverlap(currentEv, otherEv)) {
              usedColumns.add(columns[otherIdx]);
            }
          });
          
          // Find first unused column
          let column = 0;
          while (usedColumns.has(column)) {
            column++;
          }
          columns[idx] = column;
        });
        
        const maxColumn = Math.max(...columns);
        const totalColumns = maxColumn + 1;
        
        // Assign layout to each event in the group
        // Add small gap between columns (2% of width per gap)
        const gapPercent = 0.02;
        const totalGapWidth = gapPercent * (totalColumns - 1);
        const availableWidth = 1 - totalGapWidth;
        const columnWidth = availableWidth / totalColumns;
        
        overlappingGroup.forEach((groupEv, idx) => {
          const column = columns[idx];
          layouts.set(groupEv.id, {
            column,
            totalColumns,
            width: columnWidth,
            left: (column * columnWidth) + (column * gapPercent)
          });
          processed.add(groupEv.id);
        });
      }
    });
    
    return layouts;
  }, [eventsForSelected]);


  // --- Get selected day abbrev for focus area rings ---
  const selectedDayAbbrev = selectedDate ? DAYS[selectedDate.getDay()] : null;

  // Show loading state if month not loaded yet
  if (!viewMonth) {
    return (
      <div className="min-h-screen bg-white text-[#374151] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Loading Calendar...</div>
          <div className="text-sm text-gray-500">Please wait while we prepare your calendar view.</div>
        </div>
      </div>
    );
  }

  // Build month grid
  const monthGrid = buildMonthGrid(viewMonth);
  
  // Get events for a specific date
  const getEventsForDate = (date) => {
    const dateStr = ymd(date);
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);
    const dayEvents = allEvents.filter(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return evStart <= dateEnd && evEnd >= dateStart;
    });
    // Filter by visible focus areas
    return filterEventsByVisibility(dayEvents);
  };

  // Helper function to calculate event layouts for a given day's events
  const calculateEventLayouts = (dayEvents, dayStartMs, dayEndMs) => {
    if (!dayEvents.length) return new Map();
    
    const layouts = new Map();
    const processed = new Set();
    
    const eventsOverlap = (ev1, ev2) => {
      return ev1.start < ev2.end && ev1.end > ev2.start;
    };
    
    dayEvents.forEach((ev) => {
      if (processed.has(ev.id)) return;
      
      const overlappingGroup = dayEvents.filter((otherEv) => {
        if (processed.has(otherEv.id)) return false;
        return eventsOverlap(ev, otherEv);
      });
      
      if (overlappingGroup.length === 1) {
        layouts.set(ev.id, { column: 0, totalColumns: 1, width: 1, left: 0 });
        processed.add(ev.id);
      } else {
        overlappingGroup.sort((a, b) => {
          if (a.start !== b.start) return a.start - b.start;
          return a.end - b.end;
        });
        
        const columns = new Array(overlappingGroup.length).fill(0);
        overlappingGroup.forEach((currentEv, idx) => {
          const usedColumns = new Set();
          overlappingGroup.forEach((otherEv, otherIdx) => {
            if (otherIdx < idx && eventsOverlap(currentEv, otherEv)) {
              usedColumns.add(columns[otherIdx]);
            }
          });
          
          let column = 0;
          while (usedColumns.has(column)) {
            column++;
          }
          columns[idx] = column;
        });
        
        const maxColumn = Math.max(...columns);
        const totalColumns = maxColumn + 1;
        const gapPercent = 0.02;
        const totalGapWidth = gapPercent * (totalColumns - 1);
        const availableWidth = 1 - totalGapWidth;
        const columnWidth = availableWidth / totalColumns;
        
        overlappingGroup.forEach((groupEv, idx) => {
          const column = columns[idx];
          layouts.set(groupEv.id, {
            column,
            totalColumns,
            width: columnWidth,
            left: (column * columnWidth) + (column * gapPercent)
          });
          processed.add(groupEv.id);
        });
      }
    });
    
    return layouts;
  };

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
          {currentView === 'Day' ? (
            <>
              <button 
                className="text-lg px-2 text-gray-900 hover:text-gray-700" 
            aria-label="Previous Day" 
            onClick={() => selectedDate && setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))}
            disabled={!selectedDate}
          >
            ‹
          </button>
              <div className="font-semibold text-base text-gray-900 whitespace-nowrap">
                {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
              </div>
          <button 
                className="text-lg px-2 text-gray-900 hover:text-gray-700" 
            aria-label="Next Day" 
            onClick={() => selectedDate && setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))}
            disabled={!selectedDate}
          >
            ›
          </button>
            </>
          ) : (
            <>
              <button 
                className="text-lg px-2 text-gray-900 hover:text-gray-700" 
                aria-label="Previous Month" 
                onClick={() => viewMonth && setViewMonth(addMonths(viewMonth, -1))}
                disabled={!viewMonth}
              >
                ‹
              </button>
              <div className="font-semibold text-lg text-gray-900">
                {viewMonth ? viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
              </div>
              <button 
                className="text-lg px-2 text-gray-900 hover:text-gray-700" 
                aria-label="Next Month" 
                onClick={() => viewMonth && setViewMonth(addMonths(viewMonth, 1))}
                disabled={!viewMonth}
              >
                ›
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Today button */}
          <button
            onClick={() => {
              const todayDate = new Date();
              todayDate.setHours(0, 0, 0, 0);
              setSelectedDate(todayDate);
              if (currentView === 'Month') {
                setViewMonth(monthStart(todayDate));
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
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${currentView === 'Day' ? 'bg-white/30 text-gray-900 font-medium' : 'text-gray-900 hover:bg-white/20'}`}
                    onClick={() => { setCurrentView('Day'); setShowSideMenu(false); }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Day</span>
                    </div>
                  </button>
                  <button
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${currentView === '3 Day' ? 'bg-white/30 text-gray-900 font-medium' : 'text-gray-900 hover:bg-white/20'}`}
                    onClick={() => { setCurrentView('3 Day'); setShowSideMenu(false); }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>3 Day</span>
                    </div>
                  </button>
                  <button
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${currentView === 'Week' ? 'bg-white/30 text-gray-900 font-medium' : 'text-gray-900 hover:bg-white/20'}`}
                    onClick={() => { setCurrentView('Week'); setShowSideMenu(false); }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Week</span>
                    </div>
                  </button>
                  <button
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${currentView === 'Month' ? 'bg-white/30 text-gray-900 font-medium' : 'text-gray-900 hover:bg-white/20'}`}
                    onClick={() => { setCurrentView('Month'); setShowSideMenu(false); }}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Month</span>
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
                              toggleFocusAreaVisibility(area.label);
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

      {/* Calendar view area */}
      {currentView === 'Day' ? (
        /* Day view */
        <div className="flex-1 overflow-y-auto px-4 scroll-smooth" style={{ paddingTop: `${Math.max(insets.top, 44) + 80}px` }}>
          {/* Day info header */}
          {selectedDate && eventsForSelected.length === 0 && (
            <div className="mb-4">
              <div className="text-gray-600 text-sm">Nothing planned</div>
            </div>
          )}
          
          <div ref={gridRootRef} className="relative">
            <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-4">
        <div className="grid grid-cols-[56px_minmax(0,1fr)]">
          {/* Hours gutter */}
          <div className="flex flex-col items-end pr-2">
            {isClient && HOURS.map((h) => (
              <div
                key={h}
                      className="text-xs text-gray-700 flex items-start"
                style={{ height: `${pxPerHour}px` }}
              >
                <div className="-translate-y-1">{formatHour(h)}</div>
              </div>
            ))}
          </div>

                {/* Day column */}
          <div
            ref={dayColRef}
                  className="relative border-l border-gray-300/60 overflow-visible"
            style={{ touchAction: draggingId ? 'none' : undefined, userSelect: draggingId ? 'none' : undefined }}
          >
            {HOURS.map((h) => (
              <div
                key={h}
                      className="h-16 border-b border-gray-200/50 hover:bg-white/10 cursor-pointer transition-colors"
                onClick={() => openForSlot(h)}
              />
            ))}

                  {/* Current time indicator */}
            {isClient && nowTopPx != null && (
              <div
                className="pointer-events-none absolute inset-x-0 z-20"
                style={{ top: Math.max(0, Math.min(nowTopPx, (24 * pxPerHour) - 1)) + 'px' }}
              >
                      {/* Hourglass marker */}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="absolute -left-3 -translate-y-1/2"
                  style={{ top: 0 }}
                  aria-hidden="true"
                >
                  <rect x="6" y="2.5" width="12" height="3" rx="1.5" stroke="#ef4444" strokeWidth="2" />
                  <rect x="6" y="18.5" width="12" height="3" rx="1.5" stroke="#ef4444" strokeWidth="2" />
                  <path d="M8 6c0 3.2 2.2 4.7 4 6-1.8 1.3-4 2.8-4 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 6c0 3.2-2.2 4.7-4 6 1.8 1.3 4 2.8 4 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                      {/* Time label */}
                <div
                  className="absolute right-0 -translate-y-full mb-1 px-1.5 py-0.5 text-[10px] rounded bg-red-500 text-white shadow"
                  style={{ top: 0 }}
                  aria-hidden="true"
                >
                  {formatTime12(nowMs)}
                </div>
                {/* The line itself */}
                <div className="h-[2px] bg-red-500 w-full" />
              </div>
            )}

                  {/* Events */}
                  {isClient && eventsForSelected.map(ev => {
              const currentStart = resizingId === ev.id && resizeGhost ? resizeGhost.start : ev.start;
              const currentEnd = resizingId === ev.id && resizeGhost ? resizeGhost.end : ev.end;
              
              const visibleStart = Math.max(currentStart, dayStartMs);
                    const visibleEnd = Math.min(currentEnd, dayEndMs);
              const vs = new Date(visibleStart);
              const topPx = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
              const heightPx = ((visibleEnd - visibleStart) / (1000 * 60 * 60)) * pxPerHour;
              const renderColor = getAreaColor(ev.area) || ev.color || COLORS[2];
              
              // Get layout for overlapping events
              const layout = eventLayouts.get(ev.id) || { column: 0, totalColumns: 1, width: 1, left: 0 };
              const widthPercent = layout.width * 100;
              const leftPercent = layout.left * 100;
                    
              return (
                <div
                  key={ev.id}
                  data-event-id={ev.id}
                  className={`absolute rounded-md shadow calendar-event select-none ${draggingId === ev.id ? 'cursor-grabbing' : dragDelayActive && dragDelayEventId === ev.id ? 'cursor-wait' : resizingId === ev.id ? 'cursor-ns-resize' : 'cursor-grab'}`}
                  style={{
                    top: (draggingId === ev.id && dragGhostTop != null ? dragGhostTop : Math.max(0, topPx)) + 'px',
                    height: Math.max(24, heightPx) + 'px',
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    background: toRGBA(renderColor, dragDelayActive && dragDelayEventId === ev.id ? 0.2 : resizingId === ev.id ? 0.7 : 0.4),
                    borderLeft: `3px solid ${renderColor}`,
                    willChange: (draggingId === ev.id || resizingId === ev.id) ? 'top, height' : undefined,
                    opacity: dragDelayActive && dragDelayEventId === ev.id ? 0.7 : resizingId === ev.id ? 0.9 : 1,
                    touchAction: (draggingId === ev.id || resizingId === ev.id) ? 'none' : 'pan-y',
                  }}
                  title={ev.title}
                  onMouseDown={(e) => {
                          // Don't start drag if clicking on resize handles
                          if (e.target.closest('[data-resize-handle]')) {
                            return;
                          }
                          
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (dragDelayTimerRef.current) {
                      clearTimeout(dragDelayTimerRef.current);
                    }
                    
                    setDragDelayActive(true);
                    setDragDelayEventId(ev.id);
                    
                    dragDelayTimerRef.current = setTimeout(() => {
                      if (unmountedRef.current) return;
                      const dur = ev.end - ev.start;
                      setDraggingId(ev.id);
                      setDragDelayActive(false);
                      setDragDelayEventId(null);
                      dragRef.current = {
                        startY: e.clientY,
                        origStart: ev.start,
                        origEnd: ev.end,
                        duration: dur,
                        lastStartMs: null,
                        moved: false,
                      };
                      const vs = new Date(Math.max(ev.start, dayStartMs));
                      const topPxSeed = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
                      setDragGhostTop(Math.max(0, topPxSeed));
                    }, 500);
                  }}
                  onMouseUp={(e) => {
                    if (dragDelayActive && dragDelayEventId === ev.id) {
                      if (dragDelayTimerRef.current) {
                        clearTimeout(dragDelayTimerRef.current);
                      }
                      setDragDelayActive(false);
                      setDragDelayEventId(null);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (dragDelayActive && dragDelayEventId === ev.id) {
                      if (dragDelayTimerRef.current) {
                        clearTimeout(dragDelayTimerRef.current);
                      }
                      setDragDelayActive(false);
                      setDragDelayEventId(null);
                    }
                  }}
                  onClick={(e) => { if (dragRef.current.moved || resizeRef.current.moved) { if (e.cancelable) e.preventDefault(); e.stopPropagation(); } else { openEdit(ev); } }}
                >
                  <div className="text-[11px] px-2 py-1 leading-tight">
                    <div className="font-semibold truncate">{ev.title}</div>
                    {ev.area && <div className="text-[10px] opacity-70 truncate">{ev.area}</div>}
                  </div>
                  
                        {/* Resize handles - all four corners */}
                  {!draggingId && (
                    <>
                            {/* Top-left */}
                      <div
                              data-resize-handle
                              className={`absolute top-0 left-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'top-left' ? 'opacity-0' : 'opacity-0'}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startResize(ev, 'top-left', e.clientY);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (e.touches[0]) {
                            startResize(ev, 'top-left', e.touches[0].clientY);
                          }
                        }}
                            />
                            {/* Top-right */}
                            <div
                              data-resize-handle
                              className={`absolute top-0 right-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'top-right' ? 'opacity-0' : 'opacity-0'}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startResize(ev, 'top-right', e.clientY);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (e.touches[0]) {
                            startResize(ev, 'top-right', e.touches[0].clientY);
                          }
                        }}
                            />
                            {/* Bottom-left */}
                            <div
                              data-resize-handle
                              className={`absolute bottom-0 left-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'bottom-left' ? 'opacity-0' : 'opacity-0'}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startResize(ev, 'bottom-left', e.clientY);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (e.touches[0]) {
                            startResize(ev, 'bottom-left', e.touches[0].clientY);
                          }
                        }}
                            />
                            {/* Bottom-right */}
                            <div
                              data-resize-handle
                              className={`absolute bottom-0 right-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'bottom-right' ? 'opacity-0' : 'opacity-0'}`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startResize(ev, 'bottom-right', e.clientY);
                        }}
                        onTouchStart={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (e.touches[0]) {
                            startResize(ev, 'bottom-right', e.touches[0].clientY);
                          }
                        }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Focus Areas Data Block for Day view */}
          <div className="mt-6 pb-6">
            <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Data Split</h2>
              {(() => {
                // Calculate daily planned hours for each focus area
                const dailyGoal = 1; // For day view, we use daily goals
                
                // Calculate day start and end timestamps
                const dayStart = selectedDate ? new Date(selectedDate) : new Date();
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = selectedDate ? new Date(selectedDate) : new Date();
                dayEnd.setHours(23, 59, 59, 999);
                const dayStartMs = dayStart.getTime();
                const dayEndMs = dayEnd.getTime();
                
                // Helper function to normalize labels for comparison
                const normalizeLabel = (label) => (label || '').trim().toLowerCase();
                
                const focusAreaData = focusAreas.map((area, index) => {
                  const dailyGoalHours = Number(area.goal || 0);
                  
                  // Get actual time logged from dashboard (stored in days object)
                  let actualTimeLogged = 0;
                  if (selectedDate && area.days) {
                    // Get day abbreviation (Su, M, Tu, W, Th, F, Sa)
                    const dayAbbrev = DAYS[selectedDate.getDay()];
                    // Get logged time for this specific day from the dashboard
                    if (typeof area.days === 'object' && area.days[dayAbbrev] !== undefined) {
                      actualTimeLogged = Number(area.days[dayAbbrev]) || 0;
                    }
                  }
                  
                  return {
                    label: area.label,
                    color: area.color || COLORS[index % COLORS.length],
                    dailyGoal: dailyGoalHours,
                    dailyPlanned: dailyGoalHours,
                    actualTimeLogged
                  };
                });
                
                // Calculate total actual time logged (for percentages)
                const totalActual = focusAreaData.reduce((sum, area) => sum + area.actualTimeLogged, 0);
                
                // Calculate percentages and build pie chart data based on actual time logged
                const pieData = focusAreaData
                  .filter(area => area.actualTimeLogged > 0)
                  .map((area) => ({
                    ...area,
                    percentage: totalActual > 0 ? (area.actualTimeLogged / totalActual) * 100 : 0
                  }))
                  .sort((a, b) => b.percentage - a.percentage);
                
                // Build pie chart path data
                let currentOffset = 0;
                const radius = 50;
                const circumference = 2 * Math.PI * radius;
                const centerX = 130;
                const centerY = 130;
                const strokeWidth = 20;
                
                // Helper function to create arc path for a segment with flat trailing edge
                // The rounded leading edge is added separately as a circle cap
                // startAngle and endAngle in degrees, with 0 at top (12 o'clock)
                const createArcPath = (startAngle, endAngle, innerRadius, outerRadius) => {
                  const startRad = ((startAngle - 90) * Math.PI) / 180;
                  const endRad = ((endAngle - 90) * Math.PI) / 180;
                  
                  // Flat trailing edge points (straight radial line - no rounding)
                  const startXInner = centerX + Math.cos(startRad) * innerRadius;
                  const startYInner = centerY + Math.sin(startRad) * innerRadius;
                  const startXOuter = centerX + Math.cos(startRad) * outerRadius;
                  const startYOuter = centerY + Math.sin(startRad) * outerRadius;
                  
                  // Leading edge points (will have rounded cap added separately)
                  const endXInner = centerX + Math.cos(endRad) * innerRadius;
                  const endYInner = centerY + Math.sin(endRad) * innerRadius;
                  const endXOuter = centerX + Math.cos(endRad) * outerRadius;
                  const endYOuter = centerY + Math.sin(endRad) * outerRadius;
                  
                  const largeArcFlag = (endAngle - startAngle) > 180 ? 1 : 0;
                  
                  // Path: 
                  // 1. Start at inner radius (flat trailing edge)
                  // 2. Straight line to outer radius (flat edge - no curve)
                  // 3. Arc along outer edge to end (straight cut, rounded cap added separately)
                  // 4. Straight line from outer to inner at end
                  // 5. Arc back along inner edge to start (completes the segment)
                  return `M ${startXInner} ${startYInner} L ${startXOuter} ${startYOuter} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${endXOuter} ${endYOuter} L ${endXInner} ${endYInner} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${startXInner} ${startYInner} Z`;
                };
                
                // Calculate positions for all segments
                let tempOffset = 0;
                const segmentPositions = pieData.map((area) => {
                  const dashLength = (area.percentage / 100) * circumference;
                  const startAngle = (tempOffset / circumference) * 360;
                  const endAngle = ((tempOffset + dashLength) / circumference) * 360;
                  const midAngle = (startAngle + endAngle) / 2;
                  const result = {
                    area,
                    dashLength,
                    startAngle,
                    endAngle,
                    midAngle,
                    offset: tempOffset
                  };
                  tempOffset += dashLength;
                  return result;
                });
                
                return (
                  <div className="flex items-center justify-center gap-4 -mt-4 min-h-[260px] pl-4 pr-6">
                    {/* Pie Chart */}
                    <div className="flex-shrink-0 relative flex items-center justify-center" style={{ width: '260px', height: '260px' }}>
                      <svg width="260" height="260" viewBox="0 0 260 260">
                        {/* Base circle with black stroke for separation */}
                        <circle
                          cx={centerX}
                          cy={centerY}
                          r={radius}
                          fill="none"
                          stroke="#000000"
                          strokeWidth="22"
                          strokeOpacity="0.5"
                        />
                        {/* Render all segments with consistent tucking style */}
                        {segmentPositions.map((pos, index) => {
                          const area = pos.area;
                          const innerRadius = radius - strokeWidth / 2;
                          const outerRadius = radius + strokeWidth / 2;
                          
                          // Alternate label distance (closer/further) to prevent overlap
                          const isEven = index % 2 === 0;
                          const labelRadius = radius + (isEven ? 30 : 50);
                          
                          // Adjust angle for 12 o'clock start (same as createArcPath)
                          const labelAngleRad = ((pos.midAngle - 90) * Math.PI) / 180;
                          const labelX = centerX + Math.cos(labelAngleRad) * labelRadius;
                          const labelY = centerY + Math.sin(labelAngleRad) * labelRadius;
                          
                          return (
                            <g key={area.label}>
                              {/* Main segment path with flat trailing edge */}
                              <path
                                d={createArcPath(pos.startAngle, pos.endAngle, innerRadius, outerRadius)}
                                fill={area.color}
                                stroke="none"
                              />
                              {/* Add rounded cap at leading edge using stroke */}
                              <circle
                                cx={centerX + Math.cos(((pos.endAngle - 90) * Math.PI) / 180) * radius}
                                cy={centerY + Math.sin(((pos.endAngle - 90) * Math.PI) / 180) * radius}
                                r={strokeWidth / 2}
                                fill={area.color}
                                stroke="none"
                              />
                              {/* Percentage label - outside the ring, always horizontal */}
                              <text
                                x={labelX}
                                y={labelY}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="text-xs font-semibold"
                                style={{ fill: area.color }}
                              >
                                {area.percentage.toFixed(1)}%
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                      </div>

                    {/* Focus Areas List */}
                    <div className="flex-1 flex items-center">
                      <div className="space-y-2 w-full">
                        {pieData.length > 0 ? (
                          pieData.map((area) => (
                            <div key={area.label} className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: area.color }}
                              />
                              <span className="text-xs text-gray-900">{area.label}</span>
                              <span className="text-xs text-gray-600 ml-auto">
                                {Math.round(area.actualTimeLogged * 10) / 10}/{Math.round(area.dailyPlanned)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-gray-600">No focus areas yet. Add them from the dashboard.</div>
                        )}
                      </div>
                    </div>
                </div>
              );
              })()}
          </div>
        </div>
        </div>
      ) : currentView === '3 Day' ? (
        /* 3 Day view */
        <div className="flex-1 overflow-y-auto px-4 scroll-smooth" style={{ paddingTop: `${Math.max(insets.top, 44) + 80}px` }}>
          {/* Calculate the 3 days */}
          {(() => {
            if (!selectedDate) return null;
            
            const day1 = new Date(selectedDate);
            day1.setHours(0, 0, 0, 0);
            const day2 = new Date(day1);
            day2.setDate(day2.getDate() + 1);
            const day3 = new Date(day1);
            day3.setDate(day3.getDate() + 2);
            
            const threeDays = [day1, day2, day3];
            
            // Calculate day boundaries for each day
            const daysData = threeDays.map(day => {
              const dayStart = new Date(day);
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = new Date(day);
              dayEnd.setHours(23, 59, 59, 999);
              const dayStartMs = dayStart.getTime();
              const dayEndMs = dayEnd.getTime();
              
              // Get events for this day
              const allDayEvents = allEvents.filter(ev => ev.end > dayStartMs && ev.start < dayEndMs);
              // Filter by visible focus areas
              const dayEvents = filterEventsByVisibility(allDayEvents);
              
              // Calculate layouts for this day's events
              const layouts = calculateEventLayouts(dayEvents, dayStartMs, dayEndMs);
              
              return {
                date: day,
                dayStartMs,
                dayEndMs,
                events: dayEvents,
                layouts
              };
            });
            
            return (
              <>
                <div ref={gridRootRef} className="relative">
                  <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-4">
                    <div className="grid grid-cols-[56px_repeat(3,minmax(0,1fr))]">
                      {/* Hours gutter */}
                      <div className="flex flex-col items-end pr-2">
                        {isClient && HOURS.map((h) => (
                          <div
                            key={h}
                            className="text-xs text-gray-700 flex items-start"
                            style={{ height: `${pxPerHour}px` }}
                          >
                            <div className="-translate-y-1">{formatHour(h)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Three day columns */}
                      {daysData.map((dayData, dayIndex) => {
                        const isToday = sameDay(dayData.date, today);
                        const showNowLine = isToday && isClient && nowTopPx != null;
                        
                        return (
                          <div
                            key={dayIndex}
                            className="relative border-l border-gray-300/60 overflow-visible"
                            style={{ touchAction: draggingId ? 'none' : undefined, userSelect: draggingId ? 'none' : undefined }}
                          >
                            {/* Day header */}
                            <div className="sticky top-0 z-10 bg-white/30 backdrop-blur-sm border-b border-gray-300/60 px-2 py-1 mb-0">
                              <div className="text-xs font-semibold text-gray-900">
                                {dayData.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </div>
                            </div>
                            
                            {/* Hour slots */}
                            {HOURS.map((h) => (
                              <div
                                key={h}
                                className="h-16 border-b border-gray-200/50 hover:bg-white/10 cursor-pointer transition-colors"
                                onClick={() => {
                                  const clickedDate = new Date(dayData.date);
                                  setSelectedDate(clickedDate);
                                  // Use setTimeout to ensure state is updated before opening slot
                                  setTimeout(() => {
                                    setDraft({
                                      ...DEFAULT_DRAFT,
                                      dateYMD: ymd(clickedDate),
                                      start: `${String(h).padStart(2, "0")}:00`,
                                      end: h === 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:00`,
                                    });
                                    setShowModal(true);
                                  }, 0);
                                }}
                              />
                            ))}

                            {/* Current time indicator - only for today */}
                            {showNowLine && (
                              <div
                                className="pointer-events-none absolute inset-x-0 z-20"
                                style={{ top: Math.max(0, Math.min(nowTopPx, (24 * pxPerHour) - 1)) + 32 + 'px' }}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  className="absolute -left-3 -translate-y-1/2"
                                  style={{ top: 0 }}
                                  aria-hidden="true"
                                >
                                  <rect x="6" y="2.5" width="12" height="3" rx="1.5" stroke="#ef4444" strokeWidth="2" />
                                  <rect x="6" y="18.5" width="12" height="3" rx="1.5" stroke="#ef4444" strokeWidth="2" />
                                  <path d="M8 6c0 3.2 2.2 4.7 4 6-1.8 1.3-4 2.8-4 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M16 6c0 3.2-2.2 4.7-4 6 1.8 1.3 4 2.8 4 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div
                                  className="absolute right-0 -translate-y-full mb-1 px-1.5 py-0.5 text-[10px] rounded bg-red-500 text-white shadow"
                                  style={{ top: 0 }}
                                  aria-hidden="true"
                                >
                                  {formatTime12(nowMs)}
                                </div>
                                <div className="h-[2px] bg-red-500 w-full" />
                              </div>
                            )}

                            {/* Events for this day */}
                            {isClient && dayData.events.map(ev => {
                              const currentStart = resizingId === ev.id && resizeGhost ? resizeGhost.start : ev.start;
                              const currentEnd = resizingId === ev.id && resizeGhost ? resizeGhost.end : ev.end;
                              
                              const visibleStart = Math.max(currentStart, dayData.dayStartMs);
                              const visibleEnd = Math.min(currentEnd, dayData.dayEndMs);
                              const vs = new Date(visibleStart);
                              const topPx = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
                              const heightPx = ((visibleEnd - visibleStart) / (1000 * 60 * 60)) * pxPerHour;
                              const renderColor = getAreaColor(ev.area) || ev.color || COLORS[2];
                              
                              const layout = dayData.layouts.get(ev.id) || { column: 0, totalColumns: 1, width: 1, left: 0 };
                              const widthPercent = layout.width * 100;
                              const leftPercent = layout.left * 100;
                              
                              return (
                                <div
                                  key={ev.id}
                                  data-event-id={ev.id}
                                  className={`absolute rounded-md shadow calendar-event select-none ${draggingId === ev.id ? 'cursor-grabbing' : dragDelayActive && dragDelayEventId === ev.id ? 'cursor-wait' : resizingId === ev.id ? 'cursor-ns-resize' : 'cursor-grab'}`}
                                  style={{
                                    top: (draggingId === ev.id && dragGhostTop != null ? dragGhostTop : Math.max(32, topPx + 32)) + 'px',
                                    height: Math.max(24, heightPx) + 'px',
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    background: toRGBA(renderColor, dragDelayActive && dragDelayEventId === ev.id ? 0.2 : resizingId === ev.id ? 0.7 : 0.4),
                                    borderLeft: `3px solid ${renderColor}`,
                                    willChange: (draggingId === ev.id || resizingId === ev.id) ? 'top, height' : undefined,
                                    opacity: dragDelayActive && dragDelayEventId === ev.id ? 0.7 : resizingId === ev.id ? 0.9 : 1,
                                    touchAction: (draggingId === ev.id || resizingId === ev.id) ? 'none' : 'pan-y',
                                  }}
                                  title={ev.title}
                                  onMouseDown={(e) => {
                                    if (e.target.closest('[data-resize-handle]')) {
                                      return;
                                    }
                                    
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    if (dragDelayTimerRef.current) {
                                      clearTimeout(dragDelayTimerRef.current);
                                    }
                                    
                                    setDragDelayActive(true);
                                    setDragDelayEventId(ev.id);
                                    
                                    dragDelayTimerRef.current = setTimeout(() => {
                                      if (unmountedRef.current) return;
                                      const dur = ev.end - ev.start;
                                      setDraggingId(ev.id);
                                      setDragDelayActive(false);
                                      setDragDelayEventId(null);
                                      dragRef.current = {
                                        startY: e.clientY,
                                        origStart: ev.start,
                                        origEnd: ev.end,
                                        duration: dur,
                                        lastStartMs: null,
                                        moved: false,
                                      };
                                      const vs = new Date(Math.max(ev.start, dayData.dayStartMs));
                                      const topPxSeed = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
                                      setDragGhostTop(Math.max(32, topPxSeed + 32));
                                    }, 500);
                                  }}
                                  onMouseUp={(e) => {
                                    if (dragDelayActive && dragDelayEventId === ev.id) {
                                      if (dragDelayTimerRef.current) {
                                        clearTimeout(dragDelayTimerRef.current);
                                      }
                                      setDragDelayActive(false);
                                      setDragDelayEventId(null);
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (dragDelayActive && dragDelayEventId === ev.id) {
                                      if (dragDelayTimerRef.current) {
                                        clearTimeout(dragDelayTimerRef.current);
                                      }
                                      setDragDelayActive(false);
                                      setDragDelayEventId(null);
                                    }
                                  }}
                                  onClick={(e) => { if (dragRef.current.moved || resizeRef.current.moved) { if (e.cancelable) e.preventDefault(); e.stopPropagation(); } else { openEdit(ev); } }}
                                >
                                  <div className="text-[11px] px-2 py-1 leading-tight">
                                    <div className="font-semibold truncate">{ev.title}</div>
                                    {ev.area && <div className="text-[10px] opacity-70 truncate">{ev.area}</div>}
                                  </div>
                                  
                                  {!draggingId && (
                                    <>
                                      <div
                                        data-resize-handle
                                        className={`absolute top-0 left-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'top-left' ? 'opacity-0' : 'opacity-0'}`}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          startResize(ev, 'top-left', e.clientY);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (e.touches[0]) {
                                            startResize(ev, 'top-left', e.touches[0].clientY);
                                          }
                                        }}
                                      />
                                      <div
                                        data-resize-handle
                                        className={`absolute top-0 right-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'top-right' ? 'opacity-0' : 'opacity-0'}`}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          startResize(ev, 'top-right', e.clientY);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (e.touches[0]) {
                                            startResize(ev, 'top-right', e.touches[0].clientY);
                                          }
                                        }}
                                      />
                                      <div
                                        data-resize-handle
                                        className={`absolute bottom-0 left-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'bottom-left' ? 'opacity-0' : 'opacity-0'}`}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          startResize(ev, 'bottom-left', e.clientY);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (e.touches[0]) {
                                            startResize(ev, 'bottom-left', e.touches[0].clientY);
                                          }
                                        }}
                                      />
                                      <div
                                        data-resize-handle
                                        className={`absolute bottom-0 right-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'bottom-right' ? 'opacity-0' : 'opacity-0'}`}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          startResize(ev, 'bottom-right', e.clientY);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (e.touches[0]) {
                                            startResize(ev, 'bottom-right', e.touches[0].clientY);
                                          }
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Focus Areas Data Block for 3 Day view */}
                <div className="mt-6 pb-6">
                  <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-4">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">3 Day Data Split</h2>
                    {(() => {
                      // Calculate 3 day totals for the selected 3 days
                      const day1 = selectedDate ? new Date(selectedDate) : new Date();
                      day1.setHours(0, 0, 0, 0);
                      const day2 = new Date(day1);
                      day2.setDate(day2.getDate() + 1);
                      const day3 = new Date(day1);
                      day3.setDate(day3.getDate() + 2);
                      const threeDays = [day1, day2, day3];
                      
                      const normalizeLabel = (label) => (label || '').trim().toLowerCase();
                      
                      const focusAreaData = focusAreas.map((area, index) => {
                        const dailyGoalHours = Number(area.goal || 0);
                        
                        // Sum up actual time logged across all 3 days
                        let actualTimeLogged = 0;
                        if (area.days && typeof area.days === 'object') {
                          for (let i = 0; i < 3; i++) {
                            const day = threeDays[i];
                            const dayAbbrev = DAYS[day.getDay()];
                            if (area.days[dayAbbrev] !== undefined) {
                              actualTimeLogged += Number(area.days[dayAbbrev]) || 0;
                            }
                          }
                        }
                        
                        // Calculate 3 day goal (daily goal * 3)
                        const threeDayGoal = dailyGoalHours * 3;
                        
                        return {
                          label: area.label,
                          color: area.color || COLORS[index % COLORS.length],
                          dailyGoal: dailyGoalHours,
                          threeDayGoal: threeDayGoal,
                          actualTimeLogged
                        };
                      });
                      
                      const totalActual = focusAreaData.reduce((sum, area) => sum + area.actualTimeLogged, 0);
                      
                      const pieData = focusAreaData
                        .filter(area => area.actualTimeLogged > 0)
                        .map((area) => ({
                          ...area,
                          percentage: totalActual > 0 ? (area.actualTimeLogged / totalActual) * 100 : 0
                        }))
                        .sort((a, b) => b.percentage - a.percentage);
                      
                      let currentOffset = 0;
                      const radius = 50;
                      const circumference = 2 * Math.PI * radius;
                      const centerX = 130;
                      const centerY = 130;
                      
                      return (
                        <div className="flex items-center justify-center gap-4 -mt-4 min-h-[260px] pl-4 pr-6">
                          <div className="flex-shrink-0 relative flex items-center justify-center" style={{ width: '260px', height: '260px' }}>
                            <svg width="260" height="260" viewBox="0 0 260 260">
                              {/* Base circle with black stroke for separation */}
                              <circle
                                cx={centerX}
                                cy={centerY}
                                r={radius}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="22"
                                strokeOpacity="0.5"
                              />
                              {pieData.map((area, index) => {
                                const dashLength = (area.percentage / 100) * circumference;
                                const dashOffset = -currentOffset;
                                const startAngle = (currentOffset / circumference) * 360;
                                const endAngle = ((currentOffset + dashLength) / circumference) * 360;
                                const midAngle = (startAngle + endAngle) / 2;
                                
                                const isEven = index % 2 === 0;
                                const labelRadius = radius + (isEven ? 30 : 50);
                                
                                const labelAngleRad = (midAngle * Math.PI) / 180;
                                const labelX = centerX + Math.cos(labelAngleRad) * labelRadius;
                                const labelY = centerY + Math.sin(labelAngleRad) * labelRadius;
                                
                                currentOffset += dashLength;
                                
                                return (
                                  <g key={area.label}>
                                    <circle
                                      cx={centerX}
                                      cy={centerY}
                                      r={radius}
                                      fill="none"
                                      stroke={area.color}
                                      strokeWidth="20"
                                      strokeDasharray={`${dashLength} ${circumference}`}
                                      strokeDashoffset={dashOffset}
                                      strokeLinecap="round"
                                    />
                                    <text
                                      x={labelX}
                                      y={labelY}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      className="text-xs font-semibold"
                                      style={{ fill: area.color }}
                                    >
                                      {area.percentage.toFixed(1)}%
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>

                          <div className="flex-1 flex items-center">
                            <div className="space-y-2 w-full">
                              {pieData.length > 0 ? (
                                pieData.map((area) => (
                                  <div key={area.label} className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: area.color }}
                                    />
                                    <span className="text-xs text-gray-900">{area.label}</span>
                                    <span className="text-xs text-gray-600 ml-auto">
                                      {Math.round(area.actualTimeLogged * 10) / 10}/{Math.round(area.threeDayGoal)}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-gray-600">No focus areas yet. Add them from the dashboard.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : currentView === 'Week' ? (
        /* Week view */
        <div className="flex-1 overflow-y-auto px-4 scroll-smooth" style={{ paddingTop: `${Math.max(insets.top, 44) + 80}px` }}>
          {/* Calculate the 7 days of the week */}
          {(() => {
            if (!selectedDate) return null;
            
            // Get the start of the week (Sunday)
            const weekStart = startOfWeek(selectedDate);
            const weekDays = Array.from({ length: 7 }, (_, i) => {
              const day = new Date(weekStart);
              day.setDate(weekStart.getDate() + i);
              day.setHours(0, 0, 0, 0);
              return day;
            });
            
            // Calculate day boundaries for each day
            const daysData = weekDays.map(day => {
              const dayStart = new Date(day);
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = new Date(day);
              dayEnd.setHours(23, 59, 59, 999);
              const dayStartMs = dayStart.getTime();
              const dayEndMs = dayEnd.getTime();
              
              // Get events for this day
              const allDayEvents = allEvents.filter(ev => ev.end > dayStartMs && ev.start < dayEndMs);
              // Filter by visible focus areas
              const dayEvents = filterEventsByVisibility(allDayEvents);
              
              // Calculate layouts for this day's events
              const layouts = calculateEventLayouts(dayEvents, dayStartMs, dayEndMs);
              
              return {
                date: day,
                dayStartMs,
                dayEndMs,
                events: dayEvents,
                layouts
              };
            });
            
            return (
              <>
                <div ref={gridRootRef} className="relative">
                  <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-4">
                    <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
                      {/* Hours gutter */}
                      <div className="flex flex-col items-end pr-2">
                        {isClient && HOURS.map((h) => (
                          <div
                            key={h}
                            className="text-xs text-gray-700 flex items-start"
                            style={{ height: `${pxPerHour}px` }}
                          >
                            <div className="-translate-y-1">{formatHour(h)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Seven day columns */}
                      {daysData.map((dayData, dayIndex) => {
                        const isToday = sameDay(dayData.date, today);
                        const showNowLine = isToday && isClient && nowTopPx != null;
                        
                        return (
                          <div
                            key={dayIndex}
                            className="relative border-l border-gray-300/60 overflow-visible"
                            style={{ touchAction: draggingId ? 'none' : undefined, userSelect: draggingId ? 'none' : undefined }}
                          >
                            {/* Day header */}
                            <div className={`sticky top-0 z-10 backdrop-blur-sm border-b border-gray-300/60 px-2 py-1 mb-0 ${isToday ? 'bg-blue-100/50' : 'bg-white/30'}`}>
                              <div className={`text-xs font-semibold ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                                {dayData.date.toLocaleDateString("en-US", { weekday: "short" })}
                              </div>
                              <div className={`text-xs ${isToday ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                                {dayData.date.getDate()}
                              </div>
                            </div>
                            
                            {/* Hour slots */}
                            {HOURS.map((h) => (
                              <div
                                key={h}
                                className="h-16 border-b border-gray-200/50 hover:bg-white/10 cursor-pointer transition-colors"
                                onClick={() => {
                                  const clickedDate = new Date(dayData.date);
                                  setSelectedDate(clickedDate);
                                  // Use setTimeout to ensure state is updated before opening slot
                                  setTimeout(() => {
                                    setDraft({
                                      ...DEFAULT_DRAFT,
                                      dateYMD: ymd(clickedDate),
                                      start: `${String(h).padStart(2, "0")}:00`,
                                      end: h === 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:00`,
                                    });
                                    setShowModal(true);
                                  }, 0);
                                }}
                              />
                            ))}

                            {/* Current time indicator - only for today */}
                            {showNowLine && (
                              <div
                                className="pointer-events-none absolute inset-x-0 z-20"
                                style={{ top: Math.max(0, Math.min(nowTopPx, (24 * pxPerHour) - 1)) + 48 + 'px' }}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  className="absolute -left-3 -translate-y-1/2"
                                  style={{ top: 0 }}
                                  aria-hidden="true"
                                >
                                  <rect x="6" y="2.5" width="12" height="3" rx="1.5" stroke="#ef4444" strokeWidth="2" />
                                  <rect x="6" y="18.5" width="12" height="3" rx="1.5" stroke="#ef4444" strokeWidth="2" />
                                  <path d="M8 6c0 3.2 2.2 4.7 4 6-1.8 1.3-4 2.8-4 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M16 6c0 3.2-2.2 4.7-4 6 1.8 1.3 4 2.8 4 6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                <div
                                  className="absolute right-0 -translate-y-full mb-1 px-1.5 py-0.5 text-[10px] rounded bg-red-500 text-white shadow"
                                  style={{ top: 0 }}
                                  aria-hidden="true"
                                >
                                  {formatTime12(nowMs)}
                                </div>
                                <div className="h-[2px] bg-red-500 w-full" />
                              </div>
                            )}

                            {/* Events for this day */}
                            {isClient && dayData.events.map(ev => {
                              const currentStart = resizingId === ev.id && resizeGhost ? resizeGhost.start : ev.start;
                              const currentEnd = resizingId === ev.id && resizeGhost ? resizeGhost.end : ev.end;
                              
                              const visibleStart = Math.max(currentStart, dayData.dayStartMs);
                              const visibleEnd = Math.min(currentEnd, dayData.dayEndMs);
                              const vs = new Date(visibleStart);
                              const topPx = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
                              const heightPx = ((visibleEnd - visibleStart) / (1000 * 60 * 60)) * pxPerHour;
                              const renderColor = getAreaColor(ev.area) || ev.color || COLORS[2];
                              
                              const layout = dayData.layouts.get(ev.id) || { column: 0, totalColumns: 1, width: 1, left: 0 };
                              const widthPercent = layout.width * 100;
                              const leftPercent = layout.left * 100;
                              
                              return (
                                <div
                                  key={ev.id}
                                  data-event-id={ev.id}
                                  className={`absolute rounded-md shadow calendar-event select-none ${draggingId === ev.id ? 'cursor-grabbing' : dragDelayActive && dragDelayEventId === ev.id ? 'cursor-wait' : resizingId === ev.id ? 'cursor-ns-resize' : 'cursor-grab'}`}
                                  style={{
                                    top: (draggingId === ev.id && dragGhostTop != null ? dragGhostTop : Math.max(48, topPx + 48)) + 'px',
                                    height: Math.max(24, heightPx) + 'px',
                                    left: `${leftPercent}%`,
                                    width: `${widthPercent}%`,
                                    background: toRGBA(renderColor, dragDelayActive && dragDelayEventId === ev.id ? 0.2 : resizingId === ev.id ? 0.7 : 0.4),
                                    borderLeft: `3px solid ${renderColor}`,
                                    willChange: (draggingId === ev.id || resizingId === ev.id) ? 'top, height' : undefined,
                                    opacity: dragDelayActive && dragDelayEventId === ev.id ? 0.7 : resizingId === ev.id ? 0.9 : 1,
                                    touchAction: (draggingId === ev.id || resizingId === ev.id) ? 'none' : 'pan-y',
                                  }}
                                  title={ev.title}
                                  onMouseDown={(e) => {
                                    if (e.target.closest('[data-resize-handle]')) {
                                      return;
                                    }
                                    
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    if (dragDelayTimerRef.current) {
                                      clearTimeout(dragDelayTimerRef.current);
                                    }
                                    
                                    setDragDelayActive(true);
                                    setDragDelayEventId(ev.id);
                                    
                                    dragDelayTimerRef.current = setTimeout(() => {
                                      if (unmountedRef.current) return;
                                      const dur = ev.end - ev.start;
                                      setDraggingId(ev.id);
                                      setDragDelayActive(false);
                                      setDragDelayEventId(null);
                                      dragRef.current = {
                                        startY: e.clientY,
                                        origStart: ev.start,
                                        origEnd: ev.end,
                                        duration: dur,
                                        lastStartMs: null,
                                        moved: false,
                                      };
                                      const vs = new Date(Math.max(ev.start, dayData.dayStartMs));
                                      const topPxSeed = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
                                      setDragGhostTop(Math.max(48, topPxSeed + 48));
                                    }, 500);
                                  }}
                                  onMouseUp={(e) => {
                                    if (dragDelayActive && dragDelayEventId === ev.id) {
                                      if (dragDelayTimerRef.current) {
                                        clearTimeout(dragDelayTimerRef.current);
                                      }
                                      setDragDelayActive(false);
                                      setDragDelayEventId(null);
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (dragDelayActive && dragDelayEventId === ev.id) {
                                      if (dragDelayTimerRef.current) {
                                        clearTimeout(dragDelayTimerRef.current);
                                      }
                                      setDragDelayActive(false);
                                      setDragDelayEventId(null);
                                    }
                                  }}
                                  onClick={(e) => { if (dragRef.current.moved || resizeRef.current.moved) { if (e.cancelable) e.preventDefault(); e.stopPropagation(); } else { openEdit(ev); } }}
                                >
                                  <div className="text-[11px] px-2 py-1 leading-tight">
                                    <div className="font-semibold truncate">{ev.title}</div>
                                    {ev.area && <div className="text-[10px] opacity-70 truncate">{ev.area}</div>}
                                  </div>
                                  
                                  {!draggingId && (
                                    <>
                                      <div
                                        data-resize-handle
                                        className={`absolute top-0 left-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'top-left' ? 'opacity-0' : 'opacity-0'}`}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          startResize(ev, 'top-left', e.clientY);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (e.touches[0]) {
                                            startResize(ev, 'top-left', e.touches[0].clientY);
                                          }
                                        }}
                                      />
                                      <div
                                        data-resize-handle
                                        className={`absolute top-0 right-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'top-right' ? 'opacity-0' : 'opacity-0'}`}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          startResize(ev, 'top-right', e.clientY);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (e.touches[0]) {
                                            startResize(ev, 'top-right', e.touches[0].clientY);
                                          }
                                        }}
                                      />
                                      <div
                                        data-resize-handle
                                        className={`absolute bottom-0 left-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'bottom-left' ? 'opacity-0' : 'opacity-0'}`}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          startResize(ev, 'bottom-left', e.clientY);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (e.touches[0]) {
                                            startResize(ev, 'bottom-left', e.touches[0].clientY);
                                          }
                                        }}
                                      />
                                      <div
                                        data-resize-handle
                                        className={`absolute bottom-0 right-0 w-6 h-6 cursor-ns-resize select-none ${resizingId === ev.id && resizeHandle === 'bottom-right' ? 'opacity-0' : 'opacity-0'}`}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          startResize(ev, 'bottom-right', e.clientY);
                                        }}
                                        onTouchStart={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (e.touches[0]) {
                                            startResize(ev, 'bottom-right', e.touches[0].clientY);
                                          }
                                        }}
                                      />
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                {/* Focus Areas Data Block for Week view */}
                <div className="mt-6 pb-6">
                  <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-4">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Data Split</h2>
                    {(() => {
                      // Calculate weekly totals for the selected week
                      const weekStartDate = startOfWeek(selectedDate);
                      const weekEndDate = new Date(weekStartDate);
                      weekEndDate.setDate(weekStartDate.getDate() + 6);
                      weekEndDate.setHours(23, 59, 59, 999);
                      
                      const normalizeLabel = (label) => (label || '').trim().toLowerCase();
                      
                      const focusAreaData = focusAreas.map((area, index) => {
                        // Sum up actual time logged across all days in the week
                        let actualTimeLogged = 0;
                        if (area.days && typeof area.days === 'object') {
                          for (let i = 0; i < 7; i++) {
                            const day = new Date(weekStartDate);
                            day.setDate(weekStartDate.getDate() + i);
                            const dayAbbrev = DAYS[day.getDay()];
                            if (area.days[dayAbbrev] !== undefined) {
                              actualTimeLogged += Number(area.days[dayAbbrev]) || 0;
                            }
                          }
                        }
                        
                        // Calculate weekly goal (daily goal * 7)
                        const dailyGoalHours = Number(area.goal || 0);
                        const weeklyGoal = dailyGoalHours * 7;
                        
                        return {
                          label: area.label,
                          color: area.color || COLORS[index % COLORS.length],
                          dailyGoal: dailyGoalHours,
                          weeklyGoal: weeklyGoal,
                          actualTimeLogged
                        };
                      });
                      
                      const totalActual = focusAreaData.reduce((sum, area) => sum + area.actualTimeLogged, 0);
                      
                      const pieData = focusAreaData
                        .filter(area => area.actualTimeLogged > 0)
                        .map((area) => ({
                          ...area,
                          percentage: totalActual > 0 ? (area.actualTimeLogged / totalActual) * 100 : 0
                        }))
                        .sort((a, b) => b.percentage - a.percentage);
                      
                      let currentOffset = 0;
                      const radius = 50;
                      const circumference = 2 * Math.PI * radius;
                      const centerX = 130;
                      const centerY = 130;
                      
                      return (
                        <div className="flex items-center justify-center gap-4 -mt-4 min-h-[260px] pl-4 pr-6">
                          <div className="flex-shrink-0 relative flex items-center justify-center" style={{ width: '260px', height: '260px' }}>
                            <svg width="260" height="260" viewBox="0 0 260 260">
                              {/* Base circle with black stroke for separation */}
                              <circle
                                cx={centerX}
                                cy={centerY}
                                r={radius}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="22"
                                strokeOpacity="0.5"
                              />
                              {pieData.map((area, index) => {
                                const dashLength = (area.percentage / 100) * circumference;
                                const dashOffset = -currentOffset;
                                const startAngle = (currentOffset / circumference) * 360;
                                const endAngle = ((currentOffset + dashLength) / circumference) * 360;
                                const midAngle = (startAngle + endAngle) / 2;
                                
                                const isEven = index % 2 === 0;
                                const labelRadius = radius + (isEven ? 30 : 50);
                                
                                const labelAngleRad = (midAngle * Math.PI) / 180;
                                const labelX = centerX + Math.cos(labelAngleRad) * labelRadius;
                                const labelY = centerY + Math.sin(labelAngleRad) * labelRadius;
                                
                                currentOffset += dashLength;
                                
                                return (
                                  <g key={area.label}>
                                    <circle
                                      cx={centerX}
                                      cy={centerY}
                                      r={radius}
                                      fill="none"
                                      stroke={area.color}
                                      strokeWidth="20"
                                      strokeDasharray={`${dashLength} ${circumference}`}
                                      strokeDashoffset={dashOffset}
                                      strokeLinecap="round"
                                    />
                                    <text
                                      x={labelX}
                                      y={labelY}
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      className="text-xs font-semibold"
                                      style={{ fill: area.color }}
                                    >
                                      {area.percentage.toFixed(1)}%
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>

                          <div className="flex-1 flex items-center">
                            <div className="space-y-2 w-full">
                              {pieData.length > 0 ? (
                                pieData.map((area) => (
                                  <div key={area.label} className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0" 
                                      style={{ backgroundColor: area.color }}
                                    />
                                    <span className="text-xs text-gray-900">{area.label}</span>
                                    <span className="text-xs text-gray-600 ml-auto">
                                      {Math.round(area.actualTimeLogged * 10) / 10}/{Math.round(area.weeklyGoal)}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-gray-600">No focus areas yet. Add them from the dashboard.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : currentView === 'Month' ? (
        /* Month view */
        <div className="flex-1 overflow-y-auto px-4 scroll-smooth" style={{ paddingTop: `${Math.max(insets.top, 44) + 80}px` }}>
          {/* Month grid */}
          <div className="w-full">
            {/* Calendar grid container with glassmorphic styling */}
            <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-4">
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-xs font-semibold text-gray-900 py-2">
                    {day}
                  </div>
                ))}
      </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {monthGrid.map((date, idx) => {
                  const inMonth = date.getMonth() === viewMonth.getMonth();
                  const isToday = sameDay(date, today);
                  const dayEvents = getEventsForDate(date);
                  
                  return (
                    <div
                      key={idx}
                      className={`h-[80px] p-1 rounded-md border flex flex-col ${inMonth ? 'bg-white/40 backdrop-blur-sm hover:bg-white/50 border-gray-300/60' : 'bg-white/20 border-gray-200/40'} ${isToday ? 'ring-2 ring-slate-500 border-slate-400' : ''} transition-all cursor-pointer`}
                      onClick={() => {
                        setSelectedDate(new Date(date));
                        setCurrentView('Day');
                      }}
                    >
                      <div className={`text-sm font-medium text-center flex-shrink-0 h-8 flex items-center justify-center ${inMonth ? 'text-gray-900' : 'text-gray-500'} ${isToday ? 'text-slate-600' : ''}`}>
                        {isToday ? (
                          <div className="w-8 h-8 rounded-full bg-slate-500 text-white flex items-center justify-center mx-auto">
                            {date.getDate()}
                          </div>
                        ) : (
                          date.getDate()
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1 px-1 flex-shrink-0 mt-auto">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const evColor = getAreaColor(ev.area) || ev.color || COLORS[2];
                          return (
                            <div
                              key={ev.id}
                              className="w-2 h-2 rounded-full flex-shrink-0 pointer-events-none"
                              style={{ backgroundColor: evColor }}
                              title={ev.title}
                            />
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="w-2 h-2 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0 pointer-events-none">
                            <span className="text-[8px] text-white leading-none">+</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

       {/* Focus Areas Data Block - Only show in Month view */}
       {currentView === 'Month' && (
       <div className="px-4 mt-6 pb-6">
         <div className="bg-white/20 backdrop-blur-lg rounded-xl border border-white/20 shadow-xl p-4">
           <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Data Split</h2>
           {(() => {
             // Calculate monthly planned hours for each focus area
             const daysInMonth = viewMonth ? new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate() : 30;
             
             // Calculate month start and end timestamps
             const monthStart = viewMonth ? new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1) : new Date();
             monthStart.setHours(0, 0, 0, 0);
             const monthEnd = viewMonth ? new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0) : new Date();
             monthEnd.setHours(23, 59, 59, 999);
             const monthStartMs = monthStart.getTime();
             const monthEndMs = monthEnd.getTime();
             
             // Helper function to normalize labels for comparison
             const normalizeLabel = (label) => (label || '').trim().toLowerCase();
             
             const focusAreaData = focusAreas.map((area, index) => {
               const dailyGoal = Number(area.goal || 0);
               const monthlyPlanned = dailyGoal * daysInMonth;
               
               // Calculate actual time logged from dashboard for this focus area in this month
               // Sum up logged time from all days in the month by loading each week's data
               let actualTimeLogged = 0;
               const monthStartDate = new Date(monthStartMs);
               const monthEndDate = new Date(monthEndMs);
               
               // Track which weeks we've already processed to avoid duplicate loading
               const processedWeeks = new Map();
               
               // Iterate through each day in the month
               for (let d = new Date(monthStartDate); d <= monthEndDate; d.setDate(d.getDate() + 1)) {
                 // Get the Monday of the week this day belongs to
                 const weekMonday = startOfWeekMon(d);
                 const weekKey = ymd(weekMonday);
                 
                 // Get or load week data
                 let weekArea = processedWeeks.get(weekKey);
                 if (!weekArea) {
                   // Load focus areas for this week
                   const storageKey = `focusCategories:week:${weekKey}`;
                   try {
                     const weekRaw = localStorage.getItem(storageKey);
                     if (weekRaw) {
                       const weekAreas = JSON.parse(weekRaw);
                       weekArea = weekAreas.find(a => normalizeLabel(a.label) === normalizeLabel(area.label));
                       if (weekArea) {
                         processedWeeks.set(weekKey, weekArea);
                       }
                     }
                   } catch {}
                 }
                 
                 // Add logged time for this day from the week's data
                 if (weekArea && weekArea.days && typeof weekArea.days === 'object') {
                   const dayAbbrev = DAYS[d.getDay()];
                   if (weekArea.days[dayAbbrev] !== undefined) {
                     actualTimeLogged += Number(weekArea.days[dayAbbrev]) || 0;
                   }
                 }
               }
               
               // Fallback: if no weekly data found, use current week's days or timeSpent
               if (actualTimeLogged === 0) {
                 if (area.days && typeof area.days === 'object') {
                   // Sum all days from current week as fallback
                   actualTimeLogged = Object.values(area.days).reduce((sum, val) => sum + (Number(val) || 0), 0);
                 } else if (area.timeSpent) {
                   actualTimeLogged = Number(area.timeSpent) || 0;
                 }
               }
               
               return {
                 label: area.label,
                 color: area.color || COLORS[index % COLORS.length],
                 dailyGoal,
                 monthlyPlanned,
                 actualTimeLogged
               };
             });
             
             // Calculate total actual time logged (for percentages)
             const totalActual = focusAreaData.reduce((sum, area) => sum + area.actualTimeLogged, 0);
             
             // Calculate percentages and build pie chart data based on actual time logged
             const pieData = focusAreaData
               .filter(area => area.actualTimeLogged > 0)
               .map((area) => ({
                 ...area,
                 percentage: totalActual > 0 ? (area.actualTimeLogged / totalActual) * 100 : 0
               }))
               .sort((a, b) => b.percentage - a.percentage);
             
             // Build pie chart path data
             let currentOffset = 0;
             const radius = 50;
             const circumference = 2 * Math.PI * radius;
             const centerX = 130;
             const centerY = 130;
             
          return (
               <div className="flex items-center justify-center gap-4 -mt-4 min-h-[260px] pl-4 pr-6">
                 {/* Pie Chart */}
                 <div className="flex-shrink-0 relative flex items-center justify-center" style={{ width: '260px', height: '260px' }}>
                   <svg width="260" height="260" viewBox="0 0 260 260">
                     {/* Base circle with black stroke for separation */}
                     <circle
                       cx={centerX}
                       cy={centerY}
                       r={radius}
                       fill="none"
                       stroke="#000000"
                       strokeWidth="22"
                       strokeOpacity="0.5"
                     />
                     {pieData.map((area, index) => {
                       const dashLength = (area.percentage / 100) * circumference;
                       const dashOffset = -currentOffset;
                       const startAngle = (currentOffset / circumference) * 360;
                       const endAngle = ((currentOffset + dashLength) / circumference) * 360;
                       const midAngle = (startAngle + endAngle) / 2;
                       
                       // Alternate label distance (closer/further) to prevent overlap
                       const isEven = index % 2 === 0;
                       const labelRadius = radius + (isEven ? 30 : 50);
                       
                       const labelAngleRad = (midAngle * Math.PI) / 180;
                       const labelX = centerX + Math.cos(labelAngleRad) * labelRadius;
                       const labelY = centerY + Math.sin(labelAngleRad) * labelRadius;
                       
                       currentOffset += dashLength;
                       
                       return (
                         <g key={area.label}>
                           <circle
                             cx={centerX}
                             cy={centerY}
                             r={radius}
                  fill="none"
                             stroke={area.color}
                             strokeWidth="20"
                             strokeDasharray={`${dashLength} ${circumference}`}
                             strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                           />
                           {/* Percentage label - outside the ring, always horizontal */}
                           <text
                             x={labelX}
                             y={labelY}
                             textAnchor="middle"
                             dominantBaseline="middle"
                             className="text-xs font-semibold"
                             style={{ fill: area.color }}
                           >
                             {area.percentage.toFixed(1)}%
                           </text>
                         </g>
                       );
                     })}
                   </svg>
                    </div>

                 {/* Focus Areas List */}
                 <div className="flex-1 flex items-center">
                   <div className="space-y-2 w-full">
                     {pieData.length > 0 ? (
                       pieData.map((area) => (
                         <div key={area.label} className="flex items-center gap-2">
                           <div 
                             className="w-3 h-3 rounded-full flex-shrink-0" 
                             style={{ backgroundColor: area.color }}
                           />
                           <span className="text-xs text-gray-900">{area.label}</span>
                           <span className="text-xs text-gray-600 ml-auto">
                             {Math.round(area.actualTimeLogged)}/{Math.round(area.monthlyPlanned)}
                           </span>
                    </div>
                       ))
                     ) : (
                       <div className="text-xs text-gray-600">No focus areas yet. Add them from the dashboard.</div>
                     )}
                  </div>
                 </div>
            </div>
          );
           })()}
      </div>
       </div>
       )}

      {/* Floating action button for adding events */}
      <button
        onClick={() => {
          setSelectedDate(new Date());
          setDraft({
            ...DEFAULT_DRAFT,
            ...nextHourDefaults(new Date()),
            dateYMD: ymd(new Date()),
          });
          setShowModal(true);
        }}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-slate-500/80 backdrop-blur-lg text-white flex items-center justify-center shadow-xl border border-white/20 z-50 hover:bg-slate-600/80 transition-all"
        aria-label="Add Event"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>


      {/* Bottom buttons: Dashboard | Calendar | Search */}
      <div className="fixed bottom-0 left-0 right-0 p-3 pb-7 z-[9999]">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
          <button
            onClick={() => router.push('/')}
            className="h-12 w-full rounded-2xl bg-white/40 backdrop-blur-xl text-gray-700 font-medium border-2 border-white/50 hover:bg-white/50 transition-all duration-200 shadow-2xl"
          >
            Dashboard
          </button>
          <button
            className="h-12 w-full rounded-2xl bg-white/40 backdrop-blur-xl text-gray-700 font-semibold border-2 border-white/50 shadow-2xl"
            disabled
            aria-current="page"
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


      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 pb-20">
          <div className={`bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border-2 border-white/60 p-4 w-[92%] max-w-md ${showCustomRepeat ? 'max-h-[90vh] flex flex-col' : ''}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-black">New Event</h3>
              <button className="text-sm text-black" onClick={() => { setShowModal(false); setDraft(DEFAULT_DRAFT); }}>Cancel</button>
            </div>

            <div className={showCustomRepeat ? 'flex-1 overflow-y-auto' : ''}>
              <label className="text-sm text-black">Title</label>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full border rounded px-3 py-2 mb-3 text-black" placeholder="e.g., Product Development" />

            <label className="text-sm text-black">Focus Area</label>
            <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className="w-full border rounded px-3 py-2 mb-3 text-black">
              <option value="">(none)</option>
              {focusAreas.map(a => (<option key={a.label} value={a.label}>{a.label}</option>))}
            </select>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full border" style={{ background: getAreaColor(draft.area) }} />
              <span className="text-xs text-black">Event color follows the Focus Area</span>
            </div>

            <label className="text-sm text-black">Date</label>
            <div className="relative mb-3">
              <div
                role="button"
                tabIndex={0}
                className="w-full border rounded px-3 py-2 text-left bg-white cursor-pointer text-black"
                onClick={() => setShowAddDatePicker(prev => !prev)}
                onKeyPress={e => { if (e.key === 'Enter' || e.key === ' ') setShowAddDatePicker(prev => !prev); }}
              >
                {formatLongYMD(draft.dateYMD)}
              </div>
              {showAddDatePicker && (
                <div className="absolute left-0 z-50">
                  <MiniMonthPicker
                    valueYMD={draft.dateYMD}
                    onChange={(val) => setDraft((prev) => ({ ...prev, dateYMD: val }))}
                    onClose={() => setShowAddDatePicker(false)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 items-start overflow-hidden">
              <div className="pr-1 min-w-0">
                <label className="text-sm text-black">Start</label>
                <input
                  type="time"
                  value={draft.start}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const newEnd = endFromStartAndDur(newStart, editDurMs);
                    setDraft((prev) => ({ ...prev, start: newStart, end: newEnd }));
                  }}
                  className="w-full min-w-0 border rounded px-3 py-2 sm:max-w-full max-w-[160px] text-black"
                  min="00:00"
                  max="23:59"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="pl-1 min-w-0">
                <label className="text-sm text-black">End</label>
                <input
                  type="time"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  className="w-full min-w-0 border rounded px-3 py-2 sm:max-w-full max-w-[160px] text-black"
                  min="00:00"
                  max="23:59"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <label className="text-sm text-black">Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="w-full border rounded px-3 py-2 mb-4 text-black"
              rows={3}
              placeholder="What will you accomplish during this timeframe?"
            />

            {/* Repeating Event Section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="isRepeating"
                  checked={isRepeating}
                  onChange={(e) => {
                    setIsRepeating(e.target.checked);
                    if (!e.target.checked) {
                      setRepeatType('none');
                      setShowCustomRepeat(false);
                    }
                  }}
                  className="w-4 h-4"
                />
                <label htmlFor="isRepeating" className="text-sm font-medium text-black">Do you want this to be a repeating event?</label>
              </div>

              {isRepeating && (
                <div className="ml-6 space-y-3">
                  <div>
                    <label className="text-sm text-black">Repeat</label>
                    <select
                      value={repeatType}
                      onChange={(e) => {
                        setRepeatType(e.target.value);
                        if (e.target.value === 'custom') {
                          setShowCustomRepeat(true);
                        } else {
                          setShowCustomRepeat(false);
                        }
                      }}
                      className="w-full border rounded px-3 py-2 mt-1 text-black"
                    >
                      <option value="none">None</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom...</option>
                    </select>
                  </div>

                  {showCustomRepeat && (
                    <div className="bg-gray-50 p-3 rounded border">
                      <div className="mb-3">
                        <label className="text-sm text-black">Frequency</label>
                        <select
                          value={customRepeat.frequency}
                          onChange={(e) => setCustomRepeat({ ...customRepeat, frequency: e.target.value })}
                          className="w-full border rounded px-3 py-2 mt-1 text-black"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>

                      <div className="mb-3">
                        <label className="text-sm text-black">Every</label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={customRepeat.interval}
                            onChange={(e) => setCustomRepeat({ ...customRepeat, interval: parseInt(e.target.value) || 1 })}
                            className="w-16 border rounded px-2 py-1 text-center text-black"
                          />
                          <span className="text-sm text-black">
                            {customRepeat.frequency === 'daily' ? 'day(s)' :
                             customRepeat.frequency === 'weekly' ? 'week(s)' :
                             customRepeat.frequency === 'monthly' ? 'month(s)' : 'year(s)'}
                          </span>
                        </div>
                      </div>

                      {customRepeat.frequency === 'weekly' && (
                        <div className="mb-3">
                          <label className="text-sm text-black">Repeat on:</label>
                          <div className="flex gap-1 mt-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  const newDays = customRepeat.daysOfWeek.includes(index)
                                    ? customRepeat.daysOfWeek.filter(d => d !== index)
                                    : [...customRepeat.daysOfWeek, index];
                                  setCustomRepeat({ ...customRepeat, daysOfWeek: newDays });
                                }}
                                className={`w-8 h-8 rounded text-xs font-medium ${
                                  customRepeat.daysOfWeek.includes(index)
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-black">
                        Events will repeat for up to 1 year from the start date.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>

            <div className={`flex justify-end gap-2 ${showCustomRepeat ? 'mt-4 flex-shrink-0' : ''}`}>
              <button className="px-4 py-2 bg-gray-200 rounded text-black" onClick={() => { setShowModal(false); setDraft(DEFAULT_DRAFT); }}>Close</button>
              <button className="px-4 py-2 bg-[#6B7280] text-white rounded" onClick={addEvent}>Add</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (() => {
        const currentEvent = allEvents.find(e => e.id === editingId);
        const isGoogleEvent = currentEvent?.source === 'google';
        
        return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 pb-20">
          <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border-2 border-white/60 p-4 w-[92%] max-w-md">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-black">{isGoogleEvent ? 'Edit Google Calendar Event' : 'Edit Event'}</h3>
              <button className="text-sm text-black" onClick={() => { setShowEditModal(false); setEditingId(null); }}>Cancel</button>
            </div>

            <label className="text-sm text-black">Title</label>
            <input 
              value={draft.title} 
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} 
              className="w-full border rounded px-3 py-2 mb-3 text-black"
              placeholder="e.g., Product Development"
            />

            <label className="text-sm text-black">Focus Area</label>
            <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className="w-full border rounded px-3 py-2 mb-3 text-black">
              <option value="">(none)</option>
              {focusAreas.map(a => (<option key={a.label} value={a.label}>{a.label}</option>))}
            </select>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full border" style={{ background: getAreaColor(draft.area || '') }} />
              <span className="text-xs text-black">Event color follows the Focus Area</span>
            </div>

            <label className="text-sm text-black">Date</label>
            <div className="relative mb-3">
              <div
                role="button"
                tabIndex={0}
                className="w-full border rounded px-3 py-2 text-left bg-white cursor-pointer text-black"
                onClick={() => setShowEditDatePicker(prev => !prev)}
                onKeyPress={e => { if (e.key === 'Enter' || e.key === ' ') setShowEditDatePicker(prev => !prev); }}
              >
                {formatLongYMD(draft.dateYMD)}
              </div>
              {showEditDatePicker && (
                <div className="absolute left-0 z-50">
                  <MiniMonthPicker
                    valueYMD={draft.dateYMD}
                    onChange={(val) => setDraft((prev) => ({ ...prev, dateYMD: val }))}
                    onClose={() => setShowEditDatePicker(false)}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 items-start overflow-hidden">
              <div className="pr-1 min-w-0">
                <label className="text-sm text-black">Start</label>
                <input
                  type="time"
                  value={draft.start}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const newEnd = endFromStartAndDur(newStart, editDurMs);
                    setDraft((prev) => ({ ...prev, start: newStart, end: newEnd }));
                  }}
                  className="w-full min-w-0 border rounded px-3 py-2 sm:max-w-full max-w-[160px] text-black"
                  min="00:00"
                  max="23:59"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="pl-1 min-w-0">
                <label className="text-sm text-black">End</label>
                <input
                  type="time"
                  value={draft.end}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    const dur = Math.max(0, hhmmToMsOfDay(newEnd) - hhmmToMsOfDay(draft.start));
                    if (dur > 0) setEditDurMs(dur);
                    setDraft((prev) => ({ ...prev, end: newEnd }));
                  }}
                  className="w-full min-w-0 border rounded px-3 py-2 sm:max-w-full max-w-[160px] text-black"
                  min="00:00"
                  max="23:59"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <label className="text-sm text-black">Notes</label>
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="w-full border rounded px-3 py-2 mb-4 text-black" rows={3} placeholder="What will you accomplish during this timeframe?" />

            {!isGoogleEvent && (
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  {(() => {
                    const currentEvent = events.find(e => e.id === editingId);
                    if (currentEvent && currentEvent.isRepeating) {
                      return (
                        <>
                          <button className="px-4 py-2 bg-red-500 text-white rounded text-xs leading-tight" onClick={() => deleteEvent(false)}>
                            Delete This<br />Event
                          </button>
                          <button className="px-4 py-2 bg-red-600 text-white rounded text-xs leading-tight" onClick={() => deleteEvent(true)}>
                            Delete Future<br />Events
                          </button>
                        </>
                      );
                    } else {
                      return (
                        <button className="px-4 py-2 bg-red-500 text-white rounded" onClick={deleteEvent}>Delete</button>
                      );
                    }
                  })()}
                  <button className="px-4 py-2 bg-gray-200 rounded text-black" onClick={duplicateEvent}>Duplicate</button>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-gray-200 rounded text-black" onClick={() => { setShowEditModal(false); setEditingId(null); }}>Cancel</button>
                  <button className="px-4 py-2 bg-[#6B7280] text-white rounded" onClick={updateEvent}>Save</button>
                </div>
              </div>
            )}
            {isGoogleEvent && (
              <div className="flex justify-end gap-2">
                <button className="px-4 py-2 bg-gray-200 rounded text-black" onClick={() => { setShowEditModal(false); setEditingId(null); }}>Cancel</button>
                <button className="px-4 py-2 bg-[#6B7280] text-white rounded" onClick={updateEvent}>Save</button>
              </div>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

// Main calendar page with Suspense
export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="text-[#374151]">Loading calendar...</div>
      </div>
    }>
      <CalendarContent />
    </Suspense>
  );
}