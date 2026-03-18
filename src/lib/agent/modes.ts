export interface AgentMode {
  id: string;
  label: string;
  emoji: string;
  description: string;
  systemPromptSuffix: string;
  // If set, only these tool prefixes are allowed
  allowedToolPrefixes?: string[];
}

export const AGENT_MODES: Record<string, AgentMode> = {
  agent: {
    id: "agent",
    label: "Agent",
    emoji: "🤖",
    description: "General purpose — full tool access",
    systemPromptSuffix: "You have access to all available tools. Use them proactively to complete your task.",
  },
  research: {
    id: "research",
    label: "Research",
    emoji: "🔍",
    description: "Web research and information gathering",
    systemPromptSuffix: "You are in Research mode. Focus on finding and synthesizing information. Use web search and fetch tools extensively. Present findings clearly with sources.",
    allowedToolPrefixes: ["web_search", "web_fetch", "browser", "memory"],
  },
  code: {
    id: "code",
    label: "Code",
    emoji: "💻",
    description: "Code writing, review, and execution",
    systemPromptSuffix: "You are in Code mode. Focus on writing, reviewing, and executing code. Use file and exec tools. Write clean, well-documented code.",
    allowedToolPrefixes: ["exec", "file_read", "file_write", "web_search", "web_fetch"],
  },
  browse: {
    id: "browse",
    label: "Browse",
    emoji: "🌐",
    description: "Browser automation and web interaction",
    systemPromptSuffix: "You are in Browse mode. Focus on browser automation. Navigate websites, fill forms, extract data, and interact with web applications.",
    allowedToolPrefixes: ["browser", "web_search", "web_fetch"],
  },
  email: {
    id: "email",
    label: "Email",
    emoji: "📧",
    description: "Email management and communication",
    systemPromptSuffix: "You are in Email mode. Focus on email tasks — reading, drafting, sending, and organizing emails. Be careful with sending — always confirm important emails.",
    allowedToolPrefixes: ["gmail", "web_search", "memory"],
  },
};

export function getModeById(id: string): AgentMode {
  return AGENT_MODES[id] || AGENT_MODES.agent;
}
