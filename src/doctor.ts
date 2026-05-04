export interface DoctorResult {
  node: string;
  npm: string;
  ollama: string;
  modelAvailable: boolean;
  model: string;
}

export async function runDoctor(model: string): Promise<DoctorResult> {
  const [ollama, tags] = await Promise.all([fetchOllamaVersion(), fetchOllamaTags()]);

  return {
    node: process.version,
    npm: detectNpmVersion(),
    ollama,
    modelAvailable: tags.some((tag) => tag.name === model),
    model
  };
}

async function fetchOllamaVersion(): Promise<string> {
  try {
    const response = await fetch("http://localhost:11434/api/version");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as { version?: string };
    return data.version ? `ollama version is ${data.version}` : "ollama version unknown";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ollama check failed: ${message}`);
  }
}

async function fetchOllamaTags(): Promise<Array<{ name: string }>> {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    return (data.models ?? []).flatMap((modelInfo) => (modelInfo.name ? [{ name: modelInfo.name }] : []));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ollama model list failed: ${message}`);
  }
}

function detectNpmVersion(): string {
  const userAgent = process.env.npm_config_user_agent;
  const match = userAgent?.match(/npm\/([^\s]+)/);
  return match ? match[1] : "not detected in current process";
}
