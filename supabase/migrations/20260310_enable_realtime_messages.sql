-- Enable Realtime for messages table (for subagent push notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
