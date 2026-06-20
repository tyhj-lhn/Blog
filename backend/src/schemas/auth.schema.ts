export const loginSchema = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
    },
    password: {
      type: 'string',
      minLength: 6,
      maxLength: 128,
    },
  },
};

export const refreshSchema = {
  type: 'object',
  required: ['refreshToken'],
  properties: {
    refreshToken: {
      type: 'string',
      minLength: 1,
    },
  },
};

export const updateProfileSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      minLength: 1,
      maxLength: 50,
    },
    avatar: {
      type: ['string', 'null'],
      maxLength: 500,
    },
  },
};

export const changePasswordSchema = {
  type: 'object',
  required: ['currentPassword', 'newPassword'],
  properties: {
    currentPassword: {
      type: 'string',
      minLength: 1,
      maxLength: 128,
    },
    newPassword: {
      type: 'string',
      minLength: 6,
      maxLength: 128,
    },
  },
};
