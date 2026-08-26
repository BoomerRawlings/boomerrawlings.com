import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://boomerrawlings.com',
  trailingSlash: 'always',
  redirects: {
    '/archive': '/all/',
    '/work/horizonos': '/work/horizon/',
    '/work/icloud-media-archive': '/work/organizing-icloud-media/',
    '/work/personal-archive': '/work/organizing-icloud-media/',
  },
  integrations: [
    sitemap({
      filter: (page) => page !== 'https://boomerrawlings.com/photography/',
    }),
  ],
});
