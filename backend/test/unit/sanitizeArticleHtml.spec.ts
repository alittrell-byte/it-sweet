import { sanitizeArticleHtml } from '../../src/modules/knowledge-base/sanitizeArticleHtml';

describe('sanitizeArticleHtml', () => {
  it('strips script tags entirely', () => {
    const result = sanitizeArticleHtml('<p>Hello</p><script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Hello</p>');
  });

  it('strips inline event handler attributes', () => {
    const result = sanitizeArticleHtml('<img src="https://example.com/a.png" onerror="alert(1)" />');
    expect(result).not.toContain('onerror');
    expect(result).toContain('src="https://example.com/a.png"');
  });

  it('strips javascript: URLs from links', () => {
    const result = sanitizeArticleHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('rejects data: URIs on images (only http/https allowed)', () => {
    const result = sanitizeArticleHtml('<img src="data:image/png;base64,AAAA" />');
    expect(result).not.toContain('data:image');
  });

  it('preserves safe formatting, headings, lists, and tables used by the WYSIWYG editor', () => {
    const html =
      '<h2>Title</h2><p><strong>bold</strong> and <em>italic</em></p>' +
      '<ul><li>one</li><li>two</li></ul>' +
      '<table><tr><td>cell</td></tr></table>';
    const result = sanitizeArticleHtml(html);
    expect(result).toContain('<h2>Title</h2>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<li>one</li>');
    expect(result).toContain('<td>cell</td>');
  });

  it('preserves a normal https image reference, which is how embedded attachments are stored', () => {
    const result = sanitizeArticleHtml('<img src="/api/kb/articles/123/attachments/456" alt="diagram" />');
    // relative URLs (no scheme) are allowed through since our own attachment links are relative
    expect(result).toContain('/api/kb/articles/123/attachments/456');
  });

  it('adds rel=noopener noreferrer to links', () => {
    const result = sanitizeArticleHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('preserves the data-list attribute that encodes a checklist runbook step checked state', () => {
    const html = '<ul><li data-list="checked">Step one</li><li data-list="unchecked">Step two</li></ul>';
    const result = sanitizeArticleHtml(html);
    expect(result).toContain('data-list="checked"');
    expect(result).toContain('data-list="unchecked"');
  });

  it('still strips unrelated attributes on li even though data-list is now allowed', () => {
    const result = sanitizeArticleHtml('<ul><li data-list="checked" onclick="alert(1)">Step</li></ul>');
    expect(result).toContain('data-list="checked"');
    expect(result).not.toContain('onclick');
  });
});
