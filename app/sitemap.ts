import type { MetadataRoute } from "next";
import { SQUAD_PLAYERS } from "@/lib/data/squad";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/team-data`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/players`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/news`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
  ];
  const playerRoutes: MetadataRoute.Sitemap = SQUAD_PLAYERS.map((p) => ({
    url: `${SITE_URL}/players/${p.id}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.6,
  }));
  return [...staticRoutes, ...playerRoutes];
}
