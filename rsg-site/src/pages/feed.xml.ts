import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, routeOf, summaryOf, toIso } from '../lib/content';
import { site } from '../site';

export async function GET(context: APIContext) {
  const posts = (await getPosts()).slice(0, 30);
  return rss({
    title: `${site.shortName} 文章`,
    description: site.description,
    site: context.site ?? site.url,
    trailingSlash: false,
    items: posts.map((p) => ({
      title: p.data.title,
      link: routeOf(p),
      pubDate: new Date(toIso(p.data.date) ?? Date.now()),
      description: summaryOf(p, 200),
      categories: p.data.categories,
    })),
    customData: `<language>zh-tw</language>`,
  });
}
