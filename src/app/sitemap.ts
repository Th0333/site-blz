import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  return ["", "/agendar", "/entrar", "/cadastro", "/privacidade", "/termos"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.6 }));
}
