-- Enable Realtime for user_data so other devices get updates almost instantly
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

ALTER PUBLICATION supabase_realtime ADD TABLE user_data;
