import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/minha-conta", "/profissional", "/agendar/confirmacao", "/agendar/retorno"] },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
