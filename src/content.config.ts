import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const archive = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/archive' }),
  schema: z
    .object({
      title: z.string(),
      slug: z.string(),
      date: z.coerce.date().optional(),
      type: z.enum(['work', 'research', 'writing', 'photography']),
      description: z.string(),
      tags: z.array(z.string()).default([]),
      status: z.enum(['draft', 'published', 'archived']).default('draft'),
      featured: z.boolean().default(false),
      related: z.array(z.string()).default([]),
      externalUrl: z.string().url().optional(),
      writingKind: z.enum(['academic', 'personal']).optional(),
      venue: z.string().min(1).optional(),
      publishedDate: z.coerce.date().optional(),
      producedDate: z.coerce.date().optional(),
    })
    .superRefine((entry, context) => {
      if (entry.type !== 'writing' || entry.status !== 'published') return;

      for (const field of ['writingKind', 'venue', 'publishedDate'] as const) {
        if (!entry[field]) {
          context.addIssue({
            code: 'custom',
            path: [field],
            message: `Published writing requires ${field}.`,
          });
        }
      }
    }),
});

export const collections = { archive };
