export const paginationSchema = {
  type: 'object',
  properties: {
    page: {
      type: 'integer',
      minimum: 1,
      default: 1,
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
    },
  },
};

export const searchQuerySchema = {
  type: 'object',
  required: ['q'],
  properties: {
    q: {
      type: 'string',
      minLength: 1,
      maxLength: 200,
    },
  },
};
