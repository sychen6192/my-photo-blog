import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: '8zsgrbmy',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2024-01-01',
});
