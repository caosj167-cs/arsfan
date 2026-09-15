import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 纯逻辑单元测试配置：node 环境、不连数据库。
// `@` 别名与 tsconfig 的 paths 对齐，测试文件可直接 `@/lib/...` 引用。
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
