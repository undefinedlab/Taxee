#!/usr/bin/env node
/**
 * Smoke tests for production Railway API + optional Postgres.
 * Usage (from backend/):
 *   pnpm smoke:prod
 *   DATABASE_URL=postgresql://... pnpm smoke:prod
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "..", "packages", "db", "package.json"));

const API_BASE = process.env.API_BASE ?? "https://taxee-production.up.railway.app";
const FAKE_UUID = "00000000-0000-4000-8000-000000000000";
const TEST_ADDRESS = "0x1234567890123456789012345678901234567890";

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`${icon}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(method, path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: opts.headers ?? {},
    body: opts.body,
  });
  let body;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

async function testApi() {
  console.log(`\n=== API: ${API_BASE} ===\n`);

  try {
    const t0 = Date.now();
    const health = await fetchJson("GET", "/health");
    const ms = Date.now() - t0;
    record(
      "GET /health → 200 + ok",
      health.status === 200 && health.body?.ok === true,
      `${health.status} (${ms}ms) ts=${health.body?.ts ?? "?"}`,
    );
  } catch (e) {
    record("GET /health → 200 + ok", false, e.message);
  }

  try {
    const nonce = await fetchJson(
      "GET",
      `/auth/nonce?address=${TEST_ADDRESS}`,
    );
    record(
      "GET /auth/nonce → 200 + nonce",
      nonce.status === 200 && typeof nonce.body?.nonce === "string",
      `${nonce.status}`,
    );
  } catch (e) {
    record("GET /auth/nonce → 200 + nonce", false, e.message);
  }

  try {
    const badNonce = await fetchJson("GET", "/auth/nonce");
    record(
      "GET /auth/nonce (no address) → 400",
      badNonce.status === 400,
      `${badNonce.status}`,
    );
  } catch (e) {
    record("GET /auth/nonce (no address) → 400", false, e.message);
  }

  try {
    const verify = await fetchJson("POST", "/auth/verify", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "x", signature: "y" }),
    });
    record(
      "POST /auth/verify (invalid) → 401",
      verify.status === 401,
      `${verify.status}`,
    );
  } catch (e) {
    record("POST /auth/verify (invalid) → 401", false, e.message);
  }

  try {
    const dev = await fetchJson("POST", "/auth/dev-token", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: TEST_ADDRESS }),
    });
    if (dev.status === 403) {
      record("POST /auth/dev-token blocked in prod → 403", true, "403");
    } else if (dev.status === 200 && dev.body?.token) {
      record(
        "POST /auth/dev-token blocked in prod → 403",
        false,
        "200 — set NODE_ENV=production on API (dev-token is open)",
      );
    } else {
      record("POST /auth/dev-token blocked in prod → 403", false, `${dev.status}`);
    }
  } catch (e) {
    record("POST /auth/dev-token blocked in prod → 403", false, e.message);
  }

  try {
    const agents = await fetchJson("GET", "/agents");
    record(
      "GET /agents (no JWT) → 401",
      agents.status === 401,
      `${agents.status}`,
    );
  } catch (e) {
    record("GET /agents (no JWT) → 401", false, e.message);
  }

  try {
    const agentsBad = await fetchJson("GET", "/agents", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    record(
      "GET /agents (bad JWT) → 401",
      agentsBad.status === 401,
      `${agentsBad.status}`,
    );
  } catch (e) {
    record("GET /agents (bad JWT) → 401", false, e.message);
  }

  try {
    const setup = await fetchJson("GET", `/circle/setup/${FAKE_UUID}`);
    const dbOk =
      setup.status === 404 && setup.body?.error === "User not found";
    const dbFail = setup.status === 500 && setup.body?.code === "ECONNREFUSED";
    record(
      "GET /circle/setup (DB) → 404 User not found",
      dbOk,
      dbFail
        ? "500 ECONNREFUSED — DATABASE_URL not wired on API"
        : `${setup.status} ${JSON.stringify(setup.body).slice(0, 80)}`,
    );
  } catch (e) {
    record("GET /circle/setup (DB) → 404 User not found", false, e.message);
  }

  try {
    const portfolio = await fetchJson(
      "GET",
      `/portfolio/${FAKE_UUID}`,
      { headers: { Authorization: "Bearer invalid" } },
    );
    record(
      "GET /portfolio (bad JWT) → 401",
      portfolio.status === 401,
      `${portfolio.status}`,
    );
  } catch (e) {
    record("GET /portfolio (bad JWT) → 401", false, e.message);
  }

  try {
    const actions = await fetchJson("GET", "/actions?agentId=x");
    record(
      "GET /actions (no JWT) → 401",
      actions.status === 401,
      `${actions.status}`,
    );
  } catch (e) {
    record("GET /actions (no JWT) → 401", false, e.message);
  }

  try {
    const res = await fetch(`${API_BASE}/health`, {
      headers: { Origin: "https://example.vercel.app" },
    });
    const acao = res.headers.get("access-control-allow-origin");
    record(
      "CORS header present on /health",
      acao != null && acao.length > 0,
      `Access-Control-Allow-Origin: ${acao ?? "(none)"}`,
    );
  } catch (e) {
    record("CORS header present on /health", false, e.message);
  }

  try {
    const missing = await fetchJson("GET", "/does-not-exist");
    record("GET unknown route → 404", missing.status === 404, `${missing.status}`);
  } catch (e) {
    record("GET unknown route → 404", false, e.message);
  }
}

async function testPostgres() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("\n=== Postgres (skipped — set DATABASE_URL to run) ===\n");
    record("Postgres connect + query", true, "skipped (no DATABASE_URL in env)");
    return;
  }

  console.log("\n=== Postgres (direct) ===\n");

  try {
    const postgres = require("postgres");
    const sql = postgres(url, { max: 1, connect_timeout: 10 });
    const [{ now }] = await sql`SELECT now() AS now`;
    await sql.end();
    record("Postgres SELECT now()", true, String(now));
  } catch (e) {
    record("Postgres SELECT now()", false, e.message);
    return;
  }

  try {
    const postgres = require("postgres");
    const sql = postgres(url, { max: 1, connect_timeout: 10 });
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    await sql.end();
    const names = tables.map((t) => t.table_name);
    const expected = ["users", "agents", "lots", "opportunities"];
    const missing = expected.filter((t) => !names.includes(t));
    record(
      "Postgres schema tables (users, agents, lots, opportunities)",
      missing.length === 0,
      missing.length
        ? `missing: ${missing.join(", ")}`
        : `found ${names.length} tables`,
    );
  } catch (e) {
    record("Postgres schema tables", false, e.message);
  }
}

async function main() {
  console.log("taxee production smoke tests\n");
  await testApi();
  await testPostgres();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
