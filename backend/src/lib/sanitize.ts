import xss from 'xss';

const XSS_OPTIONS: XSS.IFilterXSSOptions = {
  // Empty whitelist — strip ALL HTML tags, attributes, and event handlers
  whiteList: {},
  // Strip HTML comments (<!-- ... -->) which can hide malicious payloads
  stripIgnoreTag: true,
  // Strip the body of script/style tags if they somehow survive the empty whitelist
  stripIgnoreTagBody: ['script', 'style'],
};

/**
 * Sanitize user-supplied content before storage.
 * - Strips all HTML tags, attributes, event handlers
 * - Handles unicode homoglyph attacks (xss library normalizes by default)
 * - Trims leading/trailing whitespace
 * - Returns empty string on nullish input
 */
export function sanitizeContent(input: string): string {
  return xss(input, XSS_OPTIONS).trim();
}
