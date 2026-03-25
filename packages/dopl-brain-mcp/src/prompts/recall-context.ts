/**
 * src/prompts/recall-context.ts
 *
 * MCP prompt: recall-context
 *
 * Returns an instruction telling the AI to check the user's Dopl Brain
 * before answering personal questions or making recommendations.
 */

export function handleRecallContextPrompt(): {
  messages: Array<{
    role: 'user' | 'assistant';
    content: { type: 'text'; text: string };
  }>;
} {
  const text = `Before answering questions about me, my preferences, my history, or making personalized recommendations — please check my Dopl Brain first.

Use brain_recall to search for relevant context. For example:
- If I ask about food or restaurants, recall "dietary preferences food restrictions"
- If I ask about work, recall "work projects job role company"
- If I ask for recommendations, recall relevant preference domains first

Always prefer stored memories over assumptions. If you find relevant memories, reference them explicitly in your answer. If nothing relevant is found, say so and answer based on what I tell you now.`;

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ],
  };
}
