/** Client-side display sanitizer (content is also sanitized on save). */

const ALLOWED_TAGS = new Set([
  "p", "br", "div", "span", "h1", "h2", "h3", "h4", "strong", "b", "em", "i", "u",
  "ul", "ol", "li", "a", "table", "thead", "tbody", "tr", "th", "td", "pre", "code", "blockquote",
]);

function stripDangerous(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function sanitizeKnowledgeHtml(raw: string): string {
  if (!raw?.trim()) return "";
  let html = stripDangerous(raw);
  html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName, attrs) => {
    const tag = String(tagName).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (tag === "a") {
      const hrefMatch = String(attrs).match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = (hrefMatch?.[2] || hrefMatch?.[3] || hrefMatch?.[4] || "").trim();
      if (!/^https?:\/\//i.test(href) && !href.startsWith("/") && !/^mailto:/i.test(href)) return "";
      return `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer noopener">`;
    }
    if (match.startsWith("</")) return `</${tag}>`;
    return `<${tag}>`;
  });
  return html;
}

export function KnowledgeBaseContent({ html }: { html: string }) {
  const safe = sanitizeKnowledgeHtml(html);
  return (
    <article
      className="kb-prose max-w-none text-[15px] leading-7 text-slate-800 [&_a]:text-blue-700 [&_a]:underline [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950 [&_pre]:px-4 [&_pre]:py-3 [&_pre]:text-sm [&_pre]:text-slate-100 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
