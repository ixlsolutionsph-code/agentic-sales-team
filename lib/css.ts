// Joins class names, skipping empty and false values.
export function css(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(" ");
}
