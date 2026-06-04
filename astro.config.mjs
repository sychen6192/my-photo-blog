// @ts-check
import { defineConfig } from 'astro/config';
import sanity from '@sanity/astro';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
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