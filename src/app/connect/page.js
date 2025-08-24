"use client";
import React, { useMemo } from "react";
import Link from "next/link";

// --- Tiny ring component -----------------------------------------------------
function StoryRing({ percent = 0, label = "", tint = "#8CA4AF" }) {
  // 48px ring
  const size = 56;
  const r = 24;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - Math.min(Math.max(percent, 0), 100) / 100);

  return (
    <div className="w-[72px] flex-shrink-0 snap-start flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 56 56" className="block">
        {/* track */}
        <circle cx="28" cy="28" r={r} fill="none" stroke="#ECEAE6" strokeWidth="6" />
        {/* progress */}
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={tint}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          style={{ transition: "stroke-dashoffset 300ms" }}
        />
        {/* % label */}
        <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="600" fill="#4E4034">
          {Math.round(percent)}%
        </text>
      </svg>
      <div className="mt-1 text-[11px] text-[#4E4034] text-center leading-tight truncate w-full">{label}</div>
    </div>
  );
}

// --- Sample feed card --------------------------------------------------------
function FeedCard({ title, children, cta }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="font-semibold text-[#4E4034] mb-1">{title}</div>
      <div className="text-[13px] text-[#6A5E53] mb-3">{children}</div>
      {cta && (
        <button className="px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034] text-sm">
          {cta}
        </button>
      )}
    </div>
  );
}

// --- Focus Area Post (fake share) ------------------------------------------
function FocusAreaPost({
  author = "Alex Kim",
  handle = "@alex",
  title = "Run",
  weekLabel = "Aug 11–17",
  color = "#7EA2B7",
  dailyGoalHrs = 2,
  dayRatios = [1, 1, 1, 1, 1, 1, 1], // 0..1 for M..Su
}) {
  // Calculate weekly percentage (same logic as dashboard)
  const percent = Math.round((dayRatios.reduce((a, b) => a + (b >= 1 ? 1 : 0), 0) / 7) * 100);
  
  // Helper function to convert hex to rgba (matching dashboard)
  const hexToRGBA = (hex, alpha = 0.4) => {
    if (!hex) return `rgba(140, 164, 175, ${alpha})`;
    let h = hex.trim();
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const num = parseInt(h, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Weekly bar component (exact match to dashboard styling)
  const WeeklyBar = ({ ratio = 0, day, isOver = false }) => {
    // Use same bottomFraction calculation as dashboard (14/21)
    const bottomFraction = 14 / 21;
    const pct = Math.min(Math.max(ratio, 0), 1);
    
    return (
      <div className="relative flex flex-col items-center">
        <div className="relative w-5 h-20 flex flex-col items-center justify-end">
          {/* static track: top cap (6), gap (1), bottom body (14) */}
          <div className="absolute bottom-0 w-full h-full flex flex-col justify-end">
            <div
              className="w-full h-6 rounded-t-sm border border-[#EAECEC] bg-[#DDE5ED]"
              style={{ backgroundColor: isOver ? color : '#DDE5ED' }}
            />
            <div className="h-1" />
            <div className="w-full h-14 rounded-b-sm border border-[#EAECEC] bg-[#DDE5ED]" />
          </div>
          {/* bottom fill only (never spills into the cap) */}
          <div
            className="absolute bottom-0 w-full rounded-b-sm"
            style={{
              height: `${pct * bottomFraction * 100}%`,
              backgroundColor: hexToRGBA(color, 0.4)
            }}
          />
        </div>
        <div className="text-xs text-[#4E4034] text-center mt-1">{day}</div>
        <div className="h-[10px] mt-1" />
      </div>
    );
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ECEAE6] grid place-items-center text-sm font-semibold text-[#4E4034]">
            {author.split(" ").map(s => s[0]).join("").slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#4E4034]">{author} <span className="text-[#6A5E53] font-normal">{handle}</span></div>
            <div className="text-xs text-[#6A5E53]">Shared a Focus Area • {weekLabel}</div>
          </div>
        </div>
        <button className="text-xs px-2 py-1 rounded-lg border border-[#4E4034]">Follow</button>
      </div>

      {/* Focus area snapshot - exact match to dashboard styling */}
      <div className="rounded-xl bg-[#F7F6F3] p-3">
        <div className="flex gap-4 items-center">
          {/* Left: label + ring + small texts (same proportions as dashboard) */}
          <div className="flex flex-col items-center w-28">
            <div className="text-sm font-semibold text-[#4E4034] text-center mb-1">{title}</div>
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
                  stroke={hexToRGBA(color, 0.55)}
                  strokeWidth="3"
                  strokeDasharray={`${percent}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 18 18)"
                  d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-[#4E4034] leading-tight">
                <div className="text-sm">{percent}%</div>
                <div className="text-[10px] uppercase text-gray-500">week</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">
              Daily Goal = {dailyGoalHrs}hrs
            </div>
          </div>

          {/* Right: weekly bars (exact match to dashboard) */}
          <div className="flex-1 flex flex-col w-full">
            <div className="flex justify-between items-end flex-1 mt-2 w-full px-2 py-2">
              {["M", "Tu", "W", "Th", "F", "Sa", "Su"].map((day, i) => {
                const ratio = dayRatios[i] || 0;
                const isOver = ratio > 1;
                return (
                  <WeeklyBar key={day} day={day} ratio={ratio} isOver={isOver} />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button className="px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Like</button>
        <button className="px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Comment</button>
        <button className="ml-auto px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Duplicate</button>
      </div>
    </article>
  );
}

export default function ConnectPage() {
  // --- TODO: replace with real “today” values from your store/localStorage ---
  const myToday = useMemo(() => ({ goalMins: 240, spentMins: 36, color: "#7EA2B7", name: "My Progress" }), []);
  const percentMine = useMemo(() => (myToday.goalMins ? (myToday.spentMins / myToday.goalMins) * 100 : 0), [myToday]);

  // Fake follows — later, fetch from /api/connect or local cache
  const follows = [
    { name: "Noah R.", percent: 12, color: "#7EA2B7" },
    { name: "Ava M.", percent: 15, color: "#7EA2B7" },
    { name: "Noah R.", percent: 12, color: "#7EA2B7" },
    { name: "Sam T.", percent: 34, color: "#7EA2B7" },
    { name: "Priya", percent: 68, color: "#7EA2B7" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#4E4034] pb-36">
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-semibold">Connect</h1>
        <p className="text-sm text-[#6A5E53]">See friends’ progress and discover templates & creators.</p>
      </header>

      {/* Stories rail */}
      <section className="px-3">
        <div
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ WebkitOverflowScrolling: "touch" }}
          aria-label="Today progress stories"
        >
          <StoryRing percent={percentMine} label="My Progress" tint={myToday.color} />
          {follows.map((f, i) => (
            <button
              key={i}
              className="appearance-none bg-transparent p-0 m-0"
              title={`${f.name} • ${Math.round(f.percent)}% today`}
              // TODO: later route to /u/[handle] if public
              onClick={() => {}}
            >
              <StoryRing percent={f.percent} label={f.name} tint={f.color} />
            </button>
          ))}
        </div>
        <div className="h-px bg-gray-200 mx-1 mt-2" />
      </section>

      {/* Feed / Discover */}
      <main className="px-4 mt-4 grid gap-4">
        <FocusAreaPost
          author="Jordan Lee"
          handle="@jordan"
          title="Run"
          weekLabel="Aug 11–17"
          color="#7EA2B7"
          dailyGoalHrs={2}
          dayRatios={[1, 1, 1, 1, 1, 1, 1]} // hit goal all 7 days
        />

        <FocusAreaPost
          author="Chris Park"
          handle="@chris"
          title="Study"
          weekLabel="Aug 11–17"
          color="#B7A27E"
          dailyGoalHrs={3}
          dayRatios={[1, 1.3, 1, 0.5, 1, 1, 1]}
        />

        <FeedCard title="Student schedules trending" cta="Explore templates">
          See top-voted daily/weekly schedules shared by students. Duplicate a template and make it yours.
        </FeedCard>

        <FeedCard title="Creators to follow" cta="See suggestions">
          Discover coaches and creators sharing focus-area templates (LSAT, fitness, coding, design, etc.).
        </FeedCard>

        <FeedCard title="Challenges & streaks" cta="Join a challenge">
          Join 7‑day or 21‑day focus challenges with your friends. Keep streaks alive together.
        </FeedCard>
      </main>

      {/* Bottom nav (matches your style) */}
      <nav className="fixed bottom-0 left-0 right-0 p-3 pb-7 z-50">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
        <Link
          href="/"
            className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm grid place-items-center"
        >
          Dashboard
        </Link>
        <Link
          href="/calendar"
            className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm grid place-items-center"
        >
          Calendar
        </Link>
          <button
            className="h-12 w-full rounded-2xl bg-gray-900 text-white font-semibold shadow-lg grid place-items-center"
            aria-current="page"
            disabled
        >
          Connect
          </button>
      </div>
      </nav>
    </div>
  );
}