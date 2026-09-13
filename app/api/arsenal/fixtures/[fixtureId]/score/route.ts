import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { apiError, apiJson, ApiErrorCode } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const scoreSchema = z.object({
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  source: z.enum(["manual", "report"]),
  sourceUrl: z.string().url().optional(),
}).superRefine((value, context) => {
  if (value.source === "report" && !value.sourceUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceUrl"], message: "A public report URL is required" });
  }
});

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ fixtureId: string }> }) {
  if (!isAuthorized(request)) {
    return apiError(ApiErrorCode.UNAUTHORIZED, "Unauthorized", 401);
  }
  const { fixtureId } = await context.params;
  const parsed = scoreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(ApiErrorCode.INVALID_SCORE, "Invalid score payload", 400);
  }
  const fixture = await prisma.officialFixture.findFirst({
    where: { OR: [{ id: fixtureId }, { provider: "arsenal.com", providerRecordId: fixtureId }] },
  });
  if (!fixture) {
    return apiError(ApiErrorCode.FIXTURE_NOT_FOUND, "Official fixture not found", 404, { source: "arsenal.com" });
  }
  const updated = await prisma.officialFixture.update({
    where: { id: fixture.id },
    data: {
      homeScore: parsed.data.homeScore,
      awayScore: parsed.data.awayScore,
      scoreSource: parsed.data.source,
      scoreSourceUrl: parsed.data.sourceUrl ?? null,
      scoreUpdatedAt: new Date(),
    },
  });
  return apiJson(
    {
      id: updated.id,
      homeScore: updated.homeScore,
      awayScore: updated.awayScore,
      scoreSource: updated.scoreSource,
      scoreSourceUrl: updated.scoreSourceUrl,
      scoreUpdatedAt: updated.scoreUpdatedAt?.toISOString() ?? null,
    },
    {
      source: parsed.data.source === "manual" ? "人工录入" : "公开比赛报告",
      sourceUrl: parsed.data.sourceUrl ?? null,
    },
  );
}
