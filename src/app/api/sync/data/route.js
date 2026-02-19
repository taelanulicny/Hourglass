import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Get user id from Supabase Auth JWT (Sign in with Apple).
 */
async function getSupabaseUserId(request) {
  if (!supabase) return null;
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.id) return null;
    return user.id;
  } catch {
    return null;
  }
}

// GET - Fetch user data
export async function GET(request) {
  try {
    const userId = await getSupabaseUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('supabase_user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
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
    }

    return NextResponse.json({
      data: null,
      lastSynced: null,
    });
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
    const userId = await getSupabaseUserId(request);
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
      const { error } = await supabase
        .from('user_data')
        .upsert(
          {
            supabase_user_id: userId,
            data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'supabase_user_id' }
        );

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json(
          { error: 'Failed to save data' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    console.warn('Supabase not configured - data not saved');
    return NextResponse.json({ success: true, warning: 'Supabase not configured' });
  } catch (error) {
    console.error('Error saving sync data:', error);
    return NextResponse.json(
      { error: 'Failed to save data' },
      { status: 500 }
    );
  }
}
