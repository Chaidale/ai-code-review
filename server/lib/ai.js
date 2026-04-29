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
  const { apiKey, temperature = 0.3, thinking = "disabled" } = options;
  let response;

  try {
    response = await getOpenAIClient(apiKey).chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: AI_MAX_TOKENS,
      temperature,
      extra_body: {
        thinking: {
          type: thinking,
        },
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

    throw createHttpError(502, "调用 AI 服务失败", { cause: error });
  }

  const content = response.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw createHttpError(502, "AI 返回内容为空");
  }

  return content;
}
