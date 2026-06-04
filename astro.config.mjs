// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sanity from '@sanity/astro';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  integrations: [
    react(),
    sanity({
      projectId: '8zsgrbmy',
      dataset: 'production',
      useCdn: false,
      studioBasePath: '/admin',
    }),
  ],
});