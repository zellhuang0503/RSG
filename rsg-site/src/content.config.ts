// 內容集合定義。欄位對應 rsg-export/export_wp.py 產生的 front matter，
// 匯入舊站內容後不需要改任何欄位；新寫的文章照 README 的範本填即可。
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const base = z.object({
  title: z.string(),
  slug: z.string().optional(),
  wp_id: z.number().optional(),
  type: z.string().optional(),
  original_url: z.string().optional(),
  // 決定網址。舊站匯入的內容維持原路徑（/archives/6311、/about-2）；
  // 新內容自己填，例如 /posts/2026-秋季工作坊。開頭要有斜線、結尾不要斜線。
  original_path: z.string().regex(/^\/[^\s]*$/, '路徑必須以 / 開頭且不含空白'),
  date: z.string().optional().default(''),
  modified: z.string().optional().default(''),
  status: z.enum(['publish', 'draft']).default('publish'),
  featured_image: z.string().optional().default(''),
  excerpt: z.string().optional().default(''),
  // 新站可補的 SEO 描述；沒填就用 excerpt
  description: z.string().optional(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  parent_id: z.number().optional(),
  noindex: z.boolean().default(false),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/pages' }),
  schema: base.extend({
    menu_order: z.number().optional(),
    template: z.string().optional(),
    presentation: z.object({
      layout: z.literal('centered-service'),
      hero: z.object({ src: z.string(), alt: z.string(), width: z.number(), height: z.number(), fit: z.enum(['cover', 'contain']).optional() }).optional(),
      appointment: z.boolean().default(false),
    }).optional(),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/posts' }),
  schema: base.extend({
    presentation: z.object({
      layout: z.literal('course-detail'),
      appointment: z.boolean().default(true),
      registrationCourseId: z.string().regex(/^\d+$/).optional(),
    }).optional(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/events' }),
  schema: base.extend({
    start_date: z.string().optional().default(''),
    end_date: z.string().optional().default(''),
    all_day: z.boolean().default(false),
    venue: z.string().optional().default(''),
    venue_address: z.string().optional().default(''),
    cost: z.string().optional().default(''),
    website: z.string().optional().default(''),
  }),
});

export const collections = { pages, posts, events };
