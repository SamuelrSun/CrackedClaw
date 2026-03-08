export interface WorkflowSuggestion {
  shouldSuggest: boolean;
  name?: string;
  description?: string;
  prompt?: string;
  triggerPhrases?: string[];
}

/**
 * Analyze conversation messages to determine if a workflow should be suggested.
 * Returns a suggestion if the conversation has 5+ messages and involves
 * a multi-step task with automation keywords.
 */
export function analyzeForWorkflow(
  messages: Array<{ role: string; content: string }>
): WorkflowSuggestion {
  if (messages.length < 5) return { shouldSuggest: false };

  const allText = messages.map((m) => m.content).join(" ").toLowerCase();
  const automationKeywords = [
    "automate",
    "every",
    "schedule",
    "recurring",
    "each time",
    "whenever",
    "regularly",
    "daily",
    "weekly",
    "repeat",
  ];

  const hasAutomationIntent = automationKeywords.some((kw) =>
    allText.includes(kw)
  );
  if (!hasAutomationIntent) return { shouldSuggest: false };

  const firstUserMsg =
    messages.find((m) => m.role === "user")?.content || "";
  const name = firstUserMsg.slice(0, 50).trim();

  return {
    shouldSuggest: true,
    name: `Workflow: ${name}`,
    description: "Auto-detected repeatable task",
    prompt: messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n"),
    triggerPhrases: [],
  };
}
