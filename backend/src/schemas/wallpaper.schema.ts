export const updateWallpaperSchema = {
  type: 'object',
  required: ['type', 'url'],
  properties: {
    type: {
      type: 'string',
      enum: ['image', 'video'],
    },
    url: {
      type: 'string',
      format: 'uri',
      maxLength: 500,
    },
  },
};
