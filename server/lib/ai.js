import OpenAI from "openai";

import { AI_MAX_TOKENS, AI_MODEL, AI_TIMEOUT_MS } from "../config.js";
import { createHttpError, isHttpError } from "./errors.js";

const openaiClients = new Map();

function getOpenAIClient(apiKey) {
  if (!apiKey) {
    throw createHttpError(400, "DEEPSEEK_API_KEY 不能为空", { exposeError: false });
  }

  if (!openaiClients.has(apiKey)) {
    openaiClients.set(apiKey, new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    }));
  }

  return openaiClients.get(apiKey);
}

export async function askAI(prompt, options = {}) {
  const {
    apiKey,
    temperature = 0,
    thinking = "disabled",
    model = AI_MODEL,
    maxTokens = AI_MAX_TOKENS,
  } = options;
  let response;

  try {
    response = await getOpenAIClient(apiKey).chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
      thinking: {
        type: thinking,
      },
    }, {
      maxRetries: 1,
      timeout: AI_TIMEOUT_MS,
    });
  } catch (error) {
    if (isHttpError(error)) {
      throw error;
    }

    if (error?.name === "APIConnectionTimeoutError") {
      throw createHttpError(504, "AI 响应超时，请稍后重试", { cause: error });
    }

    const upstreamStatus = Number.isInteger(error?.status) ? error.status : 502;
    const upstreamMessage =
      error?.error?.message ||
      error?.message ||
      "调用 AI 服务失败";

    throw createHttpError(upstreamStatus >= 400 && upstreamStatus < 500 ? upstreamStatus : 502, upstreamMessage, {
      cause: error,
      details: {
        upstreamStatus: error?.status,
        upstreamType: error?.error?.type,
        requestId: error?.request_id,
      },
      exposeError: upstreamStatus < 500,
    });
  }

  const message = response.choices?.[0]?.message;
  const content = message?.content?.trim();
  const reasoningContent = message?.reasoning_content?.trim();

  if (!content && !reasoningContent) {
    throw createHttpError(502, "AI 返回内容为空");
  }

  return content || reasoningContent;
}
