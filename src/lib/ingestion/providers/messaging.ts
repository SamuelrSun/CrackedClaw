/**
 * Messaging providers adapter (WhatsApp, Telegram, iMessage)
 *
 * These don't use OAuth — they work through the user's connected Mac node.
 * This module provides structured instructions so the agent knows exactly
 * how to scan each provider using node capabilities.
 */

export interface MessagingScanInstructions {
  needsNode: true;
  provider: string;
  instructions: string;
  capabilities: string[];
}

export function getMessagingScanInstructions(provider: string): MessagingScanInstructions {
  switch (provider) {
    case 'imessage':
      return {
        needsNode: true,
        provider: 'imessage',
        instructions: [
          'Connect to the user\'s Mac node via the nodes tool.',
          'Run: imsg chats list  — to get all active chats.',
          'For each of the top 10 most recent chats, run: imsg history <chat_id> --limit 20',
          'Extract: active contacts (names/numbers), common topics, message frequency.',
          'Summarize communication patterns and key contacts.',
        ].join('\n'),
        capabilities: ['messages', 'contacts', 'history'],
      };

    case 'whatsapp':
      return {
        needsNode: true,
        provider: 'whatsapp',
        instructions: [
          'Connect to the user\'s Mac node via the nodes tool.',
          'Check if WhatsApp is configured: read ~/openclaw.json and look for a whatsapp channel entry.',
          'If WhatsApp channel is connected, you can receive and send messages through it.',
          'To get conversation history, check if the WhatsApp OpenClaw channel has message history.',
          'Note: Full chat scanning requires the user to have the WhatsApp channel plugin active.',
        ].join('\n'),
        capabilities: ['messages', 'groups', 'status'],
      };

    case 'telegram':
      return {
        needsNode: true,
        provider: 'telegram',
        instructions: [
          'Connect to the user\'s Mac node via the nodes tool.',
          'Check if Telegram is configured: read ~/openclaw.json and look for a telegram channel entry.',
          'If Telegram channel is connected, message history may be accessible through the channel plugin.',
          'To scan chats: check if the Telegram bot has access to recent conversations.',
          'Note: Full chat scanning requires the user to have the Telegram channel plugin active.',
        ].join('\n'),
        capabilities: ['messages', 'groups', 'channels', 'bots'],
      };

    default:
      return {
        needsNode: true,
        provider,
        instructions: `No specific node-based scan instructions available for provider: ${provider}. Check if an OpenClaw channel plugin is configured for this provider on the user's Mac node.`,
        capabilities: ['messages'],
      };
  }
}
