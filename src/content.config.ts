import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const archive = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/archive' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.coerce.date().optional(),
    type: z.enum(['work', 'research', 'writing', 'photography']),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    featured: z.boolean().default(false),
    related: z.array(z.string()).default([]),
  }),
});

export const collections = { archive };
