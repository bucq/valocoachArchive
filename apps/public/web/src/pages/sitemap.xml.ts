import type { APIRoute } from 'astro';
import type { FiltersResponse } from '../lib/api';

const siteUrl = 'https://valocoach-archive.pages.dev';

export const GET: APIRoute = async () => {
  const API_BASE = import.meta.env.API_BASE_URL;

  let filters: FiltersResponse = { maps: [], agents: [], ranks: [], coaches: [] };
  try {
    const res = await fetch(`${API_BASE}/api/videos/filters`);
    if (res.ok) filters = await res.json();
  } catch {
    // API not available — return sitemap with base URL only
  }

  const urls: string[] = [
    `<url><loc>${siteUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
  ];

  for (const map of filters.maps) {
    urls.push(
      `<url><loc>${siteUrl}/?map=${encodeURIComponent(map)}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    );
  }
  for (const agent of filters.agents) {
    urls.push(
      `<url><loc>${siteUrl}/?agent=${encodeURIComponent(agent)}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    );
  }
  for (const rank of filters.ranks) {
    urls.push(
      `<url><loc>${siteUrl}/?rank=${encodeURIComponent(rank)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
