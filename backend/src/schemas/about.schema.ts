export const updateAboutSchema = {
  type: 'object',
  required: ['greetingTitle', 'greetingContent', 'aboutTitle', 'aboutContent'],
  properties: {
    greetingTitle: { type: 'string', minLength: 1, maxLength: 100 },
    greetingContent: { type: 'string', minLength: 1, maxLength: 2000 },
    aboutTitle: { type: 'string', minLength: 1, maxLength: 100 },
    aboutContent: { type: 'string', minLength: 1, maxLength: 5000 },
    email: { type: ['string', 'null'], maxLength: 255 },
    github: { type: ['string', 'null'], maxLength: 255 },
    location: { type: ['string', 'null'], maxLength: 100 },
  },
};
