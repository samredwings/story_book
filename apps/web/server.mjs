import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = resolve(fileURLToPath(new URL("./dist/", import.meta.url)));
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function existingFile(path) {
  try {
    const details = await stat(path);
    if (details.isDirectory()) return existingFile(resolve(path, "index.html"));
    return details.isFile() ? path : null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const requestedPath = resolve(publicDir, `.${pathname}`);
  if (requestedPath !== publicDir && !requestedPath.startsWith(`${publicDir}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    let file = await existingFile(requestedPath);
    if (!file && !extname(requestedPath)) {
      file = await existingFile(resolve(requestedPath, "index.html"));
    }
    const notFound = !file;
    if (notFound) file = await existingFile(resolve(publicDir, "404.html"));
    if (!file) {
      response.writeHead(404).end("Not found");
      return;
    }

    const details = await stat(file);
    const headers = {
      "Content-Length": details.size,
      "Content-Type": mimeTypes[extname(file).toLowerCase()] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    };
    if (pathname.startsWith("/_next/static/")) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    } else {
      headers["Cache-Control"] = "no-cache";
    }

    response.writeHead(notFound ? 404 : 200, headers);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(file)
      .on("error", (error) => {
        console.error("Static file stream failed:", error);
        if (!response.headersSent) response.writeHead(500);
        response.end();
      })
      .pipe(response);
  } catch (error) {
    console.error("Static request failed:", error);
    if (!response.headersSent) response.writeHead(500);
    response.end("Internal server error");
  }
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, "0.0.0.0", () => {
  console.log(`Static web app listening on port ${port}`);
});
