"use client";

import { useEffect, useRef } from 'react';
import { initAutoSync } from '@/lib/autoSync';
import { supabase } from '@/lib/supabaseClient';
import { applySyncedData } from '@/lib/sync';

export default function SyncProvider() {
  const channelRef = useRef(null);

  useEffect(() => {
    initAutoSync();
    return () => {};
  }, []);

  // Realtime: when another device updates user_data, apply the new data here so this device updates almost instantly
  useEffect(() => {
    if (!supabase) return;
    let channel = null;
    async function subscribe() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const userId = session.user.id;
      channel = supabase
        .channel(`user_data:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_data',
            filter: `supabase_user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.new?.data) {
              applySyncedData(payload.new.data);
            }
          }
        )
        .subscribe();
      channelRef.current = channel;
    }
    subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return null;
}

