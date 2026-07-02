import { NextResponse } from "next/server";

type GenerateRequest = {
  prompt?: string;
  apiKey?: string;
  model?: string;
  quality?: string;
  background?: string;
};

type OpenRouterImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
    media_type?: string;
  }>;
  usage?: {
    cost?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: string;
  };
};

const OPENROUTER_IMAGES_URL = "https://openrouter.ai/api/v1/images";
const DEFAULT_MODEL = "openai/gpt-image-1-mini";

export async function POST(request: Request) {
  const started = performance.now();
  const body = (await request.json()) as GenerateRequest;
  const prompt = String(body.prompt || "").trim();
  const apiKey = String(body.apiKey || process.env.OPENROUTER_API_KEY || "").trim();
  const model = String(body.model || DEFAULT_MODEL).trim();
  const quality = String(body.quality || "low").trim();
  const background = String(body.background || "auto").trim();

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "OpenRouter API key is required." }, { status: 400 });
  }

  const requestBody: Record<string, unknown> = {
    model,
    prompt,
    n: 1
  };
  if (model.startsWith("openai/")) {
    requestBody.quality = quality;
    requestBody.background = background;
  } else if (model.includes("flux")) {
    requestBody.output_format = "png";
  }

  const response = await fetch(OPENROUTER_IMAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/imagent-ai/imagent",
      "X-OpenRouter-Title": "imagent playground"
    },
    body: JSON.stringify(requestBody)
  });

  const text = await response.text();
  let payload: OpenRouterImageResponse;
  try {
    payload = JSON.parse(text) as OpenRouterImageResponse;
  } catch {
    payload = {};
  }

  if (!response.ok || payload.error) {
    return NextResponse.json(
      {
        error: payload.error?.message || text || `OpenRouter request failed with HTTP ${response.status}`,
        code: payload.error?.code || String(response.status)
      },
      { status: response.status || 502 }
    );
  }

  const first = payload.data?.find((item) => item.b64_json || item.url);
  if (!first) {
    return NextResponse.json({ error: "OpenRouter did not return an image." }, { status: 502 });
  }

  const mediaType = first.media_type || "image/png";
  const imageUrl = first.b64_json ? `data:${mediaType};base64,${first.b64_json}` : first.url;

  return NextResponse.json({
    imageUrl,
    mediaType,
    model,
    costUsd: Number(payload.usage?.cost || 0),
    latencyMs: Math.round((performance.now() - started) * 1000) / 1000
  });
}
