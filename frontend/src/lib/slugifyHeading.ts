/**
 * Convert heading text to a valid, unique HTML id.
 * - Strips non-word characters (keeps spaces/hyphens/CJK)
 * - Falls back to numeric hash for pure-CJK headings
 * - Appends counter suffix for duplicates
 */
export function slugifyHeading(text: string, usedIds: Set<string>): string {
  let slug = text
    .toLowerCase()
    .replace(/[^\w\s\-一-鿿㐀-䶿]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Fallback: pure Chinese or otherwise empty after stripping
  if (!slug) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    slug = `heading-${Math.abs(hash)}`;
  }

  // Ensure uniqueness
  if (usedIds.has(slug)) {
    let counter = 2;
    while (usedIds.has(`${slug}-${counter}`)) {
      counter++;
    }
    slug = `${slug}-${counter}`;
  }

  usedIds.add(slug);
  return slug;
}
