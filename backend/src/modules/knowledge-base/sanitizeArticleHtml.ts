import sanitizeHtml from 'sanitize-html';

// Authoritative XSS defense for WYSIWYG-editor content: this is the only place article HTML
// is trusted from, and it happens on every create/update before anything is persisted. The
// frontend renders whatever comes back from the API as-is (via DomSanitizer.bypassSecurityTrustHtml)
// specifically because it trusts that this already ran server-side - never widen what's allowed
// here without checking that assumption still holds.
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'blockquote', 'code', 'pre',
      'ul', 'ol', 'li',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['class'],
      div: ['class'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      // Quill's checklist format (runbooks/SOPs) encodes checked/unchecked state as a
      // data-list attribute on <li>, styled by Quill's own CSS via that same attribute -
      // stripping it (the default for any unlisted attribute) silently degrades a checklist
      // back into a plain bullet list.
      li: ['data-list'],
      '*': ['style'],
    },
    // Only allow our own attachment URLs and standard content schemes for images - no data:
    // URIs (avoids smuggling arbitrary content past storage/size limits) and no javascript:.
    allowedSchemesByTag: { img: ['http', 'https'], a: ['http', 'https', 'mailto'] },
    allowedStyles: {
      '*': {
        'text-align': [/^left$|^right$|^center$|^justify$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}
