import { describe, expect, it, vi } from "vitest";

const KEYS = ["NEXT_PUBLIC_SITE_URL", "RENDER_EXTERNAL_URL"] as const;
type Key = (typeof KEYS)[number];

/** 在指定的环境变量组合下重新加载模块，返回解析出的 SITE_URL（读后还原真实环境）。 */
async function resolveSiteUrl(env: Partial<Record<Key, string>>): Promise<string> {
  const saved = new Map<Key, string | undefined>(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(env)) process.env[k] = v;

  vi.resetModules();
  const { SITE_URL } = await import("./site-url");

  for (const k of KEYS) {
    const prev = saved.get(k);
    if (prev === undefined) delete process.env[k];
    else process.env[k] = prev;
  }
  return SITE_URL;
}

describe("SITE_URL 解析优先级", () => {
  it("优先使用 NEXT_PUBLIC_SITE_URL（自定义域名 / 本地开发）", async () => {
    const url = await resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://custom.example.com" });
    expect(url).toBe("https://custom.example.com");
  });

  it("未设 NEXT_PUBLIC_SITE_URL 时回退到 Render 注入的 RENDER_EXTERNAL_URL", async () => {
    const url = await resolveSiteUrl({ RENDER_EXTERNAL_URL: "https://arsenal-fan-site.onrender.com" });
    expect(url).toBe("https://arsenal-fan-site.onrender.com");
  });

  it("NEXT_PUBLIC_SITE_URL 为空字符串时视为未设，仍回退 RENDER_EXTERNAL_URL", async () => {
    const url = await resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: "",
      RENDER_EXTERNAL_URL: "https://arsenal-fan-site.onrender.com",
    });
    expect(url).toBe("https://arsenal-fan-site.onrender.com");
  });

  it("NEXT_PUBLIC_SITE_URL 明确设置时优先于 RENDER_EXTERNAL_URL", async () => {
    const url = await resolveSiteUrl({
      NEXT_PUBLIC_SITE_URL: "https://arsenal.example.com",
      RENDER_EXTERNAL_URL: "https://arsenal-fan-site.onrender.com",
    });
    expect(url).toBe("https://arsenal.example.com");
  });

  it("两者都没有时回退 localhost", async () => {
    const url = await resolveSiteUrl({});
    expect(url).toBe("http://localhost:3000");
  });
});
