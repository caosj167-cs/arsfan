// Runtime-only shim: route Node's global fetch (undici) through the egress
// proxy when one is configured via HTTPS_PROXY/HTTP_PROXY. Node's built-in
// fetch ignores these env vars by default, which breaks outbound requests in
// proxied environments (CI sandboxes, corporate networks).
//
// Inert when no proxy env var is present, so it is safe to leave in place.
import { setGlobalDispatcher, ProxyAgent } from "undici";

const proxy =
  process.env.HTTPS_PROXY ||
  process.env.HTTP_PROXY ||
  process.env.https_proxy ||
  process.env.http_proxy;

if (proxy) {
  try {
    setGlobalDispatcher(new ProxyAgent(proxy));
    // NOTE: log to stderr only. Anything on stdout pollutes child processes
    // (e.g. `tsc --showConfig`) that Next.js parses as JSON.
    process.stderr.write(`[proxy-shim] undici global dispatcher -> ${proxy}\n`);
  } catch (error) {
    console.error("[proxy-shim] failed to set proxy dispatcher:", error);
  }
}
