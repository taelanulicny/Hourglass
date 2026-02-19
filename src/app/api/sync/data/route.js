import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

function decrypt(encrypted) {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Get user id from Supabase Auth JWT (Sign in with Apple).
 * Returns { userId, useSupabaseId } or { userId: null, useSupabaseId: false }.
 */
async function getSupabaseUserId(request) {
  if (!supabase) return { userId: null, useSupabaseId: false };
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return { userId: null, useSupabaseId: false };
  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.id) return { userId: null, useSupabaseId: false };
    return { userId: user.id, useSupabaseId: true };
  } catch {
    return { userId: null, useSupabaseId: false };
  }
}

async function getGoogleUserId() {
  const cookieStore = await cookies();
  
  // First, try to get the stored Google user ID from cookie (set during OAuth callback)
  const storedUserId = cookieStore.get('google_user_id')?.value;
  if (storedUserId) {
    const decryptedUserId = decrypt(storedUserId);
    if (decryptedUserId) {
      return decryptedUserId;
    }
  }

  // Fallback: Get user ID from Google API if not stored
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
  let validAccessToken = decryptedAccessToken;
  
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
        validAccessToken = credentials.access_token;
        cookieStore.set('google_access_token', Buffer.from(credentials.access_token).toString('base64'), cookieOptions);
      }

      if (credentials.expiry_date) {
        cookieStore.set('google_token_expiry', credentials.expiry_date.toString(), cookieOptions);
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  // Get user info with valid token
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: validAccessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userId = userInfo.data.id;
    
    // Store the user ID in a cookie for future use
    if (userId) {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      };
      cookieStore.set('google_user_id', Buffer.from(userId).toString('base64'), cookieOptions);
    }
    
    return userId;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

// GET - Fetch user data
export async function GET(request) {
  try {
    const { userId: supabaseUserId, useSupabaseId } = await getSupabaseUserId(request);
    const googleUserId = await getGoogleUserId();
    const userId = supabaseUserId || googleUserId;
    const useSupabase = !!useSupabaseId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (supabase) {
      const { data, error } = useSupabase
        ? await supabase.from('user_data').select('*').eq('supabase_user_id', userId).single()
        : await supabase.from('user_data').select('*').eq('google_user_id', userId).single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Supabase error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch data' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: data?.data || null,
        lastSynced: data?.updated_at || null,
      });
    } else {
      // Fallback: return empty data if Supabase not configured
      return NextResponse.json({
        data: null,
        lastSynced: null,
      });
    }
  } catch (error) {
    console.error('Error fetching sync data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

// POST - Save user data
export async function POST(request) {
  try {
    const { userId: supabaseUserId, useSupabaseId } = await getSupabaseUserId(request);
    const googleUserId = await getGoogleUserId();
    const userId = supabaseUserId || googleUserId;
    const useSupabase = !!useSupabaseId;

    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    if (supabase) {
      const row = {
        data,
        updated_at: new Date().toISOString(),
      };
      if (useSupabase) {
        row.supabase_user_id = userId;
      } else {
        row.google_user_id = userId;
      }
      const { error } = await supabase
        .from('user_data')
        .upsert(row, {
          onConflict: useSupabase ? 'supabase_user_id' : 'google_user_id',
        });

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json(
          { error: 'Failed to save data' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    } else {
      // Fallback: return success even if Supabase not configured
      // In production, you should configure Supabase
      console.warn('Supabase not configured - data not saved');
      return NextResponse.json({ success: true, warning: 'Supabase not configured' });
    }
  } catch (error) {
    console.error('Error saving sync data:', error);
    return NextResponse.json(
      { error: 'Failed to save data' },
      { status: 500 }
    );
  }
}

