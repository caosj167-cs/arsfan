import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 让 `npx eslint .` 只扫源码，别把产物/备份/生成物算进来。
    // （此前漏了这几条：.next.old* 备份目录一个就贡献了 1.4 万个"问题"）
    ".next.old*/**",
    "prisma.old*/**",
    "app/generated/**",
    "shots/**",
  ]),
]);

export default eslintConfig;
