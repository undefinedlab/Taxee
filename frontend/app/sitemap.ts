import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

const publicRoutes: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/onboarding", changeFrequency: "monthly", priority: 0.9 },
  { path: "/dashboard", changeFrequency: "weekly", priority: 0.85 },
  { path: "/watch", changeFrequency: "monthly", priority: 0.6 },
  { path: "/setup-wallet", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map(({ path, changeFrequency, priority }) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
