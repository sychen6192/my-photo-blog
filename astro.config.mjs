// @ts-check
import { defineConfig } from 'astro/config';
import sanity from '@sanity/astro';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://gallery.sychen6192.org',
  output: 'static',
  integrations: [
    react(),
    sanity({
      projectId: '8zsgrbmy',
      dataset: 'production',
      useCdn: false,
      studioBasePath: '/admin',
    }),
    sitemap({
      filter: (page) => !page.includes('/admin') && !page.includes('/404'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
