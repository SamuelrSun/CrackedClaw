import type { ToolDefinition, AgentContext } from '../runtime';

export const browserTool: ToolDefinition = {
  name: 'browser',
  description: 'Control a browser on the user\'s connected device via Companion app. Requires node pairing.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['navigate', 'click', 'type', 'screenshot', 'snapshot', 'evaluate'],
        description: 'Browser action to perform',
      },
      url: { type: 'string', description: 'URL to navigate to' },
      selector: { type: 'string', description: 'CSS selector for click/type' },
      text: { type: 'string', description: 'Text to type' },
      script: { type: 'string', description: 'JavaScript to evaluate' },
    },
    required: ['action'],
  },
  async execute(_input: unknown, _context: AgentContext): Promise<unknown> {
    return {
      error: 'Browser automation requires a connected Companion device. The user needs to install CrackedClaw Connect and pair their machine. Browser commands are executed locally on the user\'s device via OpenClaw node pairing — not on the server.',
      hint: 'Tell the user to go to Settings → Devices to set up their Companion connection.',
    };
  },
};
