import type { ToolDefinition, AgentContext } from '../runtime';
import { execTool } from './exec';
import { browserTool } from './browser';
import { fileReadTool, fileWriteTool } from './files';
import { webSearchTool, webFetchTool } from './web';
import { memorySearchTool, memoryAddTool } from './memory';
import { sendEmailTool, readCalendarTool, createEventTool } from './integrations';

export const ALL_TOOLS: ToolDefinition[] = [
  execTool,
  browserTool,
  fileReadTool,
  fileWriteTool,
  webSearchTool,
  webFetchTool,
  memorySearchTool,
  memoryAddTool,
  sendEmailTool,
  readCalendarTool,
  createEventTool,
];

/**
 * Returns the appropriate set of tools for the given context.
 * Filters tools based on connected integrations.
 */
export function getTools(context: AgentContext): ToolDefinition[] {
  return ALL_TOOLS.filter(tool => {
    // Integration-specific tools only available if integration is connected
    if (tool.name === 'send_email' || tool.name === 'read_calendar' || tool.name === 'create_event') {
      return context.integrations.some(i => i === 'google' || i === 'microsoft');
    }
    return true;
  });
}

export {
  execTool,
  browserTool,
  fileReadTool,
  fileWriteTool,
  webSearchTool,
  webFetchTool,
  memorySearchTool,
  memoryAddTool,
  sendEmailTool,
  readCalendarTool,
  createEventTool,
};
