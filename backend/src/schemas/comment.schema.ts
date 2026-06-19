export const createCommentSchema = {
  type: 'object',
  required: ['content', 'postId', 'username'],
  properties: {
    content: {
      type: 'string',
      minLength: 1,
      maxLength: 10000,
    },
    postId: {
      type: 'integer',
      minimum: 1,
    },
    username: {
      type: 'string',
      minLength: 1,
      maxLength: 50,
    },
    email: {
      type: 'string',
      format: 'email',
    },
    websiteUrl: {
      type: 'string',
      format: 'uri',
      maxLength: 500,
    },
    parentId: {
      type: 'integer',
      minimum: 1,
    },
  },
};

export const commentPostIdParamsSchema = {
  type: 'object',
  required: ['postId'],
  properties: {
    postId: { type: 'integer', minimum: 1 },
  },
};

export const commentIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
};
