import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function decrypt(encrypted) {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('google_access_token')?.value;
    const refreshToken = cookieStore.get('google_refresh_token')?.value;

    const isConnected = !!(accessToken && refreshToken);

    return NextResponse.json({ 
      connected: isConnected,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });
  } catch (error) {
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}

