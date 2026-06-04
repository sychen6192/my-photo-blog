import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './src/sanity/schemaTypes'; // 乾淨的路徑引用

export default defineConfig({
    name: 'default',
    title: 'Fujifilm Photo Admin',
    projectId: '8zsgrbmy',
    dataset: 'production',
    basePath: '/admin',
    plugins: [structureTool()],
    schema: {
        types: schemaTypes,
    },
});