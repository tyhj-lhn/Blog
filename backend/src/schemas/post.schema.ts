export const createPostSchema = {
  type: 'object',
  required: ['title', 'content'],
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    content: {
      type: 'string',
      minLength: 1,
    },
    excerpt: {
      type: 'string',
      maxLength: 500,
    },
    coverImage: {
      type: 'string',
      format: 'uri',
    },
    status: {
      type: 'string',
      enum: ['DRAFT', 'PUBLISHED'],
      default: 'DRAFT',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      default: [],
    },
  },
};

export const updatePostSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
    content: {
      type: 'string',
      minLength: 1,
    },
    excerpt: {
      type: 'string',
      maxLength: 500,
    },
    coverImage: {
      type: 'string',
      format: 'uri',
    },
    status: {
      type: 'string',
      enum: ['DRAFT', 'PUBLISHED'],
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

export const postSlugParamsSchema = {
  type: 'object',
  required: ['slug'],
  properties: {
    slug: { type: 'string', minLength: 1 },
  },
};

export const postIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
};
