import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    env: {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      keyLength: process.env.OPENAI_API_KEY?.length || 0
    }
  });
}

export async function POST() {
  return NextResponse.json({ 
    message: 'POST endpoint is working!',
    timestamp: new Date().toISOString()
  });
}
