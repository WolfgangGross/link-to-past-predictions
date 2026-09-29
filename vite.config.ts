import { fileURLToPath } from "node:url";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(`http://localhost${req.url}`, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
}

// Serves /api/<name> in dev with the same handler files Vercel deploys.
function vercelApiDev(): Plugin {
  return {
    name: "vercel-api-dev",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z0-9-]+)(?:\?|$)/);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(path.join(repoRoot, "api", `${match[1]}.ts`));
          const response: Response = await mod.default.fetch(await toRequest(req));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Server-only secret: loaded into process.env for the dev API, never exposed to the client (no VITE_ prefix).
  process.env.TABPFN_API_KEY ??= loadEnv(mode, repoRoot, "").TABPFN_API_KEY;
  return {
    root: path.join(repoRoot, "game"),
    envDir: repoRoot,
    // Phaser alone is ~1.4 MB minified.
    build: { outDir: path.join(repoRoot, "dist"), emptyOutDir: true, chunkSizeWarningLimit: 1600 },
    plugins: [vercelApiDev()],
  };
});
