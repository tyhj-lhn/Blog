export const createGuestbookSchema = {
  type: 'object',
  required: ['nickname', 'message'],
  properties: {
    nickname: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
    },
    message: {
      type: 'string',
      minLength: 1,
      maxLength: 5000,
    },
  },
};

export const guestbookIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 },
  },
};
