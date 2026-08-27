import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const localAssetPath = z.string().regex(/^\/(?!\/)/);
const visualEvidenceBase = {
  role: z.enum(['hero', 'process', 'proof']),
  src: localAssetPath,
  alt: z.string().min(1),
  caption: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fullSizeLink: z.boolean().optional(),
};
const visualEvidenceItem = z.discriminatedUnion('kind', [
  z.object({
    ...visualEvidenceBase,
    kind: z.literal('image'),
  }),
  z.object({
    ...visualEvidenceBase,
    kind: z.literal('video'),
    poster: localAssetPath,
    posterWidth: z.number().int().positive(),
    posterHeight: z.number().int().positive(),
  }),
]);

const archive = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/archive' }),
  schema: z
    .object({
      title: z.string(),
      slug: z.string(),
      date: z.coerce.date().optional(),
      type: z.enum(['work', 'research', 'writing', 'photography']),
      description: z.string(),
      visualEvidence: z.array(visualEvidenceItem).max(3).optional(),
      document: z.object({
        src: localAssetPath.refine((path) => path.endsWith('.pdf'), 'Document source must be a PDF.'),
        pages: z.number().int().positive(),
        label: z.string().min(1).optional(),
      }).optional(),
      curatorNotes: z.array(z.string().min(1)).min(2).max(4).optional(),
      nextExhibit: z.object({
        href: z.string().regex(/^\/(?!\/)/),
        label: z.string().min(1),
      }).optional(),
      tags: z.array(z.string()).default([]),
      status: z.enum(['draft', 'published', 'archived']).default('draft'),
      featured: z.boolean().default(false),
      projectStage: z.enum(['Work in progress']).optional(),
      related: z.array(z.string()).default([]),
      externalUrl: z.string().url().optional(),
      writingKind: z.enum(['academic', 'personal']).optional(),
      writingForm: z.string().min(1).optional(),
      venue: z.string().min(1).optional(),
      publishedDate: z.coerce.date().optional(),
      producedDate: z.string()
        .regex(/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/)
        .optional(),
    })
    .superRefine((entry, context) => {
      if (entry.nextExhibit && !entry.curatorNotes) {
        context.addIssue({
          code: 'custom',
          path: ['curatorNotes'],
          message: 'A next exhibit requires curator notes.',
        });
      }

      if (entry.projectStage && entry.type !== 'work') {
        context.addIssue({
          code: 'custom',
          path: ['projectStage'],
          message: 'Only project entries may declare a project stage.',
        });
      }

      const visualRoles = new Set<string>();
      entry.visualEvidence?.forEach((visual, index) => {
        if (visualRoles.has(visual.role)) {
          context.addIssue({
            code: 'custom',
            path: ['visualEvidence', index, 'role'],
            message: `Visual evidence role ${visual.role} may appear only once.`,
          });
        }
        visualRoles.add(visual.role);
      });

      if (entry.type !== 'writing' || entry.status !== 'published') return;

      for (const field of ['writingKind', 'writingForm', 'venue', 'publishedDate'] as const) {
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
