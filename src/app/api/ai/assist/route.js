// src/app/api/ai/assist/route.js
import { NextResponse } from "next/server";

// Run on Node (so we can read env and use standard fetch timeouts, etc.)
export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      userMessage,           // string from the textarea
      focusArea,             // { label, goal, days, color, meta? }
      viewWeekKey,           // e.g., "focusCategories:week:2025-08-11"
      selectedDate,          // "YYYY-MM-DD"
      notes,                 // notes string for this FA-week
      computed               // { todaySpent, leftToday, totalWeek, dailyAverage, weeklyGoal }
    } = body || {};

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing OPENAI_API_KEY on the server." },
        { status: 500 }
      );
    }

    const system = [
      "You are a helpful focus coach with action capabilities.",
      "Only use the numeric values provided. Do not invent data.",
      "When asked to plan: provide a concrete 30–90 minute plan split into steps.",
      "Tone: concise, supportive, actionable.",
      "",
      "🎯 ACTION CAPABILITIES:",
      "You can now take actions for the user. Use these exact formats ONLY when the user specifically requests:",
      "",
      "CREATE_EVENT: [Event Title] | [Time with AM/PM or 24hr] | [Notes including date if not today]",
      "Example: CREATE_EVENT: Morning Run | 6:00 AM | Tomorrow at 6am for 1 hour",
      "Example: CREATE_EVENT: Study Session | 14:00 | Today at 2pm for 90 minutes",
      "",
      "ADJUST_GOAL: [New Goal Hours] | [Reason]", 
      "Example: ADJUST_GOAL: 2.5 | Based on your current progress, this seems more realistic",
      "",
      "SET_REMINDER: [Time HH:MM] | [Message]",
      "Example: SET_REMINDER: 15:00 | Time for your afternoon study session",
      "",
      "UPDATE_NOTES: [New Notes Content]",
      "Example: UPDATE_NOTES: Focus on practice tests in the morning, review in evening",
      "",
      "IMPORTANT: Only use action formats when the user explicitly asks for scheduling, goal adjustments, reminders, or note updates.",
      "For general questions, advice, or planning, give normal helpful responses without action formats.",
      "Always be helpful first, then add actions only when specifically requested.",
    ].join("\n");

    const context = {
      focusArea: {
        label: focusArea?.label || "(unknown)",
        category: focusArea?.meta?.category || "Other",
        goalPerDayHours: Number(focusArea?.goal || 0),
      },
      week: viewWeekKey,
      selectedDate,
      notes: notes || "",
      progress: {
        todaySpentHours: Number(computed?.todaySpent || 0),
        leftTodayHours: Number(computed?.leftToday || 0),
        totalWeekHours: Number(computed?.totalWeek || 0),
        dailyAverageHours: Number(computed?.dailyAverage || 0),
        weeklyGoalHours: Number(computed?.weeklyGoal || 0),
      }
    };

    const messages = [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Context JSON:\n${JSON.stringify(context, null, 2)}\n\nUser:\n${userMessage || "Give me a focused plan for my next session."}`
      }
    ];

    // Call OpenAI REST API directly — no SDK needed
    const payload = { model: "gpt-4o-mini", messages, temperature: 0.3 };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40_000); // 40s safety timeout

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(e?.name === "AbortError" ? "OpenAI request timed out" : (e?.message || "OpenAI request failed"));
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { ok: false, error: `OpenAI error (${res.status}): ${errText || res.statusText}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || "Sorry, I couldn’t produce a response.";
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "AI failed" }, { status: 500 });
  }
}