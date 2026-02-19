# Cross-Device Sync Setup

This app supports cross-device sync of all your data (focus areas, events, settings, etc.) when you **Sign in with Apple** or connect **Google Calendar**.

## How It Works

1. **Sign in with Apple** (recommended): Sign in in Settings. Your data is stored in Supabase keyed by your Apple ID. Sign in on another device with the same Apple ID to see the same data.

2. **Google Calendar**: Alternatively, when you connect Google Calendar, the app can use your Google account as your unique identifier for sync.

3. **Automatic Sync**: Once signed in (Apple or Google), data automatically syncs to the cloud when you make changes.

4. **New Device**: Sign in with the same account on a new device; your data downloads and applies.

## Setup Instructions

### 1. Set up Supabase (Required for sync)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run the SQL from `supabase-setup.sql`
4. If you use **Sign in with Apple**, also run `supabase-migration-apple-sync.sql` in the SQL Editor.
5. Go to Settings > API and copy:
   - Project URL (for `NEXT_PUBLIC_SUPABASE_URL`)
   - Service Role Key (for `SUPABASE_SERVICE_ROLE_KEY`) - **Keep this secret!**

### 2. Add Environment Variables

Add these to your Vercel environment variables (or `.env.local` for local development):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Note**: Use the anon key for client-side Sign in with Apple. The service role key is for API routes only—keep it secret.

### 3. Deploy

After adding the environment variables, redeploy your app. Sync works when you Sign in with Apple or connect Google Calendar.

## Manual Sync

You can also manually sync your data from the Settings page:
- **Download from Cloud**: Downloads and applies data from the cloud (overwrites local)
- **Upload to Cloud**: Uploads your current local data to the cloud

## What Gets Synced

- Focus areas and categories
- All calendar events (local events)
- Google Calendar event customizations (focus area assignments)
- User settings (sleep hours, misc hours, name, profile picture, etc.)
- Week-specific focus area data
- Notes and event notes

## Troubleshooting

- **Sync not working?** Make sure Supabase is set up and environment variables are configured.
- **Data not appearing?** Try manually downloading from cloud in Settings.
- **Conflicts?** The app uses a "server wins" strategy by default - the cloud data takes precedence when syncing.

