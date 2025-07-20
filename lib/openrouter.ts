// Types for OpenRouter API
export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContentPart = {
  type: "image_url";
  image_url: {
    url: string; // URL or base64 encoded image data
    detail?: string; // Optional, defaults to "auto"
  };
};

export type ContentPart = TextContent | ImageContentPart;

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
};

export type FunctionDescription = {
  description?: string;
  name: string;
  parameters: object; // JSON Schema object
};

export type Tool = {
  type: "function";
  function: FunctionDescription;
};

export type ToolChoice =
  | "none"
  | "auto"
  | {
      type: "function";
      function: {
        name: string;
      };
    };

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type OpenRouterRequestParams = {
  messages?: ChatMessage[];
  prompt?: string;
  model?: string;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: object;
    };
  };
  stop?: string | string[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  tools?: Tool[];
  tool_choice?: ToolChoice;
  seed?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  logit_bias?: { [key: number]: number };
  top_logprobs?: number;
  min_p?: number;
  top_a?: number;
  prediction?: { type: "content"; content: string };
  transforms?: string[];
  models?: string[];
  route?: "fallback";
  provider?: any; // Provider preferences type
  user?: string;
};

export type OpenRouterResponseUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type OpenRouterResponseChoice = {
  finish_reason: string | null;
  native_finish_reason: string | null;
  message: {
    content: string | null;
    role: string;
    tool_calls?: ToolCall[];
  };
  error?: {
    code: number;
    message: string;
    metadata?: Record<string, unknown>;
  };
};

export type OpenRouterResponse = {
  id: string;
  choices: OpenRouterResponseChoice[];
  created: number;
  model: string;
  object: "chat.completion" | "chat.completion.chunk";
  system_fingerprint?: string;
  usage?: OpenRouterResponseUsage;
};

/**
 * Generates text using the OpenRouter API
 * @param params The parameters for text generation
 * @returns Promise with the API response
 */
export async function generateText(
  params: OpenRouterRequestParams
): Promise<string | null> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || "openai/gpt-4",
        ...params,
      }),
    }
  );

  const json: OpenRouterResponse = await response.json();

  return json.choices[0]?.message?.content || null;
}
