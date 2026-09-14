import type { NextConfig } from "next";

import { OPTIMIZABLE_IMAGE_HOSTS } from "./lib/images";

const nextConfig: NextConfig = {
  images: {
    // 只有名单内的外部图会走 Next 图片优化；名单外的由组件自动退回 unoptimized 直出。
    // 名单本体在 lib/images.ts（单一来源，改那里即可）。
    remotePatterns: OPTIMIZABLE_IMAGE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
    // 源图普遍 300KB+（官网 CDN），优化后 w=640 约 78KB —— 省 ~4 倍带宽。
    // 但首次冷取要回源 + sharp 编码，偶尔会撞上优化器的内部超时（表现为该图 500）。
    // 调长缓存 TTL：优化结果一旦生成就长期复用，避免反复冷取。
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
