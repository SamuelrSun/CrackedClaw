import Anthropic from '@anthropic-ai/sdk';

export interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (input: unknown, context: AgentContext) => Promise<unknown>;
}

export interface AgentContext {
  userId: string;
  orgId: string;
  conversationId: string;
  companionConnected: boolean;
  integrations: string[];
}

export interface ToolResult {
  toolName: string;
  input: unknown;
  output: unknown;
  error?: string;
}

export interface ChatResult {
  response: string;
  toolResults: ToolResult[];
  usage: { inputTokens: number; outputTokens: number };
}

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_start'; toolName: string; input: unknown }
  | { type: 'tool_result'; toolName: string; output: unknown; error?: string }
  | { type: 'done'; conversation_id?: string }
  | { type: 'error'; message: string };

type AnthropicMessage = Anthropic.MessageParam;

export class AgentRuntime {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    config: AgentConfig,
    messages: AnthropicMessage[],
    context: AgentContext,
  ): Promise<ChatResult> {
    const toolDefs = config.tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));

    const allMessages: AnthropicMessage[] = [...messages];
    const toolResults: ToolResult[] = [];
    let totalInput = 0;
    let totalOutput = 0;

    while (true) {
      const response = await this.client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens ?? 8192,
        system: config.systemPrompt,
        tools: toolDefs,
        messages: allMessages,
      });

      totalInput += response.usage.input_tokens;
      totalOutput += response.usage.output_tokens;

      const textBlocks = response.content.filter(b => b.type === 'text');
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');

      if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        const responseText = textBlocks.map(b => (b as Anthropic.TextBlock).text).join('');
        return {
          response: responseText,
          toolResults,
          usage: { inputTokens: totalInput, outputTokens: totalOutput },
        };
      }

      allMessages.push({ role: 'assistant', content: response.content });

      const toolResultContents: Anthropic.ToolResultBlockParam[] = await Promise.all(
        (toolUseBlocks as Anthropic.ToolUseBlock[]).map(async block => {
          const toolDef = config.tools.find(t => t.name === block.name);
          let output: unknown;
          let errorMsg: string | undefined;

          if (!toolDef) {
            errorMsg = `Tool "${block.name}" not found`;
            output = { error: errorMsg };
          } else {
            try {
              output = await toolDef.execute(block.input, context);
            } catch (err) {
              errorMsg = err instanceof Error ? err.message : String(err);
              output = { error: errorMsg };
            }
          }

          toolResults.push({ toolName: block.name, input: block.input, output, error: errorMsg });

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: typeof output === 'string' ? output : JSON.stringify(output),
          };
        }),
      );

      allMessages.push({ role: 'user', content: toolResultContents });
    }
  }

  async *chatStream(
    config: AgentConfig,
    messages: AnthropicMessage[],
    context: AgentContext,
  ): AsyncGenerator<StreamEvent> {
    const toolDefs = config.tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));

    const allMessages: AnthropicMessage[] = [...messages];

    while (true) {
      const stream = this.client.messages.stream({
        model: config.model,
        max_tokens: config.maxTokens ?? 8192,
        system: config.systemPrompt,
        tools: toolDefs,
        messages: allMessages,
      });

      let currentToolName = '';
      let currentToolId = '';
      let currentToolInputJson = '';
      let inToolUse = false;

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'text') {
            inToolUse = false;
          } else if (block.type === 'tool_use') {
            inToolUse = true;
            currentToolName = block.name;
            currentToolId = block.id;
            currentToolInputJson = '';
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            yield { type: 'token', text: delta.text };
          } else if (delta.type === 'input_json_delta') {
            currentToolInputJson += delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (inToolUse) {
            let parsedInput: unknown = {};
            try { parsedInput = JSON.parse(currentToolInputJson); } catch { /* ignore */ }
            yield { type: 'tool_start', toolName: currentToolName, input: parsedInput };
            inToolUse = false;
          }
        }
      }

      const finalMsg = await stream.finalMessage();
      const toolUseBlocks = finalMsg.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

      if (finalMsg.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
        yield { type: 'done' };
        return;
      }

      allMessages.push({ role: 'assistant', content: finalMsg.content });

      const toolResultContents: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        const toolDef = config.tools.find(t => t.name === block.name);
        let output: unknown;
        let errorMsg: string | undefined;

        if (!toolDef) {
          errorMsg = `Tool "${block.name}" not found`;
          output = { error: errorMsg };
        } else {
          try {
            output = await toolDef.execute(block.input, context);
          } catch (err) {
            errorMsg = err instanceof Error ? err.message : String(err);
            output = { error: errorMsg };
          }
        }

        yield { type: 'tool_result', toolName: block.name, output, error: errorMsg };
        toolResultContents.push({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: typeof output === 'string' ? output : JSON.stringify(output),
        });
      }

      allMessages.push({ role: 'user', content: toolResultContents });
    }
  }
}
