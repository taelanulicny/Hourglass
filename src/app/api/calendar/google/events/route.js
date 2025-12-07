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
        cookieStore.set('google_access_token', encrypt(credentials.access_token), cookieOptions);
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeMin = searchParams.get('timeMin'); // ISO 8601 string
    const timeMax = searchParams.get('timeMax'); // ISO 8601 string

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: 'timeMin and timeMax parameters are required' },
        { status: 400 }
      );
    }

    const accessToken = await getValidAccessToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect Google Calendar.' },
        { status: 401 }
      );
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500, // Google Calendar API limit
    });

    const googleEvents = response.data.items || [];

    // Convert Google Calendar events to your app's event format
    const convertedEvents = googleEvents.map((event) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      
      // Convert to timestamp (milliseconds)
      let startMs, endMs;
      
      if (event.start.dateTime) {
        // Timed event
        startMs = new Date(start).getTime();
        endMs = new Date(end).getTime();
      } else {
        // All-day event
        const startDate = new Date(start);
        startDate.setHours(0, 0, 0, 0);
        startMs = startDate.getTime();
        
        const endDate = new Date(end);
        endDate.setHours(0, 0, 0, 0);
        // All-day events end at the start of the next day, so subtract 1 day
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        endMs = endDate.getTime();
      }

      return {
        id: `google_${event.id}`,
        title: event.summary || '(No title)',
        area: '', // Google events don't have focus areas
        start: startMs,
        end: endMs,
        color: '#4285F4', // Google blue, or you could map colorId
        notes: event.description || '',
        source: 'google', // Mark as Google event
        googleEventId: event.id,
      };
    });

    return NextResponse.json({ events: convertedEvents });
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error);
    
    if (error.code === 401) {
      return NextResponse.json(
        { error: 'Authentication failed. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch Google Calendar events' },
      { status: 500 }
    );
  }
}

