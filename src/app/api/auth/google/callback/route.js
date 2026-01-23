import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// Simple encryption/decryption for cookie storage
// In production, consider using a more robust solution
function encrypt(text) {
  // Simple base64 encoding - for production, use proper encryption
  return Buffer.from(text).toString('base64');
}

function decrypt(encrypted) {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?error=no_code`
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const baseUrl = process.env.NEXTAUTH_URL || 
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${baseUrl}/settings?error=config_error`
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `${baseUrl}/api/auth/google/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${baseUrl}/settings?error=no_token`
      );
    }

    // Get user info to store Google user ID
    oauth2Client.setCredentials({ access_token: tokens.access_token });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    let googleUserId = null;
    try {
      const userInfo = await oauth2.userinfo.get();
      googleUserId = userInfo.data.id;
    } catch (error) {
      console.error('Error getting user info during OAuth:', error);
      // Continue anyway - we can get it later
    }

    // Store tokens in encrypted cookies
    const cookieStore = await cookies();
    
    // Set cookies with httpOnly and secure flags
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    };

    if (tokens.access_token) {
      cookieStore.set('google_access_token', encrypt(tokens.access_token), cookieOptions);
    }
    
    if (tokens.refresh_token) {
      cookieStore.set('google_refresh_token', encrypt(tokens.refresh_token), cookieOptions);
    }
    
    if (tokens.expiry_date) {
      cookieStore.set('google_token_expiry', tokens.expiry_date.toString(), cookieOptions);
    }
    
    if (googleUserId) {
      cookieStore.set('google_user_id', encrypt(googleUserId), cookieOptions);
    }

    return NextResponse.redirect(`${baseUrl}/settings?google_connected=true`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?error=callback_error`
    );
  }
}

