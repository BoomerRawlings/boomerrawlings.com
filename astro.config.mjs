import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
import casePageRoutes from './scripts/case-page-routes.mjs';

const redirects = {
  '/data-analysis': '/writing/data-analysis/',
  '/data-analysis/crime-and-heat': '/writing/data-analysis/crime-and-heat/',
  '/archive': '/all/',
  '/work/horizonos': '/work/horizon/',
  '/work/icloud-media-archive': '/work/organizing-icloud-media/',
  '/work/personal-archive': '/work/organizing-icloud-media/',
};

export default defineConfig({
  site: 'https://boomerrawlings.com',
  trailingSlash: 'always',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, {strict: 'error', trust: false}]],
    }),
  },
  redirects,
  integrations: [
    casePageRoutes(redirects),
    sitemap({
      filter: (page) =>
        page !== 'https://boomerrawlings.com/photography/' &&
        page !== 'https://boomerrawlings.com/aristotter/' &&
        page !== 'https://boomerrawlings.com/deckle/' &&
        page !== 'https://boomerrawlings.com/swc/' &&
        !page.startsWith('https://boomerrawlings.com/psyc/') &&
        !page.startsWith('https://boomerrawlings.com/brain/') &&
        !page.startsWith('https://boomerrawlings.com/ead/') &&
        !page.startsWith('https://boomerrawlings.com/BoomerKarma/') &&
        page !== 'https://boomerrawlings.com/writing/data-analysis/sex-and-the-moon/' &&
        !page.startsWith('https://boomerrawlings.com/cbs8/'),
    }),
  ],
});
