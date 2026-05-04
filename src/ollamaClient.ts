import type { ChatMessage } from "./types.js";

export interface OllamaClientOptions {
  baseUrl?: string;
  model: string;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OllamaClientOptions) {
    this.baseUrl = options.baseUrl ?? "http://localhost:11434";
    this.model = options.model;
  }

  async chatJson(messages: ChatMessage[], schema?: object): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        format: schema ?? "json",
        stream: false
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama chat failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    if (!data.message?.content) {
      throw new Error("Ollama response did not include message.content.");
    }

    return data.message.content;
  }
}
