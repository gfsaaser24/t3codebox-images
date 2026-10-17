// Sits between T3 Code's usage hub client and CLIProxyAPI. Everything passes through untouched, except T3's
// Claude usage read (api-call to https://api.anthropic.com/api/oauth/usage). Long-lived Claude Code tokens
// (`claude setup-token`) have only the user:inference scope, so that endpoint refuses them (403 user:profile).
// The same token still gets the unified rate-limit headers on any Messages call, so on a refusal the shim makes
// a 1-token request through the hub and answers T3 with those numbers in the /api/oauth/usage shape.
"use strict";

const http = require("node:http");

const LISTEN_PORT = Number(process.env.SHIM_PORT || 8318);
const HUB = new URL(process.env.HUB_URL || "http://127.0.0.1:8317");
const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map(); // auth_index -> { at, body }

function hubRequest(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: HUB.hostname, port: HUB.port, method, path, headers: { ...headers, host: HUB.host } },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      },
    );
    request.on("error", reject);
    request.setTimeout(30_000, () => request.destroy(new Error("hub timeout")));
    if (body) request.write(body);
    request.end();
  });
}

const header = (headers, name) => {
  const value = headers?.[name] ?? headers?.[Object.keys(headers || {}).find((key) => key.toLowerCase() === name)];
  return Array.isArray(value) ? value[0] : value;
};

function window(headers, prefix) {
  const utilization = Number(header(headers, `anthropic-ratelimit-unified-${prefix}-utilization`));
  if (!Number.isFinite(utilization)) return null;
  const reset = Number(header(headers, `anthropic-ratelimit-unified-${prefix}-reset`));
  return {
    utilization: Math.round(utilization * 1000) / 10, // header is 0-1, /api/oauth/usage is 0-100
    resets_at: Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000).toISOString() : null,
  };
}

// Usage from the rate-limit headers of a minimal Messages request made with the account's own token.
async function usageFromHeaders(authHeader, authIndex) {
  const probe = {
    auth_index: authIndex,
    method: "POST",
    url: "https://api.anthropic.com/v1/messages",
    header: {
      Authorization: "Bearer $TOKEN$",
      "anthropic-beta": "oauth-2025-04-20",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    data: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1,
      system: "You are Claude Code, Anthropic's official CLI for Claude.",
      messages: [{ role: "user", content: "." }],
    }),
  };
  const response = await hubRequest(
    "POST",
    "/v0/management/api-call",
    { authorization: authHeader, "content-type": "application/json" },
    JSON.stringify(probe),
  );
  const result = JSON.parse(response.body.toString("utf8"));
  const five_hour = window(result.header, "5h");
  const seven_day = window(result.header, "7d");
  if (!five_hour && !seven_day) return null;
  return JSON.stringify({ five_hour, seven_day });
}

async function handleUsageCall(request, body, call) {
  const authHeader = request.headers.authorization || "";
  const cached = cache.get(call.auth_index);
  if (cached && Date.now() - cached.at < CACHE_MS) return { status_code: 200, header: {}, body: cached.body };

  const direct = await hubRequest("POST", request.url, { authorization: authHeader, "content-type": "application/json" }, body);
  const directResult = JSON.parse(direct.body.toString("utf8"));
  if (directResult.status_code >= 200 && directResult.status_code < 300) {
    cache.set(call.auth_index, { at: Date.now(), body: directResult.body });
    return directResult;
  }
  const fallback = await usageFromHeaders(authHeader, call.auth_index);
  if (!fallback) return directResult;
  cache.set(call.auth_index, { at: Date.now(), body: fallback });
  return { status_code: 200, header: {}, body: fallback };
}

http
  .createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    try {
      if (request.method === "POST" && request.url.split("?")[0] === "/v0/management/api-call") {
        const call = JSON.parse(body.toString("utf8") || "{}");
        if (call.url === USAGE_URL && call.auth_index) {
          const result = await handleUsageCall(request, body, call);
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify(result));
          return;
        }
      }
      const { host: _host, ...headers } = request.headers;
      const upstream = await hubRequest(request.method, request.url, headers, body.length ? body : undefined);
      response.writeHead(upstream.status, upstream.headers);
      response.end(upstream.body);
    } catch (error) {
      console.error(`[usage-shim] ${request.method} ${request.url.split("?")[0]}: ${error.message}`);
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "usage shim could not reach the hub" }));
    }
  })
  .listen(LISTEN_PORT, "127.0.0.1", () => console.log(`[usage-shim] listening on 127.0.0.1:${LISTEN_PORT} -> ${HUB.origin}`));
