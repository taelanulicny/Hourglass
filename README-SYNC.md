# Cross-Device Sync Setup

This app now supports cross-device synchronization of all your data (focus areas, events, settings, etc.) when you connect Google Calendar.

## How It Works

1. **Connect Google Calendar**: When you connect your Google Calendar account, the app uses your Google account as your unique identifier.

2. **Automatic Sync**: Once connected, your data automatically syncs to the cloud whenever you make changes.

3. **New Device Setup**: When you connect Google Calendar on a new device, your data automatically downloads and merges with any local data.

## Setup Instructions

### 1. Set up Supabase (Required for sync)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run the SQL from `supabase-setup.sql`
4. Go to Settings > API and copy:
   - Project URL (for `NEXT_PUBLIC_SUPABASE_URL`)
   - Service Role Key (for `SUPABASE_SERVICE_ROLE_KEY`) - **Keep this secret!**

### 2. Add Environment Variables

Add these to your Vercel environment variables (or `.env.local` for local development):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Note**: The service role key bypasses Row Level Security, which is needed for the API routes. Make sure to keep it secret and never expose it to the client.

### 3. Deploy

After adding the environment variables, redeploy your app. The sync functionality will automatically work once Google Calendar is connected.

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

