import type { MetadataRoute } from "next";

const publicPages = ["/", "/contact", "/privacy", "/research-privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map(path => ({ url: `https://satinlore.com${path}` }));
}
