import type { ToolDefinition, AgentContext } from '../runtime';
import { execTool } from './exec';
import { browserTool } from './browser';
import { fileReadTool, fileWriteTool } from './files';
import { webSearchTool, webFetchTool } from './web';
import { memorySearchTool, memoryAddTool } from './memory';
import { getIntegrationTokenTool, listIntegrationsTool, scanIntegrationTool } from './integrations';
import { gmailSearchTool, gmailDraftsTool, gmailSendTool, gmailLabelsTool } from './gmail';

export const ALL_TOOLS: ToolDefinition[] = [
  execTool,
  browserTool,
  fileReadTool,
  fileWriteTool,
  webSearchTool,
  webFetchTool,
  memorySearchTool,
  memoryAddTool,
  getIntegrationTokenTool,
  listIntegrationsTool,
  scanIntegrationTool,
  gmailSearchTool,
  gmailDraftsTool,
  gmailSendTool,
  gmailLabelsTool,
];

// All tools always available — agent decides what to use based on context
export function getTools(_context: AgentContext): ToolDefinition[] {
  return ALL_TOOLS;
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
  getIntegrationTokenTool,
  listIntegrationsTool,
  scanIntegrationTool,
  gmailSearchTool,
  gmailDraftsTool,
  gmailSendTool,
  gmailLabelsTool,
};
