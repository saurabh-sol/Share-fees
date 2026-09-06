import { z } from "zod";
import { gatewayJson, gatewayPreflight, withGatewayCors } from "./cors";
import { anthropicErrorBody } from "./anthropic";
import { geminiErrorBody, parseGeminiPath } from "./gemini";
import { openaiErrorBody, readGatewayApiKey } from "./openai";
import {
  GatewayError,
  handleChatCompletion,
  handleGenerateContent,
  handleListModels,
  handleMessages,
  handleRetrieveModel,
} from "./service";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/origin";

function gatewayErrorResponse(error: unknown) {
  if (error instanceof RateLimitError) {
    return gatewayJson(429, openaiErrorBody("rate_limit_exceeded", 429, "rate_limited"));
  }
  if (error instanceof GatewayError) {
    return gatewayJson(error.status, openaiErrorBody(error.message, error.status));
  }
  if (error instanceof z.ZodError) {
    return gatewayJson(400, openaiErrorBody("invalid_body", 400));
  }
  return gatewayJson(
    400,
    openaiErrorBody("gateway_failed", 400, error instanceof Error ? error.message : "gateway_failed"),
  );
}

export function gatewayOptions() {
  return gatewayPreflight();
}

export async function postChatCompletions(request: Request) {
  try {
    await rateLimitOrThrow(`gateway-ip:${clientIp(request)}`, 60, 60 * 1000);
    const body = await request.json();
    const response = await handleChatCompletion({
      authorization: readGatewayApiKey(request),
      body,
    });
    return withGatewayCors(response);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function postMessages(request: Request) {
  try {
    await rateLimitOrThrow(`gateway-ip:${clientIp(request)}`, 60, 60 * 1000);
    const body = await request.json();
    const response = await handleMessages({
      authorization: readGatewayApiKey(request),
      body,
    });
    return withGatewayCors(response);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return gatewayJson(429, anthropicErrorBody("rate_limit_exceeded", 429, "rate_limited"));
    }
    if (error instanceof GatewayError) {
      return gatewayJson(error.status, anthropicErrorBody(error.message, error.status));
    }
    if (error instanceof z.ZodError) {
      return gatewayJson(400, anthropicErrorBody("invalid_body", 400));
    }
    return gatewayJson(
      400,
      anthropicErrorBody("gateway_failed", 400, error instanceof Error ? error.message : "gateway_failed"),
    );
  }
}

export async function getModels(request: Request) {
  try {
    await rateLimitOrThrow(`gateway-models:${clientIp(request)}`, 60, 60 * 1000);
    const body = await handleListModels({
      authorization: readGatewayApiKey(request),
    });
    return gatewayJson(200, body);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function getModel(request: Request, modelId: string) {
  try {
    await rateLimitOrThrow(`gateway-models:${clientIp(request)}`, 60, 60 * 1000);
    const body = await handleRetrieveModel({
      authorization: readGatewayApiKey(request),
      modelId,
    });
    return gatewayJson(200, body);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

function geminiErrorResponse(error: unknown) {
  if (error instanceof RateLimitError) {
    return gatewayJson(429, geminiErrorBody("rate_limit_exceeded", 429, "rate_limited"));
  }
  if (error instanceof GatewayError) {
    return gatewayJson(error.status, geminiErrorBody(error.message, error.status));
  }
  if (error instanceof z.ZodError) {
    return gatewayJson(400, geminiErrorBody("invalid_body", 400));
  }
  return gatewayJson(
    400,
    geminiErrorBody("gateway_failed", 400, error instanceof Error ? error.message : "gateway_failed"),
  );
}

export async function postGenerateContent(request: Request, model: string) {
  try {
    await rateLimitOrThrow(`gateway-ip:${clientIp(request)}`, 60, 60 * 1000);
    const body = await request.json();
    const response = await handleGenerateContent({
      authorization: readGatewayApiKey(request),
      model,
      body,
    });
    return withGatewayCors(response);
  } catch (error) {
    return geminiErrorResponse(error);
  }
}

export async function dispatchV1Beta(request: Request, method: string, path: string[]) {
  const parsed = parseGeminiPath(path);
  if (method === "POST" && parsed.kind === "openai-chat") {
    return postChatCompletions(request);
  }
  if (method === "GET" && parsed.kind === "models") {
    return getModels(request);
  }
  if (method === "GET" && parsed.kind === "model") {
    return getModel(request, parsed.model);
  }
  if (method === "POST" && parsed.kind === "generate") {
    return postGenerateContent(request, parsed.model);
  }
  if (parsed.kind === "stream") {
    return gatewayJson(400, geminiErrorBody("stream_not_supported", 400));
  }
  return gatewayJson(404, geminiErrorBody("not_found", 404));
}
