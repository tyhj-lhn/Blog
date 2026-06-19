export const rateLimitPresets = {
  global: {
    max: 100,
    timeWindow: '1 minute' as const,
  },
  auth: {
    max: 5,
    timeWindow: '1 minute' as const,
  },
  guestbook: {
    max: 3,
    timeWindow: '1 minute' as const,
  },
  comment: {
    max: 10,
    timeWindow: '1 minute' as const,
  },
};
