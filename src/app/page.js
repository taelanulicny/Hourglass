"use client";

import './globals.css';
import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AiHelper from '../components/AiHelper';
// Compute statistics for AI helper for a focus area and selected date
function computeAiStats(focusArea, selectedDateYMD) {
  const d = new Date(selectedDateYMD);
  const daysAbbrev = ["Su","M","Tu","W","Th","F","Sa"];
  const dayKey = daysAbbrev[d.getDay()];

  const goal = Number(focusArea?.goal || 0);
  const daySpent = Number(focusArea?.days?.[dayKey] || 0);
  const leftToday = Math.max(0, goal - daySpent);

  const totalWeek = Object.values(focusArea?.days || {}).reduce((s,v)=> s + (Number(v)||0), 0);

  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  start.setHours(0,0,0,0);
  const daysElapsed = Math.max(1, Math.floor((d - start)/86400000) + 1);
  const dailyAverage = totalWeek / daysElapsed;

  const weeklyGoal = goal * 7;

  return { todaySpent: daySpent, leftToday, totalWeek, dailyAverage, weeklyGoal };
}

// --- small format helpers ---
function fmt1(n){
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return v.toFixed(1).replace(/\.0$/, '');
}
function hrUnit(n){
  return Number(n) === 1 ? 'hr' : 'hrs';
}

// Safe JSON parse with fallback
function safeJsonParse(jsonString, fallback = []) {
  try {
    if (!jsonString) return fallback;
    const parsed = JSON.parse(jsonString);
    return parsed || fallback;
  } catch (error) {
    console.warn('Failed to parse JSON:', jsonString, error);
    return fallback;
  }
}

// Show minutes if under 1 hour, else hours with one decimal
function formatCenterAmount(hoursFloat){
  const h = Math.max(0, Number(hoursFloat) || 0);
  if (h < 1) {
    const mins = Math.round(h * 60);
    const unit = mins === 1 ? 'min' : 'mins';
    return `${mins} ${unit}`;
  }
  return `${fmt1(h)}${hrUnit(h)}`;
}

// Format decimal hours like 3.75 as "3hrs 45mins"
function formatHoursAndMinutes(decimalHours){
  const total = Math.max(0, Number(decimalHours) || 0);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  if (h > 0 && m > 0) return `${h}hrs ${m}mins`;
  if (h > 0) return `${h}hrs`;
  return `${m}mins`;
}

// Normalize labels for matching (case/space/hyphen insensitive)
function normalizeLabel(s){
  return (s || "").toString().trim().toLowerCase().replace(/[-_]+/g, " ");
}

// Convert a hex color like "#7D7ACF" to an rgba string with given alpha
function hexToRGBA(hex, alpha = 0.55) {
  if (!hex) return `rgba(140, 164, 175, ${alpha})`; // fallback brand color
  let h = hex.trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- extra helpers pulled from old slug page ---
function hToSeconds(h) {
  return Math.max(0, Math.round(Number(h || 0) * 3600));
}
function secondsToHMMSS(s) {
  const clamped = Math.max(0, Math.floor(s));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const ss = clamped % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}

// --- Future Planning Timeline helpers ---
function buildLocalDate({ y, m, d, hh = 0, mm = 0 }) {
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0, 0);
}

function parseEventDateLocal(valueYMD, valueHM, fallbackISO) {
  // Prefer explicit YMD/HM fields to avoid UTC shifts.
  if (valueYMD) {
    const [y, m, d] = valueYMD.split('-');
    if (valueHM) {
      const [hh, mm] = valueHM.split(':');
      return buildLocalDate({ y, m, d, hh, mm });
    }
    return buildLocalDate({ y, m, d });
  }
  // If we only have a single string, parse defensively:
  if (fallbackISO) {
    // Case 1: full ISO with timezone (e.g., ...Z or +hh:mm) → let Date parse it.
    if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(fallbackISO)) {
      const d = new Date(fallbackISO);
      return isNaN(d) ? null : d;
    }
    // Case 2: "YYYY-MM-DDTHH:mm" (no tz) → treat as LOCAL time
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fallbackISO)) {
      const [ymd, hm] = fallbackISO.split('T');
      const [y, m, d] = ymd.split('-');
      const [hh, mm] = hm.split(':');
      return buildLocalDate({ y, m, d, hh, mm });
    }
    // Case 3: "YYYY-MM-DD" (date only) → LOCAL midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(fallbackISO)) {
      const [y, m, d] = fallbackISO.split('-');
      return buildLocalDate({ y, m, d });
    }
    // Fallback best effort
    const d = new Date(fallbackISO);
    return isNaN(d) ? null : d;
  }
  return null;
}

function getEventStart(ev) {
  return (
    parseEventDateLocal(ev.startYMD, ev.startHM, ev.start) ||
    parseEventDateLocal(ev.dateYMD, ev.timeHM, ev.startAt)
  );
}

function getEventEnd(ev) {
  return (
    parseEventDateLocal(ev.endYMD, ev.endHM, ev.end) ||
    parseEventDateLocal(null, null, ev.endAt)
  );
}

// === Date helpers for focus area navigation ===
function ymdLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseYMDLocal(ymd) {
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function compareYMD(a, b) {
  // returns -1, 0, 1
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// YMD (YYYY-MM-DD) helper for stable date-only state
function ymd(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- Friends (MVP) helpers ----
// friend object shape (stored in localStorage under "friends:v1"):
// { id, name, avatar?, categories: [{ label, goal, days: {M,Tu,W,Th,F,Sa,Su} }] }
function loadFriends() {
  try {
    const raw = localStorage.getItem("friends:v1");
    const arr = raw ? safeJsonParse(raw, []) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveFriends(arr) {
  try { localStorage.setItem("friends:v1", JSON.stringify(arr || [])); } catch {}
}

// Compute a friend's weekly totals and percent toward weekly goal based on their categories
function friendWeeklyStats(friend, mondayDateLike) {
  const monday = new Date(mondayDateLike);
  monday.setHours(0,0,0,0);
  // Sum all categories' logged hours across the 7 days
  const weekDays = ["M","Tu","W","Th","F","Sa","Su"];
  const totalLogged = (friend?.categories || []).reduce((sum, c) => {
    const sub = weekDays.reduce((s, d) => s + (Number(c?.days?.[d] || 0)), 0);
    return sum + sub;
  }, 0);
  // Weekly goal is sum of (daily goal * 7) across categories
  const weeklyGoal = (friend?.categories || []).reduce((sum, c) => sum + (Number(c?.goal || 0) * 7), 0);
  const pct = weeklyGoal > 0 ? Math.min(100, (totalLogged / weeklyGoal) * 100) : 0;
  return { totalLogged, weeklyGoal, pct: Math.round(pct) };
}

// Component that uses search params (needs Suspense)
function HomeContent() {
  const router = useRouter();



  // Simple AI helper - no complex action parsing, just chat


  const [offset, setOffset] = useState(0);
  const [isNextWeek, setIsNextWeek] = useState(false);
  const [selectedFocusArea, setSelectedFocusArea] = useState(null);
  const MAX_WEEKS_BACK = 52;
  const MIN_OFFSET = -MAX_WEEKS_BACK * 7; // in days
  const MAX_FUTURE_DAYS = 7; // allow exactly one week forward
  const rawDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date;
  }, [offset]);
  // Compute Monday-Sunday range for the week of rawDate
  const startOfWeek = useMemo(() => {
    const start = new Date(rawDate);
    start.setDate(rawDate.getDate() - ((rawDate.getDay() + 6) % 7)); // Monday
    start.setHours(0, 0, 0, 0); // normalize to midnight for safe comparisons
    return start;
  }, [rawDate]);

  const endOfWeek = useMemo(() => {
    const end = new Date(startOfWeek);
    end.setDate(startOfWeek.getDate() + 6); // Sunday
    end.setHours(23, 59, 59, 999); // end of day for safe comparisons
    return end;
  }, [startOfWeek]);
  const formatDate = (date) =>
    date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const today = `${formatDate(startOfWeek)} – ${formatDate(endOfWeek)}`;

  // --- Week snapshot helpers (Monday–Sunday) ---
  const weekKey = (d) => {
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
    monday.setHours(0, 0, 0, 0);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  };
  const STORAGE_PREFIX = "focusCategories:week:";
  const [currentWeekKey] = useState(() => weekKey(new Date()));
  const [viewWeekKey, setViewWeekKey] = useState(() => weekKey(rawDate));
  
  // Check for new week on app start and clear old data if needed
  useEffect(() => {
    const lastWeekKey = localStorage.getItem("lastProcessedWeekKey");
    if (lastWeekKey && lastWeekKey !== currentWeekKey) {
      // New week detected - clear the live data to start fresh
      console.log("New week detected on app start, clearing old focus categories data");
      localStorage.removeItem("focusCategories");
      
      // Get the focus area definitions (without days data) from the previous week's snapshot
      const previousWeekKey = lastWeekKey;
      const previousWeekData = localStorage.getItem(STORAGE_PREFIX + previousWeekKey);
      let freshFocusAreas = [];
      
      if (previousWeekData) {
        try {
          const parsed = JSON.parse(previousWeekData);
          // Create fresh focus areas with empty days objects
          freshFocusAreas = parsed.map(area => ({
            ...area,
            days: {}, // Reset days to empty object
            timeSpent: 0 // Reset time spent
          }));
        } catch (e) {
          console.warn("Failed to parse previous week data:", e);
        }
      }
      
      // Save fresh focus areas for the new week
      if (freshFocusAreas.length > 0) {
        localStorage.setItem("focusCategories", JSON.stringify(freshFocusAreas));
        localStorage.setItem(STORAGE_PREFIX + currentWeekKey, JSON.stringify(freshFocusAreas));
      }
      
      localStorage.setItem("lastProcessedWeekKey", currentWeekKey);
    } else if (!lastWeekKey) {
      // First time running - set the current week as processed
      localStorage.setItem("lastProcessedWeekKey", currentWeekKey);
    }
  }, [currentWeekKey]);
  const nextWeekKey = weekKey(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const isCurrentWeek = viewWeekKey === currentWeekKey;
  // Sync isNextWeek state with viewWeekKey
  useEffect(() => {
    setIsNextWeek(viewWeekKey === nextWeekKey);
  }, [viewWeekKey, nextWeekKey]);
  // retain isNextWeek as a boolean state
  // Allow CURRENT week and exactly NEXT week to be editable
  const canEditWeek = isCurrentWeek || isNextWeek;

  useEffect(() => {
    console.log('DEBUG: offset useEffect triggered - offset:', offset, 'rawDate:', rawDate, 'weekKey(rawDate):', weekKey(rawDate));
    setViewWeekKey(weekKey(rawDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const [categories, setCategories] = useState([]);
  
  // Handle URL parameters for focus area selection and scroll to top
  const searchParams = useSearchParams();
  
  // Sleep and misc hours state for calculating available planning hours
  const [sleepHours, setSleepHours] = useState(8); // Default to 8 hours sleep
  const [miscHours, setMiscHours] = useState(0); // Default to 0 hours misc
  
  // Calculate available hours for planning (24 - sleep hours - misc hours)
  const availableHours = 24 - sleepHours - miscHours;
  
  // Load sleep and misc hours from local storage on component mount
  useEffect(() => {
    const savedSleepHours = localStorage.getItem('sleepHours');
    const savedMiscHours = localStorage.getItem('miscHours');
    if (savedSleepHours) {
      setSleepHours(Number(savedSleepHours));
    }
    if (savedMiscHours) {
      setMiscHours(Number(savedMiscHours));
    }
  }, []);
  
  // Listen for sleep and misc hours changes from settings page
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'sleepHours') {
        setSleepHours(Number(e.newValue || 8));
      }
      if (e.key === 'miscHours') {
        setMiscHours(Number(e.newValue || 0));
      }
    };
    
    const handleSleepHoursChanged = (e) => {
      setSleepHours(Number(e.detail || 8));
    };
    
    const handleMiscHoursChanged = (e) => {
      setMiscHours(Number(e.detail || 0));
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sleepHoursChanged', handleSleepHoursChanged);
    window.addEventListener('miscHoursChanged', handleMiscHoursChanged);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sleepHoursChanged', handleSleepHoursChanged);
      window.removeEventListener('miscHoursChanged', handleMiscHoursChanged);
    };
  }, []);

  // Mirror current-week snapshot to legacy live key so slug page can read it
  function saveWeekAndLive(updated) {
    try {
      // Always save the viewed week snapshot
      localStorage.setItem(STORAGE_PREFIX + viewWeekKey, JSON.stringify(updated));
      // If we're on the current week, also mirror to the legacy "focusCategories"
      if (viewWeekKey === currentWeekKey) {
        localStorage.setItem("focusCategories", JSON.stringify(updated));
        try { window.dispatchEvent(new Event("focusCategoriesUpdated")); } catch (_) {}
      }
    } catch (_) { /* ignore */ }
  }
  useEffect(() => {
    // Load categories snapshot for the viewed week.
    // For the CURRENT week, prefer the live "focusCategories" so slug/calendar writes are reflected immediately.
    const key = STORAGE_PREFIX + viewWeekKey;
    let data = [];
    try {
      if (viewWeekKey === currentWeekKey) {
        // Check if we need to clear old data for a new week
        const lastWeekKey = localStorage.getItem("lastProcessedWeekKey");
        if (lastWeekKey && lastWeekKey !== currentWeekKey) {
          // New week detected - clear the live data to start fresh
          console.log("New week detected, clearing old focus categories data");
          localStorage.removeItem("focusCategories");
          
          // Get the focus area definitions (without days data) from the previous week's snapshot
          const previousWeekKey = lastWeekKey;
          const previousWeekData = localStorage.getItem(STORAGE_PREFIX + previousWeekKey);
          let freshFocusAreas = [];
          
          if (previousWeekData) {
            try {
              const parsed = JSON.parse(previousWeekData);
              // Create fresh focus areas with empty days objects
              freshFocusAreas = parsed.map(area => ({
                ...area,
                days: {}, // Reset days to empty object
                timeSpent: 0 // Reset time spent
              }));
            } catch (e) {
              console.warn("Failed to parse previous week data:", e);
            }
          }
          
          // Save fresh focus areas for the new week
          if (freshFocusAreas.length > 0) {
            localStorage.setItem("focusCategories", JSON.stringify(freshFocusAreas));
            localStorage.setItem(STORAGE_PREFIX + currentWeekKey, JSON.stringify(freshFocusAreas));
          }
          
          localStorage.setItem("lastProcessedWeekKey", currentWeekKey);
        } else if (!lastWeekKey) {
          // First time running - set the current week as processed
          localStorage.setItem("lastProcessedWeekKey", currentWeekKey);
        }
        
        // Prefer live
        const liveRaw = localStorage.getItem("focusCategories");
        if (liveRaw) {
          data = safeJsonParse(liveRaw, []);
          // keep snapshot in sync with live
          localStorage.setItem(key, JSON.stringify(data));
        } else {
          // fall back to snapshot if no live yet
          const snap = localStorage.getItem(key);
          data = snap ? safeJsonParse(snap, []) : [];
        }
      } else {
        // Past weeks: read snapshot only (no fallback to live)
        const snap = localStorage.getItem(key);
        data = snap ? safeJsonParse(snap, []) : [];
      }
    } catch (_) {
      data = [];
    }
    setCategories(data);
  }, [viewWeekKey, currentWeekKey]);

  // Handle URL parameters for focus area selection and scroll to top
  useEffect(() => {
    const focusParam = searchParams.get('focus');
    const scrollParam = searchParams.get('scroll');
    
    if (focusParam && categories.length > 0) {
      // Find the focus area by label
      const focusArea = categories.find(cat => 
        normalizeLabel(cat.label) === normalizeLabel(focusParam)
      );
      
      if (focusArea) {
        // Mark this focus area as manually set to prevent auto-reset
        const focusAreaWithFlag = { ...focusArea, _manuallySet: true };
        setSelectedFocusArea(focusAreaWithFlag);
        
        // Reset week view to current week when navigating from calendar
        console.log('DEBUG: Before reset - offset:', offset, 'viewWeekKey:', viewWeekKey, 'currentWeekKey:', currentWeekKey);
        setOffset(0); // Reset offset to 0 (current week)
        setViewWeekKey(currentWeekKey); // Also set view week key
        
        // Reset selected date to today when navigating from calendar
        const todayLocal = new Date();
        setSelectedDateFA(ymd(todayLocal));
        
        console.log('DEBUG: After reset - set offset to 0, set viewWeekKey to:', currentWeekKey, 'set selectedDateFA to today:', ymd(todayLocal));
        
        // Scroll to top if requested
        if (scrollParam === 'top') {
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      }
    }
  }, [searchParams, categories, currentWeekKey]);

  // Scroll to top and reset date whenever a focus area is selected (from dashboard clicks)
  useEffect(() => {
    if (selectedFocusArea) {
      // Scroll to top of the page to show the focus area detail module
      window.scrollTo({ top: 0, behavior: 'auto' });
      
      // Reset selected date to today when opening focus area details
      const todayLocal = new Date();
      setSelectedDateFA(ymd(todayLocal));
      console.log('DEBUG: Focus area selected from dashboard - reset selectedDateFA to today:', ymd(todayLocal));
      
      // Mark this focus area as manually set to prevent auto-reset
      if (!selectedFocusArea._manuallySet) {
        setSelectedFocusArea({ ...selectedFocusArea, _manuallySet: true });
      }
    }
  }, [selectedFocusArea]);

  // When other pages modify the live "focusCategories" (current week),
  // always sync to the current week's snapshot and jump dashboard view to current week if needed.
  useEffect(() => {
    const syncFromLive = () => {
      try {
        const liveRaw = localStorage.getItem("focusCategories");
        if (!liveRaw) return;
        const live = safeJsonParse(liveRaw, []);
        // Keep the CURRENT week's snapshot up to date
        try {
          localStorage.setItem(STORAGE_PREFIX + currentWeekKey, JSON.stringify(live));
        } catch {}
        // If we are not looking at the current week, jump there so updates are visible
        if (viewWeekKey !== currentWeekKey) {
          setViewWeekKey(currentWeekKey);
        }
        setCategories(live);
      } catch {}
    };

    const onStorage = (e) => {
      const k = e?.key;
      if (k && k !== "focusCategories" && k !== "focusCategories:lastUpdate") return;
      syncFromLive();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        syncFromLive();
      }
    };

    window.addEventListener("focusCategoriesUpdated", syncFromLive);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focusCategoriesUpdated", syncFromLive);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [viewWeekKey, currentWeekKey]);
  const [showModal, setShowModal] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameGoal, setRenameGoal] = useState("");
  // Cascade renaming of a focus area label across storage, notes, and events
  function cascadeRename(oldLabel, newLabel){
    const norm = normalizeLabel;
    const KEYS = [
      "focusCategories",
      STORAGE_PREFIX + currentWeekKey,
      STORAGE_PREFIX + viewWeekKey,
      STORAGE_PREFIX + weekKey(new Date(Date.now() + 7*24*60*60*1000))
    ];
    // Update arrays of categories in multiple keys
    for (const k of KEYS){
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const arr = safeJsonParse(raw, []);
        const updated = Array.isArray(arr) ? arr.map(c => {
          if (norm(c.label) === norm(oldLabel)) {
            return { ...c, label: newLabel };
          }
          return c;
        }) : arr;
        localStorage.setItem(k, JSON.stringify(updated));
      } catch {}
    }
    // Move notes key if present
    try {
      const oldNotesKey = `focusNotes:${oldLabel}`;
      const newNotesKey = `focusNotes:${newLabel}`;
      const notesVal = localStorage.getItem(oldNotesKey);
      if (notesVal && !localStorage.getItem(newNotesKey)){
        localStorage.setItem(newNotesKey, notesVal);
      }
      if (notesVal) localStorage.removeItem(oldNotesKey);
    } catch {}
    // Update calendar events to point to the new label
    const EVENT_KEYS = ["hourglassEvents:v1", "calendarEvents", "calendar-items", "events"];
    for (const ek of EVENT_KEYS){
      try {
        const raw = localStorage.getItem(ek);
        if (!raw) continue;
        const arr = safeJsonParse(raw, []);
        if (!Array.isArray(arr)) continue;
        const updated = arr.map(ev => {
          const evFocus = ev.area || ev.focusArea || ev.category || ev.label || "";
          if (norm(evFocus) === norm(oldLabel)){
            const next = { ...ev };
            if ("area" in next) next.area = newLabel;
            if ("focusArea" in next) next.focusArea = newLabel;
            if ("category" in next) next.category = newLabel;
            // do not change ev.title
            return next;
          }
          return ev;
        });
        localStorage.setItem(ek, JSON.stringify(updated));
      } catch {}
    }
    try { window.dispatchEvent(new Event("focusCategoriesUpdated")); } catch {}
    try { window.dispatchEvent(new Event("calendarEventsUpdated")); } catch {}
  }

  const daysOfWeek = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];
  // Abbrev of today's weekday in the same format as daysOfWeek
  const todayAbbrev = ["Su","M","Tu","W","Th","F","Sa"][new Date().getDay()];
  // Sum total planned time (daily goals) across all focus areas for today
  const MAX_DAY_HOURS = 24; // Maximum hours that can be planned in a day
  const plannedToday = (categories || []).reduce((sum, c) => sum + (Number(c?.goal) || 0), 0);
  const remainingToday = Math.max(0, availableHours - plannedToday);
  const overByToday = Math.max(0, plannedToday - availableHours);
  // Preset colors for focus areas
  const PRESET_COLORS = ["#8CA4AF", "#BCA88F", "#9ACD32", "#E46C6C", "#7D7ACF", "#F2C94C", "#56CCF2"];
  const [newColor, setNewColor] = useState("#8CA4AF");
  // New: category for AI/recommendations
  const CATEGORY_OPTIONS = ["Study", "Fitness", "Career", "Creative", "Finance", "Health", "Language", "Other"];
  const [newCategory, setNewCategory] = useState("Other");

  // ---- Friends (MVP) state ----
  const [friends, setFriends] = useState([]);
  useEffect(() => {
    setFriends(loadFriends());
  }, []);

  function seedDemoFriends() {
    const demo = [
      {
        id: "f1",
        name: "Ava M.",
        categories: [
          { label: "LSAT", goal: 2, days: { M: 1.2, Tu: 1.0, W: 0, Th: 0, F: 0, Sa: 0, Su: 0 } },
          { label: "Gym", goal: 1, days: { M: 0.5, Tu: 0.5, W: 0, Th: 0, F: 0, Sa: 0, Su: 0 } },
        ],
      },
      {
        id: "f2",
        name: "Noah R.",
        categories: [
          { label: "Design", goal: 3, days: { M: 2.0, Tu: 0.5, W: 0, Th: 0, F: 0, Sa: 0, Su: 0 } },
        ],
      },
    ];
    saveFriends(demo);
    setFriends(demo);
  }

  function removeSampleFriends() {
    saveFriends([]);
    setFriends([]);
  }

  // Seeds for future "Recommended" module and AI prompt hints
  const RECOMMENDATION_SEEDS = {
    Study: [
      { title: "Active Recall Guide", url: "#", by: "StudyTips" },
      { title: "Pomodoro Timer (25/5)", url: "#", by: "FocusFlow" },
      { title: "LSAT Prep Overview", url: "#", by: "LSATHub" },
    ],
    Fitness: [
      { title: "5K Training Plan", url: "#", by: "RunBetter" },
      { title: "Form Cues: Squat", url: "#", by: "CoachNotes" },
      { title: "Mobility Routine", url: "#", by: "MoveDaily" },
    ],
    Career: [
      { title: "Deep Work Playbook", url: "#", by: "WorkCraft" },
      { title: "Portfolio Checklist", url: "#", by: "HiringOps" },
      { title: "Interview Drills", url: "#", by: "PracticePad" },
    ],
    Creative: [
      { title: "Daily Sketch Prompts", url: "#", by: "ArtLoop" },
      { title: "Songwriting Hooks", url: "#", by: "TuneSmith" },
      { title: "Editing Checklist", url: "#", by: "CutSuite" },
    ],
    Finance: [
      { title: "Zero-Based Budgeting", url: "#", by: "MoneyMap" },
      { title: "Investing 101", url: "#", by: "IndexEdu" },
      { title: "Expense Tracker Sheet", url: "#", by: "FrugalTools" },
    ],
    Health: [
      { title: "Meditation Basics", url: "#", by: "CalmLab" },
      { title: "Sleep Hygiene", url: "#", by: "RestCoach" },
      { title: "Simple Meal Plan", url: "#", by: "PlatePrep" },
    ],
    Language: [
      { title: "Frequency Word List", url: "#", by: "LinguaBase" },
      { title: "Shadowing Tutorial", url: "#", by: "SpeechPro" },
      { title: "Grammar Cheats", url: "#", by: "QuickRules" },
    ],
    Other: [
      { title: "Goal-Setting Template", url: "#", by: "FocusKit" },
      { title: "Weekly Review", url: "#", by: "Reflective" },
      { title: "Habit Loop Notes", url: "#", by: "BehaviorLab" },
    ],
  };
  const AI_PROMPT_HINTS = {
    Study: "Help me plan a study session and test myself with active recall.",
    Fitness: "Design a 45‑minute workout aligned with my goal.",
    Career: "Suggest a deep work block and what to accomplish.",
    Creative: "Give me a creative prompt and a 60‑min outline.",
    Finance: "Help me review spending and pick 1 improvement.",
    Health: "Suggest a routine for energy and stress reduction.",
    Language: "Plan a session using input + speaking practice.",
    Other: "Suggest a focused session and a concrete outcome.",
  };
  // Reset defaults whenever the add-modal opens
  useEffect(() => {
    if (showModal) {
      setNewColor("#8CA4AF");
      setNewCategory("Other");
    }
  }, [showModal]);

  // Compute which categories to show on the dashboard (hide empty rows)
  const visibleCategories = (categories || []).filter((c) => {
    const goalNum = Number(c?.goal || 0);
    const spentNum = Number(c?.timeSpent || 0);
    const daysTotal = Object.values(c?.days || {}).reduce(
      (sum, v) => sum + (Number(v) || 0),
      0
    );
    // keep if it has a goal or any time logged
    return goalNum > 0 || spentNum > 0 || daysTotal > 0;
  });

  // === State (selected date must already exist); ensure todayYMD is local ===
  const todayYMD = ymdLocal(new Date());
  
  // --- Focus view: selected day within the visible week (prefer "today" if it falls in this week) ---
  const [selectedDateFA, setSelectedDateFA] = useState(() => {
    const todayLocal = new Date();
    const inThisWeek = todayLocal >= startOfWeek && todayLocal <= endOfWeek;
    return ymd(inThisWeek ? todayLocal : startOfWeek);
  });
          // When switching weeks or changing focus area, jump to &quot;today&quot; if it&apos;s within this week; otherwise Monday.
  useEffect(() => {
    // Skip this auto-reset if we're manually setting the date (from URL params or dashboard clicks)
    if (selectedFocusArea && selectedFocusArea._manuallySet) {
      return;
    }
    
    const todayLocal = new Date();
    const inThisWeek = todayLocal >= startOfWeek && todayLocal <= endOfWeek;
    setSelectedDateFA(ymd(inThisWeek ? todayLocal : startOfWeek));
  }, [viewWeekKey, selectedFocusArea, startOfWeek, endOfWeek]);

  // --- Derived values ---
  // Compute the selected date string in YMD format for the current view
  const selectedDate = (() => {
    // rawDate is already offset by navigation (offset)
    const d = new Date(rawDate);
    d.setHours(0, 0, 0, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
// Helper for parsing YMD string to Date
  function parseYMD(ymd) {
    const [y, m, d] = (ymd || '').split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  // Convert a timestamp/ISO to "HH:MM" (24h)
  function msToHHMM(msOrIso){
    const d = new Date(msOrIso);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  // Build an ISO string from YYYY-MM-DD and HH:MM in local time
  function isoFromDateAndTime(ymdStr, hhmm){
    if (!ymdStr || !hhmm) return new Date().toISOString();
    const [y, m, d] = ymdStr.split('-').map(Number);
    const [hh, mm] = hhmm.split(':').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    return dt.toISOString();
  }
  // Is a YYYY-MM-DD date in the future (date-only compare)?
  function isFutureYMD(ymdStr) {
    if (!ymdStr) return false;
    const sel = parseYMD(ymdStr);
    const today = new Date();
    const selDay = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate());
    const curDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return selDay > curDay;
  }
  // Matches the dashboard/day labels: ["Su","M","Tu","W","Th","F","Sa"]
  const selectedDayAbbrev = ["Su","M","Tu","W","Th","F","Sa"][parseYMD(selectedDate).getDay()];

  // Button label for add focus area
  const addBtnLabel = isNextWeek
    ? "+ Add another Focus Area"
    : "+ Add another Focus Area";

  // --- Timer & manual log state (from old slug page) ---
  const [logHours, setLogHours] = useState("");
  const [logMinutes, setLogMinutes] = useState("");
  const [running, setRunning] = useState(false);
  const [initialRemaining, setInitialRemaining] = useState(0); // seconds baseline
  const [remaining, setRemaining] = useState(0);               // ticking value
  const tickRef = useMemo(() => ({ current: null }), []);

  // Recompute countdown baseline when selected focus area changes (or its data changes)
  useEffect(() => {
    if (!selectedFocusArea) return;
    const norm = normalizeLabel;
    const fa = (categories || []).find(c => norm(c.label) === norm(selectedFocusArea.label)) || selectedFocusArea;
    const goalNum = Number(fa?.goal || 0);
    // remaining for the selected day only
    const dayKey = ["Su","M","Tu","W","Th","F","Sa"][parseYMD(selectedDateFA).getDay()];
    const spentToday = Number((fa?.days && fa.days[dayKey]) || 0);
    const remainingHours = Math.max(0, goalNum - spentToday);
    const seconds = hToSeconds(remainingHours);
    setInitialRemaining(seconds);
    setRemaining(seconds);
    setRunning(false);
    if (tickRef.current) { try { clearInterval(tickRef.current); } catch {} }
  }, [
    selectedFocusArea,
    selectedDateFA,
    categories,
    tickRef
  ]);

  // Tick when running
  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setRunning(false);
          try { clearInterval(tickRef.current); } catch {}
        }
        return next;
      });
    }, 1000);
    return () => { try { clearInterval(tickRef.current); } catch {} };
  }, [running, tickRef]);

  function handleResetTimer() {
    setRunning(false);
    setRemaining(initialRemaining);
  }

  // Apply a delta (positive to add, negative to remove) to the selected focus area for the selected day
  function applyDeltaToSelectedFocus(deltaHours) {
    // block manual logging on future days
    if (isFutureYMD(selectedDateFA)) {
              window.alert("This is a future date. You can&apos;t log time yet — plan a session in the Timeline below instead.");
      return;
    }
    if (!selectedFocusArea || !deltaHours) return;
    const dayKey = ["Su","M","Tu","W","Th","F","Sa"][parseYMD(selectedDateFA).getDay()];
    const norm = normalizeLabel;
    const updated = (categories || []).map(c => {
      if (norm(c.label) !== norm(selectedFocusArea.label)) return c;
      const daysMap = Array.isArray(c.days) ? { ...c.days } : { ...(c.days || {}) };
      const prev = Number(daysMap[dayKey] || 0);
      const nextDayVal = Math.max(0, prev + deltaHours);
      daysMap[dayKey] = nextDayVal;
      // recompute total timeSpent from days map
      const total = Object.values(daysMap).reduce((sum, v) => sum + (Number(v) || 0), 0);
      return { ...c, days: daysMap, timeSpent: total };
    });
    setCategories(updated);
    saveWeekAndLive(updated);
  }

  function handleManualAdd() {
    const hrs = Math.max(0, Number(logHours || 0));
    const mins = Math.max(0, Number(logMinutes || 0));
    const addHrs = hrs + mins / 60;
    if (!addHrs) return;
    applyDeltaToSelectedFocus(addHrs);
    setLogHours("");
    setLogMinutes("");
  }
  function handleManualRemove() {
    const hrs = Math.max(0, Number(logHours || 0));
    const mins = Math.max(0, Number(logMinutes || 0));
    const delta = hrs + mins / 60;
    if (!delta) return;
    applyDeltaToSelectedFocus(-delta);
    setLogHours("");
    setLogMinutes("");
  }

  // Notes state and effect for selected focus area (moved to top-level)
  const [notes, setNotes] = useState("");
  // Timeline state (moved from inside conditional)
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: "", start: "", end: "" });
  // Refs to force-open native date pickers
  const newEventDateRef = useRef(null);
  const editEventDateRef = useRef(null);
  // Inline edit modal for timeline events
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editEventId, setEditEventId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    title: "",
    area: "",
    dateYMD: "",
    start: "",
    end: "",
    notes: "",
  });
  // Load notes for the selected focus area and week
  useEffect(() => {
    if (!selectedFocusArea) return; // skip if no focus area selected
    const notesKey = `focusNotes:${viewWeekKey}:${selectedFocusArea.label}`;
    try {
      const raw = localStorage.getItem(notesKey);
      setNotes(raw || "");
    } catch {
      setNotes("");
    }
  }, [viewWeekKey, selectedFocusArea]);

  if (selectedFocusArea) {
    // Find the latest data for the selected focus area (using label match)
    const norm = normalizeLabel;
    const focusArea = (categories || []).find(
      c => norm(c.label) === norm(selectedFocusArea.label)
    ) || selectedFocusArea;
    const areaColor = focusArea?.color || "#8CA4AF";
    const goal = Number(focusArea?.goal) || 0;
    // Progress for the currently selected day only
    const selectedDayKey = ["Su","M","Tu","W","Th","F","Sa"][parseYMD(selectedDateFA).getDay()];
    const spentToday = Number(focusArea?.days?.[selectedDayKey] || 0);
    const percentRaw = goal > 0 ? (spentToday / goal) * 100 : 0;
    const percent = Math.min(percentRaw, 100).toFixed(0);
    const overAmountRaw = goal > 0 ? ((spentToday - goal) / goal) * 100 : 0;
    const overAmount = spentToday > goal ? Math.min(overAmountRaw, 100).toFixed(0) : 0;
    const bottomFraction = 14 / 21;
    const centerAmount = Math.abs(goal - spentToday);
    // For daily log editing: which day is currently selected? Use selectedDate and week
    // For notes: key by week and focus area label
    const notesKey = `focusNotes:${viewWeekKey}:${focusArea.label}`;
    // Save notes when edited
    function saveNotes(newVal) {
      setNotes(newVal);
      try {
        localStorage.setItem(notesKey, newVal);
      } catch {}
    }
    // For editing time log for a day: update the correct day in the focusArea.days object
    function updateDayHours(dayAbbrev, newVal) {
      // Only allow edit if week is editable
      if (!canEditWeek) return;
      const safeVal = Math.max(0, Number(newVal) || 0);
      // Defensive: days may be array or object
      const prevDays = Array.isArray(focusArea.days)
        ? { ...focusArea.days }
        : { ...(focusArea.days || {}) };
      prevDays[dayAbbrev] = safeVal;
      // Update total timeSpent for this focus area (sum days)
      const newTimeSpent = Object.values(prevDays).reduce((a, b) => a + (Number(b) || 0), 0);
      // Update categories list
      const updatedCats = (categories || []).map(c =>
        norm(c.label) === norm(focusArea.label)
          ? { ...c, days: prevDays, timeSpent: newTimeSpent }
          : c
      );
      setCategories(updatedCats);
      saveWeekAndLive(updatedCats);
    }
    // For day bars: get weekday abbrevs
    const dayOrder = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];
    // For today's highlight
    const todayAbbrev = ["Su","M","Tu","W","Th","F","Sa"][new Date().getDay()];
    // For editing: current selected date's abbrev
    const selectedDayAbbrev = ["Su","M","Tu","W","Th","F","Sa"][parseYMD(selectedDate).getDay()];

    // Abbrev for the currently selected day (drives the star)
    const selectedAbbrev = ["Su","M","Tu","W","Th","F","Sa"][parseYMD(selectedDateFA).getDay()];

    // --- Timeline state and handlers ---

    // Load events from localStorage
    const allEvents = (() => {
      try {
        const raw = localStorage.getItem("hourglassEvents:v1") || localStorage.getItem("calendarEvents");
        return raw ? safeJsonParse(raw, []) : [];
      } catch {
        return [];
      }
    })();

    // Filter for current focus area & month
    const filteredEvents = allEvents.filter(ev => {
      const evStart = new Date(ev.start);
      const matchesArea = normalizeLabel(ev.area) === normalizeLabel(focusArea.label);
      
      // Calculate month boundaries for the viewed month
      const viewedMonthStart = new Date(rawDate.getFullYear(), rawDate.getMonth(), 1);
      const viewedMonthEnd = new Date(rawDate.getFullYear(), rawDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const matchesMonth = evStart >= viewedMonthStart && evStart <= viewedMonthEnd;
      
      // Debug logging for event filtering
      if (ev.area === focusArea.label) {
        console.log('Event filtering debug:', {
          event: ev.title,
          area: ev.area,
          focusArea: focusArea.label,
          evStart: evStart.toISOString(),
          evStartLocal: evStart.toLocaleString(),
          viewedMonthStart: viewedMonthStart.toISOString(),
          viewedMonthEnd: viewedMonthEnd.toISOString(),
          rawDate: rawDate.toISOString(),
          offset,
          matchesArea,
          matchesMonth,
          included: matchesArea && matchesMonth
        });
      }
      
      return matchesArea && matchesMonth;
    });

    // Filter for future planning timeline - events from today forward
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const futureEvents = allEvents
      .filter(ev => {
        const matchesArea = normalizeLabel(ev.area) === normalizeLabel(focusArea.label);
        if (!matchesArea) return false;
        
        const s = getEventStart(ev);
        const e = getEventEnd(ev);
        // Keep if it starts today/future OR (if no start) ends today/future
        return (s && s >= todayStart) || (!s && e && e >= todayStart);
      })
      .sort((a, b) => {
        const sa = getEventStart(a)?.getTime() ?? Infinity;
        const sb = getEventStart(b)?.getTime() ?? Infinity;
        return sa - sb;
      });

    // Save new event
    function saveNewEvent() {
      if (!newEvent?.date || !newEvent?.start || !newEvent?.end) {
        setShowNewEventForm(false);
        return;
      }
      const id = Date.now().toString();
      
      // Create dates in local time to avoid timezone issues
      const [year, month, day] = newEvent.date.split('-').map(Number);
      const [startHour, startMin] = newEvent.start.split(':').map(Number);
      const [endHour, endMin] = newEvent.end.split(':').map(Number);
      
      const startDate = new Date(year, month - 1, day, startHour, startMin, 0, 0);
      const endDate = new Date(year, month - 1, day, endHour, endMin, 0, 0);
      
      const newEventObj = {
        id,
        title: newEvent.title || focusArea.label,
        area: newEvent.area || focusArea.label,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay: false,
        notes: newEvent.notes || "",
      };
      
      const updated = [...allEvents, newEventObj];
      
      try {
        // Debug logging
        console.log('Saving new event:', {
          newEvent: newEventObj,
          allEventsCount: allEvents.length,
          updatedCount: updated.length,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          startDateLocal: startDate.toLocaleString(),
          endDateLocal: endDate.toLocaleString(),
          inputDate: newEvent.date,
          inputStart: newEvent.start,
          inputEnd: newEvent.end
        });
        
        // Update localStorage
        localStorage.setItem("hourglassEvents:v1", JSON.stringify(updated));
        localStorage.setItem("calendarEvents", JSON.stringify(updated));
        
        // Update local state immediately
        setAllEvents(updated);
        
        // Notify other components
        window.dispatchEvent(new Event("calendarEventsUpdated"));
        
        // Also trigger a storage event for better cross-page sync
        try {
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'calendarEvents',
            newValue: JSON.stringify(updated),
            oldValue: JSON.stringify(allEvents)
          }));
        } catch (e) {
          console.warn("Failed to dispatch storage event:", e);
        }
        
        // Reset form
        setNewEvent({ date: "", start: "", end: "" });
      } catch (e) {
        console.warn("Failed to save event:", e);
      }
      
      setShowNewEventForm(false);
    }

    // Delete event
    function handleDeleteEvent(id) {
      const updated = allEvents.filter(ev => ev.id !== id);
      try {
        // Update localStorage
        localStorage.setItem("hourglassEvents:v1", JSON.stringify(updated));
        localStorage.setItem("calendarEvents", JSON.stringify(updated));
        
        // Update local state immediately
        setAllEvents(updated);
        
        // Notify other components
        window.dispatchEvent(new Event("calendarEventsUpdated"));
      } catch (e) {
        console.warn("Failed to delete event:", e);
      }
    }



    // --- Layout refactor for focus area view ---
    return (
      <div className="min-h-screen bg-white text-black px-4 pb-32 font-sans flex flex-col">
        <div className="w-full">
          <button
            onClick={() => setSelectedFocusArea(null)}
            className="mb-4 mt-6 px-4 py-2 w-full rounded bg-gray-200 text-[#4E4034] font-medium shadow hover:bg-gray-300"
          >
            ← Back to Dashboard
          </button>
        </div>
        <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
          {/* Focus area module */}
          <div className="w-full flex flex-col gap-4">
            <div className="bg-white rounded-xl shadow-md p-6">
              {/* Removed header: title/date nav */}
              <div className="flex items-center gap-6 w-full">
                {/* Left: label + ring + small texts (same proportions as dashboard) */}
                <div className="flex flex-col items-center w-28">
                  <div className="text-sm font-semibold text-[#4E4034] text-center mb-1">{focusArea.label}</div>
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path
                        className="text-gray-300"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {/* Progress ring */}
                      <path
                        stroke={hexToRGBA(areaColor, 0.55)}
                        strokeWidth="3"
                        strokeDasharray={`${percent}, 100`}
                        strokeLinecap="round"
                        fill="none"
                        transform="rotate(-90 18 18)"
                        className="transition-all duration-700 ease-out"
                        d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {overAmount > 0 && (
                        <g transform="scale(0.88) translate(2.2 2.2)" className="animate-pulse">
                          <path
                            stroke={areaColor}
                            strokeWidth="2.2"
                            strokeDasharray={`${overAmount}, 100`}
                            strokeLinecap="round"
                            fill="none"
                            transform="rotate(-90 18 18)"
                            className="transition-all duration-700 ease-out"
                            d="M18 2.0845
                                  a 15.9155 15.9155 0 0 1 0 31.831
                                  a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </g>
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-[#4E4034] leading-tight">
                      <div className="text-sm">{formatCenterAmount(centerAmount)}</div>
                      <div className="text-[10px] uppercase text-gray-500">
                        {(Number(spentToday || 0) > Number(goal || 0)) ? 'OVER' : 'LEFT'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 text-center mt-1">
                    Daily Goal = {fmt1(goal)}{hrUnit(goal)}
                  </div>
                </div>

                {/* Right: weekly bars (same as dashboard) */}
                <div className="flex-1 flex flex-col w-full">
                  <div className="date-nav mb-1">
                    <button
                      className={`px-2 text-lg ${parseYMD(selectedDateFA) <= startOfWeek ? 'opacity-30 cursor-not-allowed' : ''}`}
                      onClick={() => {
                        const prev = ymdLocal(addDays(parseYMDLocal(selectedDateFA), -1));
                        setSelectedDateFA(prev);
                      }}
                      disabled={parseYMD(selectedDateFA) <= startOfWeek}
                      aria-label="Previous day"
                      type="button"
                    >
                      ◀
                    </button>
                    <div className="text-[#4E4034] text-xs font-medium">
                      {parseYMD(selectedDateFA).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                    <button
                      className={`px-2 text-lg ${compareYMD(selectedDateFA, todayYMD) >= 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                      onClick={() => {
                        const next = ymdLocal(addDays(parseYMDLocal(selectedDateFA), 1));
                        // allow navigating forward up to (and including) today
                        if (compareYMD(next, todayYMD) <= 0) {
                          setSelectedDateFA(next);
                        }
                      }}
                      disabled={compareYMD(selectedDateFA, todayYMD) >= 0}
                      aria-label="Next day"
                      type="button"
                    >
                      ▶
                    </button>
                  </div>
                  <div className="flex items-center gap-1 w-full py-2 justify-center px-3 pr-6">
                    {dayOrder.map((day) => {
                      const spent = (focusArea.days?.[day] ?? 0);
                      const goalHrs = Number(goal);
                      const pct = goalHrs > 0 ? Math.min(spent / goalHrs, 1) : 0;
                      const isOver = goalHrs > 0 && spent > goalHrs;
                      // const canEditDay = canEditWeek && day === selectedDayAbbrev;
                      return (
                        <div key={day} className="relative flex flex-col items-center w-6">
                          <div className="relative w-5 h-20 flex flex-col items-center justify-end">
                            {/* static track */}
                            <div className="absolute bottom-0 w-full h-full flex flex-col justify-end">
                              <div
                                className="w-full h-6 rounded-t-sm border border-[#EAECEC] bg-[#DDE5ED]"
                                style={{ backgroundColor: isOver ? areaColor : '#DDE5ED' }}
                              />
                              <div className="h-1" />
                              <div className="w-full h-14 rounded-b-sm border border-[#EAECEC] bg-[#DDE5ED]" />
                            </div>
                            {/* bottom fill only */}
                            <div
                              className="absolute bottom-0 w-full rounded-b-sm"
                              style={{ height: `${pct * bottomFraction * 100}%`, backgroundColor: hexToRGBA(areaColor, 0.4) }}
                            />
                          </div>
                          <div className="text-xs text-[#4E4034] text-center mt-1">{day}</div>
                          {day === selectedAbbrev ? (
                            <div className="text-[10px] text-[#BCA88F] leading-none mt-1">★</div>
                          ) : (
                            <div className="h-[10px] mt-1" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {/* --- Inserted: Countdown, Log Time, Data, Timeline sections --- */}
                {/* Countdown + Log cards (match old slug layout) */}
                <div className="w-full grid grid-cols-2 gap-3 mt-3">
                  {/* Countdown */}
                  <div className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col">
                    <div className="text-sm text-gray-500 mb-2">Countdown</div>
                    <div className="text-2xl font-mono tracking-wider text-[#4E4034]">
                      {secondsToHMMSS(remaining)}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Starting from {secondsToHMMSS(initialRemaining)} (time left today)
                    </div>
                    <div className="flex gap-2 mt-3">
                      {!running ? (
                        <button
                          onClick={() => setRunning(true)}
                          className="h-9 px-3 text-sm rounded bg-[#8CA4AF] text-white font-medium"
                        >
                          Start
                        </button>
                      ) : (
                        <button
                          onClick={() => setRunning(false)}
                          className="h-9 px-3 text-sm rounded bg-gray-300 text-[#4E4034] font-medium"
                        >
                          Pause
                        </button>
                      )}
                      <button
                        onClick={handleResetTimer}
                        className="h-9 px-3 text-sm rounded bg-gray-200 text-[#4E4034] font-medium disabled:opacity-50"
                        disabled={remaining === initialRemaining}
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Log Time Completed */}
                  <div className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col">
                    <div className="text-sm text-gray-500 mb-2">Log Time Completed</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Hours</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={logHours}
                          onChange={(e) => setLogHours(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-[#4E4034]"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Minutes</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={logMinutes}
                          onChange={(e) => setLogMinutes(e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-[#4E4034]"
                          placeholder="0"
                          min="0"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={handleManualRemove}
                        className="h-9 px-3 text-sm rounded border border-red-400 text-red-600 font-medium"
                      >
                        Remove
                      </button>
                      <button
                        onClick={handleManualAdd}
                        className="h-9 px-3 text-sm rounded text-white font-medium border"
                        style={{ backgroundColor: hexToRGBA(areaColor, 0.4), borderColor: areaColor, borderWidth: '3px' }}
                      >
                        Add
                      </button>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-2">Adjust your time log for today</div>
                  </div>
                </div>


              {/* AI Helper - Chat Style UI */}
              {/* AI Helper Component */}
              <AiHelper
                key={focusArea.label}
                focusAreaId={focusArea.label}
                focusContext={{
                  name: focusArea.label,
                  goal: focusArea.goal,
                  weekLogged: (() => {
                    const weekDays = ["M","Tu","W","Th","F","Sa","Su"];
                    return weekDays.reduce(
                      (sum, d) => sum + Number(focusArea?.days?.[d] || 0),
                      0
                    );
                  })(),
                  leftToday: (() => {
                    const selectedDateYMD = selectedDateFA || selectedDate;
                    const stats = computeAiStats(focusArea, selectedDateYMD);
                    return stats.leftToday;
                  })()
                }}
              />
              
              {/* Data summary (match old slug) */}
              {(() => {
                const weekDays = ["M","Tu","W","Th","F","Sa","Su"];
                const totalHoursThisWeek = weekDays.reduce(
                  (sum, d) => sum + Number(focusArea?.days?.[d] || 0),
                  0
                );
                // Daily average = total logged / days elapsed this week (if viewing current week), else / 7
                const todayKey = ["Su","M","Tu","W","Th","F","Sa"][new Date().getDay()];
                const elapsedDays = isCurrentWeek ? Math.max(1, weekDays.indexOf(todayKey) + 1) : 7;
                const dailyAverage = totalHoursThisWeek / elapsedDays;
                const weeklyGoal = Number(goal || 0) * 7;
                const weeklyDelta = weeklyGoal - totalHoursThisWeek;
                return (
                  <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 mt-3">
                    <div className="text-sm text-gray-500 mb-2">Data</div>
                    <div className="grid grid-cols-3 gap-3 text-[#4E4034]">
                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                        <div className="text-[11px] text-gray-500">Total this week</div>
                        <div className="font-semibold">{formatHoursAndMinutes(totalHoursThisWeek)}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                        <div className="text-[11px] text-gray-500">Daily avg</div>
                        <div className="font-semibold">{formatHoursAndMinutes(dailyAverage)}</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                        <div className="text-[11px] text-gray-500">Weekly goal</div>
                        <div className="font-semibold">{formatHoursAndMinutes(weeklyGoal)}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[12px] text-gray-600">
                      {weeklyDelta >= 0 ? (
                        <>Weekly: {formatHoursAndMinutes(weeklyDelta)} LEFT</>
                      ) : (
                        <>Weekly: {formatHoursAndMinutes(Math.abs(weeklyDelta))} OVER</>
                      )}
                    </div>
                  </div>
                );
              })()}
              
              {/* Recommended Resources Module */}
              {(() => {
                const cat =
                  (focusArea?.meta && focusArea.meta.category) ||
                  (categories.find(c => normalizeLabel(c.label) === normalizeLabel(focusArea.label))?.meta?.category) ||
                  "Other";
                
                // Mock data for recommended resources based on category
                const getRecommendedResources = (category) => {
                  switch (category.toLowerCase()) {
                    case "fitness":
                      return [
                        { title: "Hal Higdon Training Plans", url: "#", description: "Professional running training programs" },
                        { title: "Strava Running Groups", url: "#", description: "Join local running communities" },
                        { title: "YouTube: Jeff Nippard", url: "#", description: "Science-based fitness content" }
                      ];
                    case "study":
                      return [
                        { title: "Khan Academy LSAT", url: "#", description: "Free LSAT prep materials" },
                        { title: "7Sage", url: "#", description: "Comprehensive LSAT preparation" },
                        { title: "Anki Deck Marketplace", url: "#", description: "Flashcard decks for any subject" }
                      ];
                    case "business":
                      return [
                        { title: "Seth Godin Blog", url: "#", description: "Marketing and business insights" },
                        { title: "Indie Hackers", url: "#", description: "Community for bootstrapped founders" },
                        { title: "Y Combinator Startup School", url: "#", description: "Free startup course" }
                      ];
                    case "coding":
                      return [
                        { title: "freeCodeCamp", url: "#", description: "Learn to code for free" },
                        { title: "The Odin Project", url: "#", description: "Full-stack web development" },
                        { title: "Frontend Masters", url: "#", description: "Advanced frontend courses" }
                      ];
                    case "design":
                      return [
                        { title: "Figma Community", url: "#", description: "Design templates and resources" },
                        { title: "Dribbble", url: "#", description: "Design inspiration and community" },
                        { title: "Skillshare Design", url: "#", description: "Creative design courses" }
                      ];
                    default:
                      return [
                        { title: "Productivity Blog", url: "#", description: "General productivity tips" },
                        { title: "Time Management Guide", url: "#", description: "Effective time management strategies" },
                        { title: "Goal Setting Resources", url: "#", description: "Tools for setting and achieving goals" }
                      ];
                  }
                };
                
                const resources = getRecommendedResources(cat);
                
                return (
                  <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 mt-3">
                    <div className="text-[#4E4034] font-semibold text-base mb-2">Recommended for You</div>
                    <div className="text-[12px] text-gray-600 mb-3">Based on your focus area category</div>
                    <div className="space-y-2">
                      {resources.map((resource, index) => (
                        <a
                          key={index}
                          href={resource.url}
                          className="block rounded-xl border border-gray-200 bg-white shadow-sm p-3 hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <div className="font-semibold text-[#4E4034] text-sm mb-1">{resource.title}</div>
                          <div className="text-[12px] text-[#6A5E53]">{resource.description}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* --- END inserted sections --- */}
              {/* Timeline module - Future Planning Tool */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 mt-3">
                <div className="text-[#4E4034] font-semibold text-base mb-2">
                  <span>Timeline - Future Planning</span>
                </div>
                <div className="text-[12px] text-gray-600 mb-3">
                  Showing events from <strong>{todayStart.toLocaleDateString()}</strong> onward.
                </div>
              {/* Add Event Modal */}
              {showNewEventForm && (
                <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-lg p-5 w-[90%] max-w-md">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-[#4E4034]">Plan Future Session</h3>
                      <button onClick={() => setShowNewEventForm(false)} className="text-sm text-gray-500">Close</button>
                    </div>
                    <div className="text-[12px] text-gray-600 mb-3">
                      Schedule upcoming time blocks for this focus area
                    </div>

                    <label className="block text-xs text-gray-600 mb-1">Title</label>
                    <input
                      value={newEvent.title || ""}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-[#4E4034]"
                      placeholder="e.g., Product Development"
                    />

                    <label className="block text-xs text-gray-600 mb-1">Focus Area</label>
                    <select
                      value={newEvent.area || (focusArea.label || "")}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, area: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 mb-1 text-[#4E4034]"
                    >
                      {(categories || []).map(c => (
                        <option key={c.label} value={c.label}>{c.label}</option>
                      ))}
                    </select>
                    <div className="text-[11px] text-gray-500 mb-3">Event color follows the Focus Area</div>

                    <label className="block text-xs text-gray-600 mb-1">Date</label>
                    <input
                      ref={newEventDateRef}
                      type="date"
                      value={newEvent.date || selectedDateFA}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, date: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-[#4E4034] mb-3"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Start</label>
                        <input
                          type="time"
                          value={newEvent.start || "09:00"}
                          onChange={(e) => setNewEvent((prev) => ({ ...prev, start: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-[#4E4034]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">End</label>
                        <input
                          type="time"
                          value={newEvent.end || "10:00"}
                          onChange={(e) => setNewEvent((prev) => ({ ...prev, end: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-[#4E4034]"
                        />
                      </div>
                    </div>

                    <label className="block text-xs text-gray-600 mb-1 mt-3">Notes</label>
                    <textarea
                      value={newEvent.notes || ""}
                      onChange={(e) => setNewEvent((prev) => ({ ...prev, notes: e.target.value }))}
                      className="w-full min-h-[80px] border border-gray-300 rounded px-3 py-2 text-[#4E4034]"
                      placeholder="What will you do during this session?"
                    />

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={() => setShowNewEventForm(false)}
                        className="px-3 py-2 rounded bg-gray-200 text-[#4E4034]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveNewEvent}
                        className="px-3 py-2 rounded bg-[#BCA88F] text-white"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

                {/* List events */}
                {futureEvents.length === 0 ? (
                  <div className="text-gray-400 text-sm">No upcoming sessions. Add one in Calendar →</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {futureEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="rounded-lg p-2 flex justify-between items-center text-sm"
                        style={{ backgroundColor: hexToRGBA(areaColor, 0.4), borderColor: areaColor, borderWidth: '3px', borderStyle: 'solid' }}
                      >
                        <div>
                          <div className="font-semibold text-[#4E4034]">{ev.title || ev.area}</div>
                          <div className="text-[#4E4034]/80">
                            {new Date(ev.start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            {" • "}
                            {new Date(ev.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            {" - "}
                            {new Date(ev.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </div>
                        </div>
                        {canEditWeek && (
                          <button
                            onClick={() => {
                              const start = new Date(ev.start);
                              const end = new Date(ev.end);
                              setEditEventId(ev.id);
                              setEditDraft({
                                title: ev.title || ev.area || "",
                                area: ev.area || (focusArea.label || ""),
                                dateYMD: ymd(start),
                                start: msToHHMM(start),
                                end: msToHHMM(end),
                                notes: ev.notes || ev.description || "",
                              });
                              setShowEditEventModal(true);
                            }}
                            className="text-blue-700 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>
              {/* Notes section (moved here) */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[#4E4034] font-semibold text-base">
                    Notes
                  </div>
                  <button
                    onClick={() => router.push(`/notes?focus=${encodeURIComponent(selectedFocusArea?.label || '')}`)}
                    className="px-3 py-1.5 bg-[#8CA4AF] text-white text-sm rounded-lg hover:bg-[#7A939F] transition-colors duration-200 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Open Notes
                  </button>
                </div>
                {canEditWeek ? (
                  <textarea
                    className="w-full min-h-[76px] rounded border border-gray-300 px-3 py-2 text-[#4E4034] bg-[#F7F6F3] shadow-inner text-sm focus:outline-none focus:ring-2 focus:ring-[#BCA88F] mb-2"
                    placeholder="Add strategies, ideas, or action steps for this focus area…"
                    value={notes}
                    onChange={e => saveNotes(e.target.value)}
                  />
                ) : (
                  <div className="text-gray-700 text-sm min-h-[76px] whitespace-pre-wrap px-1 py-1">
                    {notes
                      ? notes
                      : <span className="text-gray-400">No notes for this week.</span>
                    }
                  </div>
                )}
              </div>



            </div>
          </div>
          {/* Future sections: countdown/log-time/data/timeline would go here in the gap-6 container */}
          {/* Edit Event Modal */}
          {showEditEventModal && (
            <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-5 w-[90%] max-w-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-[#4E4034]">Edit Event</h3>
                  <button onClick={() => setShowEditEventModal(false)} className="text-sm text-gray-500">Close</button>
                </div>

                <label className="block text-xs text-gray-600 mb-1">Title</label>
                <input
                  value={editDraft.title}
                  onChange={(e)=> setEditDraft(d=>({ ...d, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-[#4E4034]"
                />

                <label className="block text-xs text-gray-600 mb-1">Focus Area</label>
                <select
                  value={editDraft.area}
                  onChange={(e)=> setEditDraft(d=>({ ...d, area: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-[#4E4034]"
                >
                  {(categories || []).map(c => (
                    <option key={c.label} value={c.label}>{c.label}</option>
                  ))}
                </select>

                <label className="block text-xs text-gray-600 mb-1">Date</label>
                <input
                  ref={editEventDateRef}
                  type="date"
                  value={editDraft.dateYMD}
                  onChange={(e)=> setEditDraft(d=>({ ...d, dateYMD: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-[#4E4034]"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Start</label>
                    <input
                      type="time"
                      value={editDraft.start}
                      onChange={(e)=> setEditDraft(d=>({ ...d, start: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-[#4E4034]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">End</label>
                    <input
                      type="time"
                      value={editDraft.end}
                      onChange={(e)=> setEditDraft(d=>({ ...d, end: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-[#4E4034]"
                    />
                  </div>
                </div>

                <label className="block text-xs text-gray-600 mb-1 mt-3">Notes</label>
                <textarea
                  value={editDraft.notes}
                  onChange={(e)=> setEditDraft(d=>({ ...d, notes: e.target.value }))}
                  className="w-full min-h-[80px] border border-gray-300 rounded px-3 py-2 text-[#4E4034]"
                />

                <div className="mt-4 flex justify-between items-center">
                  <button
                    onClick={() => {
                      const allRaw = localStorage.getItem("hourglassEvents:v1") || localStorage.getItem("calendarEvents");
                      const all = allRaw ? safeJsonParse(allRaw, []) : [];
                      const updated = all.filter(ev => ev.id !== editEventId);
                      try {
                        localStorage.setItem("hourglassEvents:v1", JSON.stringify(updated));
                        localStorage.setItem("calendarEvents", JSON.stringify(updated));
                        window.dispatchEvent(new Event("calendarEventsUpdated"));
                      } catch {}
                      setShowEditEventModal(false);
                    }}
                    className="px-3 py-2 rounded bg-red-500 text-white"
                  >
                    Delete
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEditEventModal(false)}
                      className="px-3 py-2 rounded bg-gray-200 text-[#4E4034]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const allRaw = localStorage.getItem("hourglassEvents:v1") || localStorage.getItem("calendarEvents");
                        const all = allRaw ? safeJsonParse(allRaw, []) : [];
                        const startISO = isoFromDateAndTime(editDraft.dateYMD, editDraft.start);
                        const endISO = isoFromDateAndTime(editDraft.dateYMD, editDraft.end);
                        const updated = all.map(ev => ev.id === editEventId ? {
                          ...ev,
                          title: editDraft.title || editDraft.area || ev.title || ev.area,
                          area: editDraft.area || ev.area,
                          start: startISO,
                          end: endISO,
                          notes: editDraft.notes || "",
                        } : ev);
                        try {
                          localStorage.setItem("hourglassEvents:v1", JSON.stringify(updated));
                          localStorage.setItem("calendarEvents", JSON.stringify(updated));
                          window.dispatchEvent(new Event("calendarEventsUpdated"));
                        } catch {}
                        setShowEditEventModal(false);
                      }}
                      className="px-3 py-2 rounded bg-[#BCA88F] text-white"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    );
  }

  return (
    <>
            <div className="min-h-screen bg-white text-gray-900 pb-40 font-sans flex flex-col gap-6">
      <header className="w-full py-3 px-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            className={`text-gray-700 text-xl px-3 ${offset <= MIN_OFFSET ? 'opacity-30 cursor-not-allowed' : 'hover:text-gray-900'}`}
            aria-label="Previous Week"
            onClick={() => {
              if (offset <= MIN_OFFSET) return;
              setOffset((o) => Math.max(MIN_OFFSET, o - 7)); // step one week back
              setIsNextWeek(false);
            }}
            disabled={offset <= MIN_OFFSET}
          >
            ‹
          </button>
          <div className="text-gray-900 font-bold text-lg">{today}</div>
          {/* Forward/right arrow for week navigation */}
          <button
            className={`text-gray-700 text-xl px-3 ${offset >= MAX_FUTURE_DAYS ? 'opacity-30 cursor-not-allowed' : 'hover:text-gray-900'}`}
            aria-label="Next Week"
            onClick={() => {
              if (offset >= MAX_FUTURE_DAYS) return;
              setOffset((o) => Math.min(MAX_FUTURE_DAYS, o + 7));
              setIsNextWeek(true);
            }}
            disabled={offset >= MAX_FUTURE_DAYS}
          >
            ›
          </button>
        </div>
        <div className="ml-auto">
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

      {/* Friends (beta) */}
      <section className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Friends (beta)</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={friends.length === 0 ? seedDemoFriends : removeSampleFriends}
              className={`text-sm px-4 py-2 rounded-xl border transition-colors duration-200 ${
                friends.length === 0 
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
              }`}
              title={friends.length === 0 ? "Add sample friends to preview the module" : "Remove sample friends"}
              type="button"
            >
              {friends.length === 0 ? 'Add sample' : 'Remove samples'}
            </button>
          </div>
        </div>

        {friends.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white text-gray-600 px-4 py-4 text-sm">
            No friends yet. Tap <span className="font-semibold text-gray-700">Add sample</span> to preview how this looks.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {friends.map((f) => {
              const stats = friendWeeklyStats(f, startOfWeek);
              return (
                <div key={f.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 w-full flex flex-row items-center gap-4 hover:shadow-md transition-shadow duration-200">
                  {/* Initials avatar */}
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-bold text-sm">
                    {String(f.name || "?").split(" ").map(s=>s[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-semibold text-gray-900">{f.name}</div>
                    <div className="text-sm text-gray-600">
                      This week: {formatHoursAndMinutes(stats.totalLogged)} / {formatHoursAndMinutes(stats.weeklyGoal)}
                    </div>
                  </div>
                  {/* Mini progress ring */}
                  <div className="relative w-14 h-14">
                    <svg className="w-full h-full" viewBox="0 0 36 36" aria-hidden="true">
                      <path
                        stroke="#E5E7EB"
                        strokeWidth="3"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        stroke="#3B82F6"
                        strokeWidth="3"
                        strokeDasharray={`${stats.pct}, 100`}
                        strokeLinecap="round"
                        fill="none"
                        transform="rotate(-90 18 18)"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900">
                      {stats.pct}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Focus Areas</h2>
          <div className={`text-sm whitespace-nowrap ${plannedToday > availableHours ? 'text-red-600' : 'text-gray-600'}`}>
            <span className="font-semibold">{fmt1(plannedToday)}</span> out of {availableHours} hours planned today
          </div>
        </div>
        {overByToday > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
            Your focus area daily goals add up to {fmt1(plannedToday)}hrs (over by {fmt1(overByToday)}hrs). Please reduce one or more daily goals so the total is {availableHours}hrs or less.
          </div>
        )}
        
        <div className="flex flex-col gap-3">
        {[...visibleCategories].reverse().map(({ label, timeSpent, goal, days, color }, index) => {
          // Day-aware progress: use only today's logged time (not weekly total)
          const goalNum = Number(goal ?? 0);
          const daySpent = Number((days?.[todayAbbrev]) ?? 0);
          const percentRaw = goalNum > 0 ? (daySpent / goalNum) * 100 : 0;
          const percent = Math.min(percentRaw, 100).toFixed(0);
          const overAmountRaw = goalNum > 0 ? ((daySpent - goalNum) / goalNum) * 100 : 0;
          const overAmount = daySpent > goalNum ? Math.min(overAmountRaw, 100).toFixed(0) : 0;

          const category = { label, timeSpent, goal, days, color };
          // Insert areaColor constant based on category color
          const areaColor = category?.color || "#8CA4AF";
          // Compute weekday abbreviation from selected date (for use on slug page)
          const selectedDayAbbrev = (() => {
            const d = parseYMD(selectedDate);
            const fromGetDay = ["Su","M","Tu","W","Th","F","Sa"]; // JS getDay() order 0..6
            return fromGetDay[d.getDay()];
          })();
          // For weekly bars: bottom body is 14/21 of height
          const bottomFraction = 14 / 21;
          // For ring center: show actual overage or remaining amount
          const centerAmount = daySpent > goalNum ? (daySpent - goalNum) : (goalNum - daySpent);

          return (
            <div
              key={label}
              onClick={() => {
                setSelectedFocusArea({ label, timeSpent, goal, days, color });
                // Jump to today if it belongs to the currently viewed week; otherwise to Monday of that week.
                const todayLocal = new Date();
                const inThisWeek = todayLocal >= startOfWeek && todayLocal <= endOfWeek;
                setSelectedDateFA(ymd(inThisWeek ? todayLocal : startOfWeek));
              }}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 w-full flex flex-row items-center gap-4 relative cursor-pointer hover:shadow-md transition-shadow duration-200"
            >
              {canEditWeek && (
                <button
                  type="button"
                  className="absolute -top-1 right-2 text-[#4E4034] text-xl px-2"
                  aria-label="Delete or Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameTarget(label);
                    setRenameValue(label);
                    setRenameGoal(goal || 0);
                  }}
                >
                  ⋯
                </button>
              )}
              <div className="flex flex-row items-center gap-5 w-full">
                <div className="flex flex-col items-center w-28">
                  <div
                    className={`${label.length > 12 ? 'text-xs' : 'text-sm'} font-bold text-gray-900 text-center`}
                  >
                    {label}
                  </div>
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path
                        className="text-gray-300"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {/* Progress ring */}
                      <path
                        stroke={hexToRGBA(areaColor, 0.55)}
                        strokeWidth="3"
                        strokeDasharray={`${percent}, 100`}
                        strokeLinecap="round"
                        fill="none"
                        transform="rotate(-90 18 18)"
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {overAmount > 0 && (
                        <g transform="scale(0.88) translate(2.2 2.2)">
                          <path
                            stroke={areaColor}
                            strokeWidth="2.2"
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
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-gray-900 leading-tight">
                      <div className="text-xs">
                        {formatCenterAmount(centerAmount)}
                      </div>
                      <div className="text-[9px] uppercase text-gray-600">
                        {(Number(daySpent || 0) > Number(goalNum || 0)) ? 'OVER' : 'LEFT'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 text-center font-medium">
                    Daily Goal = {fmt1(goal ?? 0)}{hrUnit(goal ?? 0)}
                  </div>
                </div>
                <div className="flex justify-center items-center gap-4 w-full py-3">
                  {daysOfWeek.map((day) => {
                    const spent = (days?.[day] ?? 0);
                    const goalHrs = Number(goal ?? 0);
                    // 0..1 progress of the daily goal
                    const pct = goalHrs > 0 ? Math.min(spent / goalHrs, 1) : 0;
                    const isOver = goalHrs > 0 && spent > goalHrs;
                    return (
                      <div key={day} className="relative flex flex-col items-center">
                        <div className="relative w-5 h-20 flex flex-col items-center justify-end">
                          {/* static track: top cap (6), gap (1), bottom body (14) */}
                          <div className="absolute bottom-0 w-full h-full flex flex-col justify-end">
                            <div
                              className="w-full h-6 rounded-t-sm border border-[#EAECEC] bg-[#DDE5ED]"
                              style={{ backgroundColor: isOver ? areaColor : '#DDE5ED' }}
                            />
                            <div className="h-1" />
                            <div className="w-full h-14 rounded-b-sm border border-[#EAECEC] bg-[#DDE5ED]" />
                          </div>
                          {/* bottom fill only (never spills into the cap) */}
                          <div
                            className="absolute bottom-0 w-full rounded-b-sm"
                            style={{
                              height: `${pct * bottomFraction * 100}%`,
                              backgroundColor: hexToRGBA(areaColor, 0.4)
                            }}
                          />
                        </div>
                        <div className="text-xs text-[#4E4034] text-center mt-1">{day}</div>
                        {isCurrentWeek && day === todayAbbrev ? (
                          <div className="text-[10px] text-[#BCA88F] leading-none mt-1">★</div>
                        ) : (
                          <div className="h-[10px] mt-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {visibleCategories.length === 0 ? (
          canEditWeek ? (
            <>
              {/* Show planning message for next week */}
              {isNextWeek && (
                <div className="mb-2" aria-hidden="true" role="presentation">
                  <div className="w-full rounded-xl bg-[#8CA4AF] text-white py-3 text-center font-medium shadow-sm select-none">
                    Continue working on last week&apos;s focus areas
                  </div>
                </div>
              )}
              {/* Show the example card when there are no focus areas yet (CURRENT or FUTURE weeks) */}
              <div
                onClick={() => { setFormError(""); setShowModal(true); }}
                className="relative bg-white p-3 rounded-xl shadow-md w-full flex flex-row items-center gap-3 opacity-50 cursor-pointer"
              >
                <div className="flex flex-col items-center w-28">
                  <div className="text-sm font-semibold text-[#4E4034] text-center">Add a Focus Area</div>
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full" viewBox="0 0 36 36">
                      <path
                        className="text-gray-300"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        d="M18 2.0845
                           a 15.9155 15.9155 0 0 1 0 31.831
                           a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#4E4034]">
                      0hrs left
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    Daily Goal = 0hrs
                  </div>
                </div>
                <button
                  className="absolute -top-1 right-2 text-[#4E4034] text-xl px-2"
                  aria-label="Focus Area Options"
                  tabIndex={-1}
                  style={{ pointerEvents: 'none', opacity: 1 }}
                >
                  ⋯
                </button>
                <div className="flex justify-between items-end flex-1 mt-2 w-full px-2 py-2">
                  {["M", "Tu", "W", "Th", "F", "Sa", "Su"].map((day) => (
                                          <div key={day} className="relative flex flex-col items-center">
                        <div className="relative w-5 h-20 flex flex-col items-center justify-end">
                          <div className="w-full h-6 rounded-t-sm border border-[#EAECEC] bg-[#DDE5ED]" />
                          <div className="h-1" />
                          <div className="w-full h-14 rounded-b-sm border border-[#EAECEC] bg-[#DDE5ED]" />
                        </div>
                        <div className="text-xs text-[#4E4034] text-center mt-1">{day}</div>
                        {isCurrentWeek && day === todayAbbrev ? (
                          <div className="text-[10px] text-[#BCA88F] leading-none mt-1">★</div>
                        ) : (
                          <div className="h-[10px] mt-1" />
                        )}
                      </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            // Older week with no focus areas—show a read-only notice (NO adding in past weeks)
            <div className="mt-2 w-full rounded-xl border border-gray-200 bg-white text-[#4E4034]/70 py-6 text-center">
              No logged focus areas.
            </div>
          )
        ) : (
          // We have at least one focus area listed above; allow adding in current or future weeks
          canEditWeek ? (
            <>
              <button
                onClick={() => {
                  setFormError("");
                  if (plannedToday >= MAX_DAY_HOURS) {
                    setFormError(`Your focus area daily goals already total ${fmt1(plannedToday)}hrs. Please adjust existing goals so the sum is 24hrs or less before adding another.`);
                    setShowModal(true);
                    return;
                  }
                  setShowModal(true);
                }}
                type="button"
                className="mt-4 w-full rounded-xl bg-[#8CA4AF] text-white py-3 font-semibold shadow-lg hover:bg-[#7A8F9A] active:bg-[#6B7A85] transition-all duration-200"
                aria-label={addBtnLabel}
              >
                + Add another Focus Area
              </button>
            </>
          ) : null
        )}
        </div>
      </div>
    </div>
    {/* Bottom navigation: Dashboard | Calendar | Discover */}
    <div className="fixed bottom-0 left-0 right-0 p-3 pb-7 z-[9999] bg-white">
      <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
        <button
          className="h-12 w-full rounded-2xl bg-gray-900 text-white font-semibold shadow-lg"
          disabled
          aria-current="page"
        >
          Dashboard
        </button>
        <button
          onClick={() => router.push('/calendar')}
          className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm"
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
    {/* Modal for adding a new focus area */}
    {showModal && (
      <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-[90%] max-w-md">
          <h2 className="text-lg font-bold mb-4 text-black">Add a New Focus Area</h2>
          <input
            type="text"
            placeholder="Name"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-3 text-black"
          />
          <div className="mb-2">
            <input
              type="number"
              placeholder="Daily Goal (hours)"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black"
              min={0}
              step={0.25}
              max={Math.max(0, remainingToday)}
            />
            <div className="mt-1 text-xs text-gray-500">
              {fmt1(remainingToday)}hrs available today (out of 24)
            </div>
          </div>
          <div className="mb-4">
            <div className="text-sm text-black mb-2">Color</div>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-7 h-7 rounded-full border"
                  style={{
                    backgroundColor: c,
                    outline: newColor === c ? "2px solid #4E4034" : "none"
                  }}
                  aria-label={`Choose color ${c}`}
                />
              ))}
              <label className="ml-1 text-sm text-black flex items-center gap-2">
                Custom:
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-8 h-8 p-0 border rounded"
                  aria-label="Custom color"
                />
              </label>
            </div>
          </div>
          <div className="mb-4 mt-2">
            <div className="text-sm text-black mb-2">Category</div>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black"
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          {formError ? (
            <div className="mb-3 text-sm text-red-600" role="alert">{formError}</div>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setFormError(""); setShowModal(false); setNewCategory("Other"); }}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const goalNum = parseFloat(newGoal);
                if (!newLabel || isNaN(goalNum) || goalNum <= 0) {
                  setFormError("Please enter a name and a goal greater than 0.");
                  return;
                }
                if (plannedToday + goalNum > MAX_DAY_HOURS) {
                  setFormError(`This would put you over 24hrs today. You have ${fmt1(remainingToday)}hrs available.`);
                  return;
                }
                const updated = [
                  ...categories,
                  {
                    label: newLabel,
                    timeSpent: 0,
                    goal: goalNum,
                    days: [],
                    color: newColor,
                    meta: { category: newCategory }
                  },
                ];
                setCategories(updated);
                saveWeekAndLive(updated);
                setShowModal(false);
                setNewLabel("");
                setNewGoal("");
                setFormError("");
                setNewCategory("Other");
              }}
              className="px-4 py-2 bg-[#BCA88F] text-white rounded"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    )}
    {/* Modal for renaming a focus area */}
    {renameTarget && (
      <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-[90%] max-w-md">
          <h2 className="text-lg font-bold mb-4 text-black">Edit Focus Area</h2>
          <p className="text-sm text-gray-600 mb-3">Changing the name or goal will update it everywhere, including today&apos;s dashboard, your calendar events, and saved notes.</p>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={renameValue}
              onChange={(e)=> setRenameValue(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black"
              placeholder="Focus area name"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Daily Goal (hours)</label>
            <input
              type="number"
              value={renameGoal}
              onChange={(e)=> setRenameGoal(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-black"
              placeholder="0.0"
              min="0"
              step="0.25"
              max="24"
            />
          </div>
          <div className="flex justify-between items-center gap-3">
            <button
              onClick={()=>{ setRenameTarget(null); setRenameValue(""); setRenameGoal(""); }}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={()=>{
                  // open delete confirm using existing flow
                  setDeleteTarget(renameTarget);
                  setRenameTarget(null);
                }}
                className="px-3 py-2 border border-red-400 text-red-600 rounded"
              >
                Delete
              </button>
              <button
                onClick={()=>{
                  const oldName = renameTarget;
                  const newName = (renameValue || "").trim();
                  const newGoal = parseFloat(renameGoal) || 0;
                  
                  if (!newName) return;
                  if (newGoal < 0 || newGoal > 24) {
                    alert("Daily goal must be between 0 and 24 hours.");
                    return;
                  }
                  
                  // prevent duplicates (case-insensitive)
                  const exists = (categories || []).some(c => normalizeLabel(c.label) === normalizeLabel(newName));
                  const same = normalizeLabel(oldName) === normalizeLabel(newName);
                  if (!same && exists){
                    alert("Another focus area already uses that name.");
                    return;
                  }
                  
                  const updated = (categories || []).map(c => c.label === oldName ? { ...c, label: newName, goal: newGoal } : c);
                  setCategories(updated);
                  saveWeekAndLive(updated);
                  // cascade to notes, events, and snapshots
                  cascadeRename(oldName, newName);
                  setRenameTarget(null);
                  setRenameValue("");
                  setRenameGoal("");
                }}
                className="px-4 py-2 bg-[#BCA88F] text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    {/* Modal for confirming deletion of a focus area */}
    {deleteTarget && (
      <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 w-[90%] max-w-md">
          <h2 className="text-lg font-bold mb-4 text-black">Delete Focus Area</h2>
          <p className="mb-6 text-black">Are you sure you want to delete <strong>{deleteTarget}</strong>?</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const target = deleteTarget;
                // 1) Remove the focus area from the list
                const filtered = categories.filter(cat => cat.label !== target);
                setCategories(filtered);
                saveWeekAndLive(filtered);

                // 2) Cascade delete calendar events that belonged to this focus area
                const EVENT_KEYS = ["hourglassEvents:v1", "calendarEvents", "calendar-items", "events"];
                const norm = (s) => (s || "").toString().trim().toLowerCase();
                for (const key of EVENT_KEYS) {
                  try {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;
                    const arr = safeJsonParse(raw, []);
                    if (!Array.isArray(arr)) continue;
                    const cleaned = arr.filter(ev => {
                      const evName = ev.area || ev.focusArea || ev.category || ev.label || "";
                      return norm(evName) !== norm(target);
                    });
                    localStorage.setItem(key, JSON.stringify(cleaned));
                  } catch { /* ignore bad/missing structures */ }
                }
                try { window.dispatchEvent(new Event("calendarEventsUpdated")); } catch (_) {}

                // 3) Close modal
                setDeleteTarget(null);
              }}
              className="px-4 py-2 bg-red-500 text-white rounded"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Floating plus button to link to notes page */}
    <button
      onClick={() => router.push('/notes')}
      className="fixed bottom-20 right-4 bg-[#8CA4AF] text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl shadow-md z-40"
      aria-label="Go to Notes"
    >
      +
    </button>
    </>
  );
}
// Force redeploy

// Main component with Suspense wrapper
export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
