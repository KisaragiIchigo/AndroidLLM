const fence = (body: string) => `\n$$\n${body.trim()}\n$$\n`;

/**
 * remark-math only understands $…$ inline and $$ on their own lines for display math, but the
 * model also writes LaTeX-style \( \) / \[ \] and single-line $$…$$, which would render inline.
 */
export function normalizeMathDelimiters(prose: string): string {
  return prose
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body: string) => fence(body))
    .replace(/\\\((.+?)\\\)/g, (_, body: string) => `$${body.trim()}$`)
    .replace(/^[ \t]*\$\$(?!\s*$)(.+?)\$\$[ \t]*$/gm, (_, body: string) => fence(body));
}
