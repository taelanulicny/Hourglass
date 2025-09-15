import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Simple API is working!',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    return NextResponse.json({ 
      message: 'POST to simple API is working!',
      received: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to parse JSON',
      message: error.message 
    }, { status: 400 });
  }
}
