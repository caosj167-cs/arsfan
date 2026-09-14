"use client";

import { useState } from "react";
import Image from "next/image";

import { clubIdentity } from "@/lib/data/clubs";
import { canOptimizeImage } from "@/lib/images";

/**
 * 全站队标统一入口。
 *
 * 设计稿（docs/design-spec-from-sketch.md）用的是「俱乐部品牌色直角方章 +
 * 3 字母缩写 + 1px 白描边」—— 完全不用队徽图片。这里把两种形态都实现好，
 * 由 BADGE_VARIANT 一行切换整站表现：
 *   "code"  → 字母方章（设计稿原样，默认）
 *   "crest" → 真实队徽图片（无图时自动回退到字母方章）
 */
export const BADGE_VARIANT: "code" | "crest" = "code";

/** 设计稿里的三种尺寸：战绩结果 26 / 赛程行 32 / 对阵阵章 46 */
export const BADGE_SIZE = { sm: 26, md: 32, lg: 46 } as const;

type ClubBadgeProps = {
  /** 英文队名（football-data 或 arsenal.com 的原始名都可以） */
  name: string;
  /** 可选的真实队徽地址，仅在 variant="crest" 时使用 */
  crest?: string | null;
  size?: number;
  variant?: "code" | "crest";
  /** 是否显示品牌色底（对阵大章用实色，列表里可用低调底） */
  tone?: "brand" | "quiet";
  className?: string;
};

export function ClubBadge({
  name,
  crest,
  size = BADGE_SIZE.md,
  variant = BADGE_VARIANT,
  tone = "brand",
  className = "",
}: ClubBadgeProps) {
  const { code, color, nameZh } = clubIdentity(name);
  const [broken, setBroken] = useState(false);

  const showCrest = variant === "crest" && Boolean(crest) && !broken;
  const fontSize = Math.max(10, Math.round(size * 0.38));

  return (
    <span
      className={`club-badge club-badge--${tone} ${className}`.trim()}
      style={
        showCrest
          ? { width: size, height: size }
          : { background: color, fontSize, height: size, width: size }
      }
      title={nameZh}
      aria-hidden="true"
    >
      {showCrest ? (
        <Image
          src={crest as string}
          alt=""
          width={size}
          height={size}
          // 队徽只有 26~46px 且域名不可控：白名单外直出，避免服务端回源失败整页崩
          unoptimized={!canOptimizeImage(crest)}
          onError={() => setBroken(true)}
        />
      ) : (
        code
      )}
    </span>
  );
}
