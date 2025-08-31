// Force serverless runtime and prevent static optimization
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { messages, focusContext } = await req.json();
    const system = [
      "You are a friendly productivity coach. Reply in clean Markdown.",
      "No scheduling or data mutations; text advice only."
    ].join(" ");

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        ...(focusContext ? [{ role: "system", content: `Context: ${JSON.stringify(focusContext)}` }] : []),
        ...messages
      ],
      temperature: 0.7
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: err }, { status: 500 });
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Optional: Add a GET for quick health checks in production
export async function GET() {
  return NextResponse.json({ ok: true, route: '/api/ai' });
}
