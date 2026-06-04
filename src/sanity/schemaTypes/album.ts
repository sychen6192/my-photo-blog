import { defineType, defineField } from 'sanity';

export const album = defineType({
  name: 'album',
  title: '旅程相簿',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: '相簿名稱',
      type: 'string',
      description: '例如：伊豆行、大山行',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: '網址路徑 (Slug)',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'coverImage',
      title: 'R2 封面圖片檔名',
      type: 'string',
      description: '例如：DSCF4825.JPG',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: '旅程簡介',
      type: 'array',
      of: [{ type: 'block' }],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'slug.current' },
  },
});
