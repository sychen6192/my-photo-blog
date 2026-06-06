import { defineType, defineField, defineArrayMember } from 'sanity';
import { BatchPhotoInput } from '../components/BatchPhotoInput';

export const album = defineType({
  name: 'album',
  title: '旅程相簿',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: '相簿名稱',
      type: 'string',
      description: '例如:伊豆行、大山行',
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
      title: 'R2 封面圖片檔名(選填,留空用第一張照片)',
      type: 'string',
      description: '例如:DSCF4825.JPG',
    }),
    defineField({
      name: 'description',
      title: '旅程簡介',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'photos',
      title: '照片',
      type: 'array',
      components: { input: BatchPhotoInput },
      of: [
        defineArrayMember({
          type: 'object',
          name: 'photo',
          fields: [
            defineField({ name: 'filename', title: 'R2 檔名', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'title', title: '說明', type: 'string' }),
            defineField({ name: 'camera', title: '相機', type: 'string', readOnly: true }),
            defineField({ name: 'lens', title: '鏡頭', type: 'string', readOnly: true }),
            defineField({ name: 'exif', title: 'EXIF', type: 'string', readOnly: true }),
          ],
          preview: {
            select: { title: 'filename', subtitle: 'exif' },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'slug.current' },
  },
});
