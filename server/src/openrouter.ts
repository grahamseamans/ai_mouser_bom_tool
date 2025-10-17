export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
export type ChatMessage = {
  role: ChatRole;
  content: string;
  name?: string; // for tool
  tool_call_id?: string; // for tool reply
};

export type ToolSchema = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: any; // JSON Schema
  };
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatResponse = {
  choices: Array<{
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
};

export async function chatWithTools(args: {
  messages: ChatMessage[];
  tools: ToolSchema[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}): Promise<ChatResponse> {
  const key = process.env.OPEN_ROUTER_API_KEY;
  if (!key) throw new Error('OPEN_ROUTER_API_KEY not set');
  const model = args.model || process.env.OPEN_ROUTER_MODEL || 'openai/gpt-4o-mini';

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: args.messages,
      tools: args.tools,
      tool_choice: 'auto',
      temperature: args.temperature ?? 0.2,
      ...(args.max_tokens ? { max_tokens: args.max_tokens } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenRouter error ${res.status}: ${t}`);
  }
  return (await res.json()) as ChatResponse;
}

