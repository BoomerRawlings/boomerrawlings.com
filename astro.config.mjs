import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://boomerrawlings.com',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
