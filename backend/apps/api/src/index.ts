import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { agentRoutes }    from "./routes/agent.js";
import { actionRoutes }   from "./routes/action.js";
import { lotRoutes }      from "./routes/lot.js";
import { portfolioRoutes } from "./routes/portfolio.js";
import { authRoutes }     from "./routes/auth.js";
import circleRoutes       from "./routes/circle.js";

const app = Fastify({
  logger: {
    level: process.env["NODE_ENV"] === "production" ? "warn" : "info",
  },
});

function parseCorsOrigins(): Set<string> {
  const parts: string[] = [];
  for (const key of ["CORS_ORIGINS", "APP_URL", "FRONTEND_URL"] as const) {
    const v = process.env[key];
    if (v) parts.push(...v.split(",").map((s) => s.trim()).filter(Boolean));
  }
  const extras = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://taxee.io",
    "https://www.taxee.io",
  ];
  return new Set([...parts, ...extras]);
}

const allowedOrigins = parseCorsOrigins();

/** Dev / preview origins (Next.js Network URL, Vercel previews) */
function isAllowedDevOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
}

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, true);
      return;
    }
    if (allowedOrigins.has(origin) || isAllowedDevOrigin(origin)) {
      cb(null, origin);
      return;
    }
    // Do not pass Error — that becomes HTTP 500 without CORS headers (browser: NetworkError)
    cb(null, false);
  },
  credentials: true,
  methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

await app.register(jwt, {
  secret: process.env["JWT_SECRET"] ?? "dev-secret-change-me",
});

app.decorate("authenticate", async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

await app.register(authRoutes,      { prefix: "/auth" });
await app.register(agentRoutes,     { prefix: "/agents" });
await app.register(actionRoutes,    { prefix: "/actions" });
await app.register(lotRoutes,       { prefix: "/lots" });
await app.register(portfolioRoutes, { prefix: "/portfolio" });
await app.register(circleRoutes,    { prefix: "/circle" });

app.get("/health", async () => ({ ok: true, ts: new Date().toISOString() }));

const port = parseInt(process.env["PORT"] ?? "3001", 10);

const closeGracefully = async (signal: string) => {
  await app.close();
  process.exit(0);
};
process.on("SIGTERM", () => closeGracefully("SIGTERM"));
process.on("SIGINT",  () => closeGracefully("SIGINT"));

try {
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`[api] taxee API running on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
