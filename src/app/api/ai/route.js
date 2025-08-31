import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { messages, focusContext } = await req.json();

    // Build a minimal system prompt that forbids actions/mutations
    const system = [
      "You are a friendly productivity coach. Reply in clean Markdown.",
      "Use short sections with ### headings, bullet lists (- item), numbered steps (1.), and checklists (- [ ]).",
      "Keep answers clear and visually scannable. Avoid dumping one big block of text.",
      "Do not include triple backticks unless explicitly asked for code."
    ].join(" ");

    // Optionally include readonly context for better suggestions
    const contextNote = focusContext
      ? `Context:\nFocus Area: ${focusContext?.name}\nDaily Goal: ${focusContext?.goal}h\nThis week logged: ${focusContext?.weekLogged}h\nLeft today: ${focusContext?.leftToday}h`
      : "";

    const body = {
      model: "gpt-4o-mini", // or your preferred small chat model
      messages: [
        { role: "system", content: system },
        ...(contextNote ? [{ role: "system", content: contextNote }] : []),
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
