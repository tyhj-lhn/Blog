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
