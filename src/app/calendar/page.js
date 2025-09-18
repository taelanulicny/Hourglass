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
  for(let i=0;i<42;i++){ const d = new Date(start); d.setDate(start.getDate()+i); days.push(d); }
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
        <div className="font-semibold text-[#4E4034]">{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
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
              className={`h-9 rounded-md text-sm ${inMonth? 'text-[#4E4034]':'text-gray-400'} ${isSel? 'bg-[#8CA4AF] text-white' : 'hover:bg-gray-100'} ${isToday && !isSel ? 'ring-1 ring-[#8CA4AF]' : ''}`}
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

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Selected day (daily view)
  const [selectedDate, setSelectedDate] = useState(null); // Start with null to prevent hydration mismatch
  useEffect(() => {
    // Set initial date only on client
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  }, []);

  // Focus areas from Dashboard/localStorage (prefer weekly snapshot based on selectedDate)
  const [focusAreas, setFocusAreas] = useState([]);
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
    stripRef.current.scrollTo({ left, top: 0, behavior: "auto" });
  }, [selectedDate, stripDays]);

  // Center focus rings when focus areas change
  useEffect(() => {
    if (focusRingsRef.current && focusAreas.length > 0) {
      // Calculate the center position to center the rings
      const containerWidth = focusRingsRef.current.clientWidth;
      const contentWidth = focusRingsRef.current.scrollWidth;
      const scrollLeft = Math.max(0, (contentWidth - containerWidth) / 2);
      
      // Center the rings
      focusRingsRef.current.scrollTo({ left: scrollLeft, top: 0, behavior: "auto" });
      
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
    setEvents(next); // persistence handled by effect (writes to primary + legacy)
    setSelectedDate(new Date(base));
    setShowModal(false);
    setDraft(DEFAULT_DRAFT);
  };

  const openEdit = (ev) => {
    setEditingId(ev.id);
    setEditDurMs(Math.max(0, (ev.end || 0) - (ev.start || 0)) || 60 * 60 * 1000);
    setDraft({
      title: ev.title || '',
      area: ev.area || '',
      dateYMD: ymd(new Date(ev.start)),
      start: msToHHMM(ev.start),
      end: msToHHMM(ev.end),
      notes: ev.notes || '',
    });
    setShowEditModal(true);
  };

  const updateEvent = () => {
    if (!editingId) return;
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

  const deleteEvent = () => {
    if (!editingId) return;
    const next = events.filter((ev) => ev.id !== editingId);
    setEvents(next);
    setShowEditModal(false);
    setEditingId(null);
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
  const dragRef = useRef({
    startY: 0,
    origStart: 0,
    origEnd: 0,
    duration: 0,
    lastStartMs: null,
    moved: false,
  });
  const dragDelayTimerRef = useRef(null); // timer for drag delay

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

  // When viewing today, scroll the window so the now line is comfortably in view
  useEffect(() => {
    if (nowTopPx == null) return;
    if (!dayColRef.current) return;
    // Where the day column starts relative to the page
    const rect = dayColRef.current.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;
    // Aim to put the red line about 120px below the top of the viewport
    const target = Math.max(0, pageTop + nowTopPx - 120);
    window.scrollTo({ top: target, behavior: 'smooth' });
  }, [nowTopPx, selectedDate]);

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

  // Cleanup drag delay timer on unmount
  useEffect(() => {
    return () => {
      if (dragDelayTimerRef.current) {
        clearTimeout(dragDelayTimerRef.current);
      }
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
    
    const onTouchStart = (e) => {
      const eventId = e.currentTarget.getAttribute('data-event-id');
      if (!eventId) return;
      
      const ev = events.find(x => x.id === eventId);
      if (!ev) return;
      
      // Clear any existing drag delay timer
      if (dragDelayTimerRef.current) {
        clearTimeout(dragDelayTimerRef.current);
      }
      
      // Start drag delay - user must hold for 500ms before dragging starts
      setDragDelayActive(true);
      setDragDelayEventId(ev.id);
      
      const t = e.touches[0];
      dragDelayTimerRef.current = setTimeout(() => {
        // After 500ms, allow dragging to begin
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

    const onTouchEnd = (e) => {
      // Cancel drag delay if user releases before 500ms
      if (dragDelayActive && dragDelayEventId) {
        if (dragDelayTimerRef.current) {
          clearTimeout(dragDelayTimerRef.current);
        }
        setDragDelayActive(false);
        setDragDelayEventId(null);
      }
    };

    const onTouchCancel = (e) => {
      // Cancel drag delay if touch is cancelled
      if (dragDelayActive && dragDelayEventId) {
        if (dragDelayTimerRef.current) {
          clearTimeout(dragDelayTimerRef.current);
        }
        setDragDelayActive(false);
        setDragDelayEventId(null);
      }
    };

    eventElements.forEach(el => {
      el.addEventListener('touchstart', onTouchStart, { passive: false });
      el.addEventListener('touchend', onTouchEnd, { passive: false });
      el.addEventListener('touchcancel', onTouchCancel, { passive: false });
    });

    return () => {
      eventElements.forEach(el => {
        el.removeEventListener('touchstart', onTouchStart, { passive: false });
        el.removeEventListener('touchend', onTouchEnd, { passive: false });
        el.removeEventListener('touchcancel', onTouchCancel, { passive: false });
      });
    };
  }, [isClient, events, dayStartMs, pxPerHour, dragDelayActive, dragDelayEventId]);

  const eventsForSelected = useMemo(() => {
    // include events that overlap the selected day window [dayStartMs, dayEndMs)
    if (!dayStartMs || !dayEndMs) return [];
    return events.filter((ev) => ev.end > dayStartMs && ev.start < dayEndMs);
  }, [events, dayStartMs, dayEndMs]);


  // --- Get selected day abbrev for focus area rings ---
  const selectedDayAbbrev = selectedDate ? DAYS[selectedDate.getDay()] : null;

  // Show loading state if no date is selected yet
  if (!selectedDate) {
    return (
      <div className="min-h-screen bg-white text-[#4E4034] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Loading Calendar...</div>
          <div className="text-sm text-gray-500">Please wait while we prepare your calendar view.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#4E4034] pb-24">
      {/* Fixed header and day selector - LOCKED */}
      <div className="fixed top-0 left-0 right-0 bg-[#F7F6F3] z-50">
        {/* Top bar */}
        <header className="px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            className="text-lg px-2" 
            aria-label="Previous Day" 
            onClick={() => selectedDate && setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1))}
            disabled={!selectedDate}
          >
            ‹
          </button>
          <div className="font-semibold">{headerLabel}</div>
          <button 
            className="text-lg px-2" 
            aria-label="Next Day" 
            onClick={() => selectedDate && setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1))}
            disabled={!selectedDate}
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/settings')}
            title="Settings"
            aria-label="Settings"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors duration-200"
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

        {/* Horizontal day strip (±14 days from today) - LOCKED */}
        <div ref={stripRef} className="flex gap-2 overflow-x-hidden px-3 pt-2 pb-1 -mt-1">
        {stripDays.map((d, i) => {
          const isSel = selectedDate && d.toDateString() === selectedDate.toDateString();
          const isToday = d.toDateString() === today.toDateString();
          return (
            <button
              ref={(el) => (stripBtnRefs.current[i] = el)}
              key={i}
              onClick={() => setSelectedDate(new Date(d))}
              className={`relative flex flex-col items-center w-14 flex-shrink-0 py-2 rounded-md border outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 ${isSel ? "bg-[#8CA4AF] text-white border-transparent" : "text-[#4E4034] bg-transparent border-transparent"}`}
              title={d.toDateString()}
            >
              <div className="text-[11px]">{DAYS[d.getDay()]}</div>
              <div className="text-sm font-semibold">{d.getDate()}</div>
              {/* Today dot (does not affect layout height) */}
              <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#8CA4AF] ${isToday && !isSel ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          );
        })}
        </div>
      </div>

      {/* Scrollable calendar area */}
      <div className="flex-1 overflow-y-auto pt-40">
        {/* Day view grid (hours gutter + single day column) */}
        <div ref={gridRootRef} className="relative px-2">
        <div className="grid grid-cols-[56px_minmax(0,1fr)]">
          {/* Hours gutter */}
          <div className="flex flex-col items-end pr-2">
            {isClient && HOURS.map((h) => (
              <div
                key={h}
                className="text-xs text-gray-500 flex items-start"
                style={{ height: `${pxPerHour}px` }}
              >
                <div className="-translate-y-1">{formatHour(h)}</div>
              </div>
            ))}
          </div>

          {/* One day column */}
          <div
            ref={dayColRef}
            className="relative border-l border-gray-200 overflow-visible"
            style={{ touchAction: draggingId ? 'none' : undefined, userSelect: draggingId ? 'none' : undefined }}
          >
            {HOURS.map((h) => (
              <div
                key={h}
                className="h-16 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => openForSlot(h)}
              />
            ))}

            {isClient && nowTopPx != null && (
              <div
                className="pointer-events-none absolute inset-x-0 z-20"
                style={{ top: Math.max(0, Math.min(nowTopPx, (24 * pxPerHour) - 1)) + 'px' }}
              >
                {/* Hourglass marker at the left edge */}
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
                {/* Time label at the far right, above the line */}
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

            {isClient && eventsForSelected.map(ev => {
              const visibleStart = Math.max(ev.start, dayStartMs);
              const visibleEnd   = Math.min(ev.end,   dayEndMs);
              const vs = new Date(visibleStart);
              const topPx = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
              const heightPx = ((visibleEnd - visibleStart) / (1000 * 60 * 60)) * pxPerHour;
              const renderColor = getAreaColor(ev.area) || ev.color || COLORS[2];
              return (
                <div
                  key={ev.id}
                  data-event-id={ev.id}
                  className={`absolute left-1 right-1 rounded-md shadow calendar-event ${draggingId === ev.id ? 'cursor-grabbing' : dragDelayActive && dragDelayEventId === ev.id ? 'cursor-wait' : 'cursor-grab'}`}
                  style={{
                    top: (draggingId === ev.id && dragGhostTop != null ? dragGhostTop : Math.max(0, topPx)) + 'px',
                    height: Math.max(24, heightPx) + 'px',
                    background: toRGBA(renderColor, dragDelayActive && dragDelayEventId === ev.id ? 0.2 : 0.4),
                    borderLeft: `3px solid ${renderColor}`,
                    willChange: draggingId === ev.id ? 'top' : undefined,
                    opacity: dragDelayActive && dragDelayEventId === ev.id ? 0.7 : 1,
                  }}
                  title={ev.title}
                  onMouseDown={(e) => {
                    // Only prevent default if the event is cancelable
                    if (e.cancelable) e.preventDefault();
                    
                    // Clear any existing drag delay timer
                    if (dragDelayTimerRef.current) {
                      clearTimeout(dragDelayTimerRef.current);
                    }
                    
                    // Start drag delay - user must hold for 500ms before dragging starts
                    setDragDelayActive(true);
                    setDragDelayEventId(ev.id);
                    
                    dragDelayTimerRef.current = setTimeout(() => {
                      // After 500ms, allow dragging to begin
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
                      // seed ghost top from current position
                      const vs = new Date(Math.max(ev.start, dayStartMs));
                      const topPxSeed = (vs.getHours() + vs.getMinutes() / 60) * pxPerHour;
                      setDragGhostTop(Math.max(0, topPxSeed));
                    }, 500);
                  }}
                  onMouseUp={(e) => {
                    // Cancel drag delay if user releases before 500ms
                    if (dragDelayActive && dragDelayEventId === ev.id) {
                      if (dragDelayTimerRef.current) {
                        clearTimeout(dragDelayTimerRef.current);
                      }
                      setDragDelayActive(false);
                      setDragDelayEventId(null);
                    }
                  }}
                  onMouseLeave={(e) => {
                    // Cancel drag delay if mouse leaves the event before 500ms
                    if (dragDelayActive && dragDelayEventId === ev.id) {
                      if (dragDelayTimerRef.current) {
                        clearTimeout(dragDelayTimerRef.current);
                      }
                      setDragDelayActive(false);
                      setDragDelayEventId(null);
                    }
                  }}
                  onClick={(e) => { if (dragRef.current.moved) { if (e.cancelable) e.preventDefault(); e.stopPropagation(); } else { openEdit(ev); } }}
                >
                  <div className="text-[11px] px-2 py-1 leading-tight">
                    <div className="font-semibold truncate">{ev.title}</div>
                    {ev.area && <div className="text-[10px] opacity-70 truncate">{ev.area}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => { setDraft({ ...DEFAULT_DRAFT, ...nextHourDefaults(new Date()), dateYMD: ymd(selectedDate) }); setShowModal(true); }}
        className="fixed bottom-20 right-4 bg-[#8CA4AF] text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl shadow-md"
        aria-label="Add Event"
      >
        +
      </button>

      {/* Bottom buttons: Dashboard | Calendar | Discover */}
      <div className="fixed bottom-0 left-0 right-0 p-3 pb-7 z-50">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
          <button
            onClick={() => router.push('/')}
            className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm"
          >
            Dashboard
          </button>
          <button
            className="h-12 w-full rounded-2xl bg-gray-900 text-white font-semibold shadow-lg"
            disabled
            aria-current="page"
          >
            Calendar
          </button>
          <button
            onClick={() => router.push('/connect')}
            className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm"
          >
            Discover
          </button>
        </div>
      </div>

      {/* --- Focus Area Rings (Categories) --- */}
      <div className="relative z-10">
        {/* Subtle scroll indicators */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
        
        <div ref={focusRingsRef} className="flex flex-row gap-2 px-4 pointer-events-none select-none mt-8 mb-6 overflow-x-auto scroll-smooth scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300">
          <div className="flex flex-row gap-2 min-w-max px-2 justify-center" style={{ margin: '0 auto' }}>
        {[...focusAreas].reverse().map(({ label, timeSpent, goal, days, color }, index) => {
          // Day-aware calculations using TODAY's logged time from `days`
          const todayAbbrev = DAYS[new Date().getDay()];
          const goalNum = Number(goal || 0);
          const daySpent = Number((days && days[todayAbbrev]) || 0);
          
          // Calculate progress percentages
          const isOverGoal = daySpent > goalNum;
          const percentRaw = goalNum > 0 ? (daySpent / goalNum) * 100 : 0;
          const percent = Math.min(percentRaw, 100).toFixed(0);
          
          // For over-amount, calculate how much over as a percentage
          const overAmountRaw = goalNum > 0 ? ((daySpent - goalNum) / goalNum) * 100 : 0;
          const overAmount = isOverGoal ? Math.min(overAmountRaw, 100).toFixed(0) : 0;

          const category = { label, timeSpent, goal, days, color };
          const areaColor = category?.color || "#8CA4AF";
          
          // Center label shows how much LEFT/OVER for today (day-aware)
          const centerAmount = Math.abs((goalNum || 0) - (daySpent || 0));
          return (
            <div 
              key={label} 
              className="flex flex-col items-center pointer-events-auto cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                // Navigate to main page with focus area selected and scroll to top
                router.push(`/?focus=${encodeURIComponent(label)}&scroll=top`);
              }}
              title={`Click to view ${label} details`}
            >
              {/* SVG ring progress */}
              <svg width={54} height={54} viewBox="0 0 36 36" className="block mb-1">
                {/* Track */}
                <path
                  className="text-gray-300"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845
                     a 15.9155 15.9155 0 0 1 0 31.831
                     a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Progress ring (up to goal) */}
                <path
                  stroke={areaColor}
                  strokeOpacity={isOverGoal ? "0.3" : "0.55"}
                  strokeWidth="3"
                  strokeDasharray={`${percent}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 18 18)"
                  d="M18 2.0845
                     a 15.9155 15.9155 0 0 1 0 31.831
                     a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Over ring (scaled inside) - more prominent when over goal */}
                {isOverGoal && overAmount > 0 && (
                  <g transform="scale(0.88) translate(2.2 2.2)">
                    <path
                      stroke={areaColor}
                      strokeOpacity="0.8"
                      strokeWidth="2.5"
                      strokeDasharray={`${overAmount}, 100`}
                      strokeLinecap="round"
                      fill="none"
                      transform="rotate(-90 18 18)"
                      d="M18 2.0845
                         a 15.9155 15.9155 0 0 1 0 31.831
                         a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </g>
                )}
                {/* Center label */}
                <foreignObject x="8" y="8" width="20" height="20">
                  <div xmlns="http://www.w3.org/1999/xhtml" className="w-full h-full flex flex-col items-center justify-center leading-tight">
                    <div className={`text-[7px] font-bold ${isOverGoal ? 'text-red-600' : 'text-[#4E4034]'}`}>
                      {formatCenterAmount(centerAmount)}
                    </div>
                    <div className={`text-[5px] uppercase -mt-0.5 ${isOverGoal ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                      {isOverGoal ? 'OVER' : 'LEFT'}
                    </div>
                  </div>
                </foreignObject>
              </svg>
              <div className="text-xs font-medium text-[#4E4034] truncate max-w-[60px]">{label}</div>
            </div>
          );
        })}
      </div>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-[92%] max-w-md">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">New Event</h3>
              <button className="text-sm" onClick={() => { setShowModal(false); setDraft(DEFAULT_DRAFT); }}>Cancel</button>
            </div>

            <label className="text-sm">Title</label>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full border rounded px-3 py-2 mb-3" placeholder="e.g., Product Development" />

            <label className="text-sm">Focus Area</label>
            <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className="w-full border rounded px-3 py-2 mb-3">
              <option value="">(none)</option>
              {focusAreas.map(a => (<option key={a.label} value={a.label}>{a.label}</option>))}
            </select>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full border" style={{ background: getAreaColor(draft.area) }} />
              <span className="text-xs text-gray-600">Event color follows the Focus Area</span>
            </div>

            <label className="text-sm">Date</label>
            <div className="relative mb-3">
              <div
                role="button"
                tabIndex={0}
                className="w-full border rounded px-3 py-2 text-left bg-white cursor-pointer"
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
                <label className="text-sm">Start</label>
                <input
                  type="time"
                  value={draft.start}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const newEnd = endFromStartAndDur(newStart, editDurMs);
                    setDraft((prev) => ({ ...prev, start: newStart, end: newEnd }));
                  }}
                  className="w-full min-w-0 border rounded px-3 py-2 sm:max-w-full max-w-[160px]"
                  min="00:00"
                  max="23:59"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="pl-1 min-w-0">
                <label className="text-sm">End</label>
                <input
                  type="time"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  className="w-full min-w-0 border rounded px-3 py-2 sm:max-w-full max-w-[160px]"
                  min="00:00"
                  max="23:59"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <label className="text-sm">Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="w-full border rounded px-3 py-2 mb-4"
              rows={3}
              placeholder="What will you accomplish during this timeframe?"
            />

            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => { setShowModal(false); setDraft(DEFAULT_DRAFT); }}>Close</button>
              <button className="px-4 py-2 bg-[#BCA88F] text-white rounded" onClick={addEvent}>Add</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-[92%] max-w-md">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Edit Event</h3>
              <button className="text-sm" onClick={() => { setShowEditModal(false); setEditingId(null); }}>Close</button>
            </div>

            <label className="text-sm">Title</label>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full border rounded px-3 py-2 mb-3" />

            <label className="text-sm">Focus Area</label>
            <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className="w-full border rounded px-3 py-2 mb-3">
              <option value="">(none)</option>
              {focusAreas.map(a => (<option key={a.label} value={a.label}>{a.label}</option>))}
            </select>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full border" style={{ background: getAreaColor(draft.area || '') }} />
              <span className="text-xs text-gray-600">Color auto-updates from Focus Area</span>
            </div>

            <label className="text-sm">Date</label>
            <div className="relative mb-3">
              <div
                role="button"
                tabIndex={0}
                className="w-full border rounded px-3 py-2 text-left bg-white cursor-pointer"
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
                <label className="text-sm">Start</label>
                <input
                  type="time"
                  value={draft.start}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const newEnd = endFromStartAndDur(newStart, editDurMs);
                    setDraft((prev) => ({ ...prev, start: newStart, end: newEnd }));
                  }}
                  className="w-full min-w-0 border rounded px-3 py-2 sm:max-w-full max-w-[160px]"
                  min="00:00"
                  max="23:59"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="pl-1 min-w-0">
                <label className="text-sm">End</label>
                <input
                  type="time"
                  value={draft.end}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    const dur = Math.max(0, hhmmToMsOfDay(newEnd) - hhmmToMsOfDay(draft.start));
                    if (dur > 0) setEditDurMs(dur);
                    setDraft((prev) => ({ ...prev, end: newEnd }));
                  }}
                  className="w-full min-w-0 border rounded px-3 py-2 sm:max-w-full max-w-[160px]"
                  min="00:00"
                  max="23:59"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <label className="text-sm">Notes</label>
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="w-full border rounded px-3 py-2 mb-4" rows={3} />

            <div className="flex justify-between items-center">
              <button className="px-4 py-2 bg-red-500 text-white rounded" onClick={deleteEvent}>Delete</button>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => { setShowEditModal(false); setEditingId(null); }}>Cancel</button>
                <button className="px-4 py-2 bg-[#BCA88F] text-white rounded" onClick={updateEvent}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main calendar page with Suspense
export default function CalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="text-[#4E4034]">Loading calendar...</div>
      </div>
    }>
      <CalendarContent />
    </Suspense>
  );
}