// api/index.js  –  Node.js serverless runtime (replaces Edge runtime)

const http  = require("http");
const https = require("https");

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "transfer-encoding", "te",
  "trailer", "upgrade", "proxy-authorization", "proxy-authenticate",
]);

const TARGET = (process.env.TARGET_DOMAIN || "").replace(/\/+$/, "");
const targetUrl = new URL(TARGET);
const client = targetUrl.protocol === "https:" ? https : http;

module.exports = function handler(req, res) {
  const path = req.url.slice(req.url.indexOf("/", 8) === -1
    ? req.url.length
    : req.url.indexOf("/", 8)) || "/";

  const forwardHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (HOP_BY_HOP.has(lk)) continue;
    if (lk.startsWith("x-vercel-")) continue;
    if (lk === "x-forwarded-host" || lk === "x-forwarded-proto" || lk === "x-forwarded-port") continue;
    forwardHeaders[k] = v;
  }
  forwardHeaders["x-forwarded-for"] =
    req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "";

  const options = {
    hostname: targetUrl.hostname,
    port:     targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
    path:     path,
    method:   req.method,
    headers:  forwardHeaders,
  };

  const proxy = client.request(options, (upstream) => {
    res.writeHead(upstream.statusCode, upstream.headers);
    upstream.pipe(res);
  });

  proxy.on("error", (err) => {
    res.writeHead(502);
    res.end("Bad Gateway");
  });

  req.pipe(proxy);
};
