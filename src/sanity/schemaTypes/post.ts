import { defineType, defineField } from 'sanity';

export const post = defineType({
    name: 'post',
    title: '攝影文章',
    type: 'document',
    fields: [
        defineField({ name: 'title', title: '文章標題', type: 'string', validation: Rule => Rule.required() }),
        defineField({ name: 'slug', title: '網址關鍵字 (Slug)', type: 'slug', options: { source: 'title' }, validation: Rule => Rule.required() }),
        defineField({
            name: 'album',
            title: '所屬旅程相簿',
            type: 'reference',
            to: [{ type: 'album' }],
            description: '這張作品屬於哪一次旅程',
            validation: Rule => Rule.required(),
        }),
        defineField({ name: 'coverImage', title: 'R2 圖片完整檔名', type: 'string', description: '例如：DSCF4825.JPG', validation: Rule => Rule.required() }),
        defineField({ name: 'content', title: '文章內文', type: 'array', of: [{ type: 'block' }] }),
        defineField({ name: 'camera', title: '使用相機', type: 'string', initialValue: 'Fujifilm X-T50' }),
        defineField({ name: 'lens', title: '使用鏡頭', type: 'string', initialValue: 'XF 16-55mm f/2.8 R LM WR II' }),
        defineField({ name: 'exif', title: 'EXIF 參數', type: 'string', description: '例如：35mm, f/2.8, 1/250s, ISO 400' })
    ]
});
