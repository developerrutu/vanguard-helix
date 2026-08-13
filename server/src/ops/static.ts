import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type http from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
export const PUBLIC_DIR = process.env.HELIX_PUBLIC || join(here, "../../../client/dist");

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

export function tryStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (pathname.startsWith("/api") || pathname === "/ws") return false;
  if (!existsSync(PUBLIC_DIR)) return false;

  const root = resolve(PUBLIC_DIR);
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  let file = resolve(root, normalize(rel));
  if (!file.startsWith(root + "/") && file !== root) return false;
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
  if (!existsSync(file) || statSync(file).isDirectory()) return false;

  const ext = extname(file).toLowerCase();
  const name = file.split("/").pop() || "";
  const htmlish = ext === ".html" || ext === ".webmanifest" || name === "sw.js";
  const st = statSync(file);
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Content-Length": st.size,
    "Cache-Control": htmlish ? "no-cache" : "public, max-age=31536000, immutable",
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(file).pipe(res);
  return true;
}
