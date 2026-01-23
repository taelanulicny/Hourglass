import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function decrypt(encrypted) {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

async function getValidAccessToken() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('google_access_token')?.value;
  const refreshToken = cookieStore.get('google_refresh_token')?.value;
  const expiryStr = cookieStore.get('google_token_expiry')?.value;

  if (!accessToken || !refreshToken) {
    return null;
  }

  const decryptedAccessToken = decrypt(accessToken);
  const decryptedRefreshToken = decrypt(refreshToken);
  const expiry = expiryStr ? parseInt(expiryStr, 10) : null;

  // Check if token is expired (with 5 minute buffer)
  const now = Date.now();
  if (expiry && now >= expiry - 5 * 60 * 1000) {
    // Token expired or about to expire, refresh it
    try {
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

      // Update cookies
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      };

      if (credentials.access_token) {
        cookieStore.set('google_access_token', Buffer.from(credentials.access_token).toString('base64'), cookieOptions);
      }

      if (credentials.expiry_date) {
        cookieStore.set('google_token_expiry', credentials.expiry_date.toString(), cookieOptions);
      }

      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  return decryptedAccessToken;
}

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    return NextResponse.json({
      id: userInfo.data.id,
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture,
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    return NextResponse.json(
      { error: 'Failed to get user info' },
      { status: 500 }
    );
  }
}

