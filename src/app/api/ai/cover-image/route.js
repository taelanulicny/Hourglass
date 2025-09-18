import { NextResponse } from 'next/server';

export async function POST(request) {
  // This API is no longer needed since we removed image functionality
  return NextResponse.json({ error: 'Image fetching has been disabled' }, { status: 410 });
}