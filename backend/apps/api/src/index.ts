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

await app.register(cors, {
  origin:      process.env["APP_URL"] ?? "http://localhost:3000",
  credentials: true,
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

try {
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`[api] taxee API running on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
