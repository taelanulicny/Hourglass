import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';

function decrypt(encrypted) {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

function encrypt(text) {
  return Buffer.from(text).toString('base64');
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('google_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 401 }
      );
    }

    const decryptedRefreshToken = decrypt(refreshToken);
    if (!decryptedRefreshToken) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.NEXTAUTH_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${baseUrl}/api/auth/google/callback`
    );

    oauth2Client.setCredentials({
      refresh_token: decryptedRefreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update cookies with new tokens
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    };

    if (credentials.access_token) {
      cookieStore.set('google_access_token', encrypt(credentials.access_token), cookieOptions);
    }

    if (credentials.expiry_date) {
      cookieStore.set('google_token_expiry', credentials.expiry_date.toString(), cookieOptions);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}

