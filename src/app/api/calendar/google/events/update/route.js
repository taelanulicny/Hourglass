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

export async function PUT(request) {
  try {
    const body = await request.json();
    const { eventId, title, start, end, description } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      );
    }

    // Extract the actual Google event ID (remove 'google_' prefix if present)
    const googleEventId = eventId.startsWith('google_') ? eventId.substring(7) : eventId;

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

    // First, get the existing event to preserve other fields
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: googleEventId,
    });

    // Prepare the update
    const updatedEvent = {
      ...existingEvent.data,
      summary: title || existingEvent.data.summary,
      description: description !== undefined ? description : existingEvent.data.description,
    };

    // Update start and end times
    if (start) {
      const startDate = new Date(start);
      // Check if original event was all-day
      if (existingEvent.data.start.date) {
        // Keep as all-day event
        updatedEvent.start = { date: startDate.toISOString().split('T')[0] };
        // Remove timezone if it was there
        if (updatedEvent.start.timeZone) {
          delete updatedEvent.start.timeZone;
        }
      } else {
        // Timed event - preserve timezone from original event or use UTC
        const timeZone = existingEvent.data.start.timeZone || 'UTC';
        updatedEvent.start = { 
          dateTime: startDate.toISOString(),
          timeZone: timeZone
        };
      }
    }

    if (end) {
      const endDate = new Date(end);
      // Check if original event was all-day
      if (existingEvent.data.end.date) {
        // Keep as all-day event - add 1 day for all-day events
        const endDateOnly = new Date(endDate);
        endDateOnly.setDate(endDateOnly.getDate() + 1);
        updatedEvent.end = { date: endDateOnly.toISOString().split('T')[0] };
        // Remove timezone if it was there
        if (updatedEvent.end.timeZone) {
          delete updatedEvent.end.timeZone;
        }
      } else {
        // Timed event - preserve timezone from original event or use UTC
        const timeZone = existingEvent.data.end.timeZone || 'UTC';
        updatedEvent.end = { 
          dateTime: endDate.toISOString(),
          timeZone: timeZone
        };
      }
    }

    console.log('Updating Google Calendar event:', {
      eventId: googleEventId,
      title: updatedEvent.summary,
      start: updatedEvent.start,
      end: updatedEvent.end,
    });

    // Update the event
    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: updatedEvent,
    });

    console.log('Google Calendar event updated successfully');

    return NextResponse.json({ success: true, event: response.data });
  } catch (error) {
    console.error('Error updating Google Calendar event:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });
    
    if (error.code === 401 || error.response?.status === 401) {
      return NextResponse.json(
        { error: 'Authentication failed. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    // Provide more specific error messages
    let errorMessage = 'Failed to update Google Calendar event';
    if (error.code === 403) {
      errorMessage = 'Permission denied. The current token does not have write access. Please disconnect and reconnect Google Calendar.';
    } else if (error.code === 404) {
      errorMessage = 'Event not found. It may have been deleted from Google Calendar.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: error.message,
        code: error.code
      },
      { status: error.code || 500 }
    );
  }
}

