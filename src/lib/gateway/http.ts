import { z } from "zod";
import { gatewayJson, gatewayPreflight, withGatewayCors } from "./cors";
import { anthropicErrorBody } from "./anthropic";
import { geminiErrorBody, parseGeminiPath } from "./gemini";
import { openaiErrorBody } from "./openai";
import { PaymentRequiredError, resolveGatewayAuth, resolveModelsAuth } from "./auth";
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

function paymentRequiredResponse(challenge: Response) {
  const headers = new Headers(challenge.headers);
  headers.set("content-type", "application/json");
  return withGatewayCors(
    new Response(challenge.body, {
      status: 402,
      statusText: challenge.statusText,
      headers,
    }),
  );
}

function gatewayErrorResponse(error: unknown) {
  if (error instanceof PaymentRequiredError) {
    return paymentRequiredResponse(error.challenge);
  }
  if (error instanceof RateLimitError) {
    return gatewayJson(429, openaiErrorBody("rate_limit_exceeded", 429, "rate_limited"));
  }
  if (error instanceof GatewayError) {
    const code =
      error.message === "insufficient_credits"
        ? "insufficient_credits"
        : error.message === "payment_required"
          ? "payment_required"
          : error.message;
    return gatewayJson(error.status, openaiErrorBody(code, error.status));
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
    const auth = await resolveGatewayAuth({
      request,
      body,
      route: "chat",
    });
    const response = await handleChatCompletion({
      auth,
      body,
      requestId: crypto.randomUUID(),
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
    const auth = await resolveGatewayAuth({
      request,
      body,
      route: "messages",
    });
    const response = await handleMessages({
      auth,
      body,
      requestId: crypto.randomUUID(),
    });
    return withGatewayCors(response);
  } catch (error) {
    if (error instanceof PaymentRequiredError) {
      return paymentRequiredResponse(error.challenge);
    }
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
    const auth = await resolveModelsAuth({ request });
    const body = await handleListModels({ auth });
    return gatewayJson(200, body);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function getModel(request: Request, modelId: string) {
  try {
    await rateLimitOrThrow(`gateway-models:${clientIp(request)}`, 60, 60 * 1000);
    const auth = await resolveModelsAuth({ request });
    const body = await handleRetrieveModel({ auth, modelId });
    return gatewayJson(200, body);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

function geminiErrorResponse(error: unknown) {
  if (error instanceof PaymentRequiredError) {
    return paymentRequiredResponse(error.challenge);
  }
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
    const auth = await resolveGatewayAuth({
      request,
      body,
      route: "generate",
      modelOverride: model,
    });
    const response = await handleGenerateContent({
      auth,
      model,
      body,
      requestId: crypto.randomUUID(),
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
