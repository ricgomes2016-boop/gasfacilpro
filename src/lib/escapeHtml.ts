/**
 * Escape a string for safe interpolation into HTML.
 * Use whenever user/database-sourced strings are injected into
 * template literals that end up in document.write / innerHTML / print windows.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const esc = escapeHtml;
