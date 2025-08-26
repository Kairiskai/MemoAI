import { load } from 'cheerio';
import type { Conversation } from '@/types/conversation';

/** Minimal shapes we expect from Claude share JSON */
interface ClaudeContentChunk {
  text?: string;
  value?: string;
}

interface ClaudeMessage {
  role?: string;
  author?: string;
  text?: string;
  content?: string | ClaudeContentChunk[];
}

interface NextData {
  props?: {
    pageProps?: {
      conversation?: { messages?: ClaudeMessage[] };
      messages?: ClaudeMessage[];
    };
    messages?: ClaudeMessage[];
  };
  messages?: ClaudeMessage[];
}

/** Try to pick message array from several likely JSON paths */
function pickMessages(data: NextData | null): ClaudeMessage[] | null {
  if (!data) return null;
  const candidates = [
    data.props?.pageProps?.conversation?.messages,
    data.props?.pageProps?.messages,
    data.props?.messages,
    data.messages,
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr)) return arr;
  }
  return null;
}

/** Convert a single message to markdown text */
function messageToMarkdown(m: ClaudeMessage): string | null {
  const role = m.role ?? m.author ?? '';
  // text first
  if (typeof m.text === 'string' && m.text.trim()) {
    return role ? `**${role}:**\n${m.text.trim()}` : m.text.trim();
  }
  // array content
  if (Array.isArray(m.content)) {
    const joined = m.content
      .map((c) => (c.text ?? c.value ?? ''))
      .filter((t) => t && t.trim())
      .join('\n')
      .trim();
    if (joined) return role ? `**${role}:**\n${joined}` : joined;
  }
  // string content
  if (typeof m.content === 'string' && m.content.trim()) {
    return role ? `**${role}:**\n${m.content.trim()}` : m.content.trim();
  }
  return null;
}

/**
 * Claude share-page parser
 * Only returns the conversation content (no full page).
 */
export async function parseClaude(html: string): Promise<Conversation> {
  const $ = load(html);

  // 1) Prefer structured JSON if present
  const raw = $('script#__NEXT_DATA__').first().text();
  if (raw) {
    try {
      const data = JSON.parse(raw) as NextData;
      const messages = pickMessages(data);
      if (messages && messages.length) {
        const parts: string[] = [];
        for (const m of messages) {
          const piece = messageToMarkdown(m);
          if (piece) parts.push(piece);
        }
        if (parts.length) {
          return {
            model: 'Claude',
            content: parts.join('\n\n'),
            scrapedAt: new Date().toISOString(),
            sourceHtmlBytes: html.length,
          };
        }
      }
    } catch {
      // fall back to DOM scraping if JSON parsing fails
    }
  }

  // 2) Fallback: scrape DOM
  const isShare = $('[data-testid="share-root"], main [data-testid="message"]').length > 0;
  const nodes = isShare
    ? $('main [data-testid="message"]')
    : $('[data-testid="message"], [data-author], [data-role], article');

  const chunks: string[] = [];
  nodes.each((_, el) => {
    const node = $(el);
    const role =
      node.attr('data-author') ||
      node.attr('data-role') ||
      node.find('[data-role]').first().attr('data-role') ||
      '';

    const rich = node
      .find('[data-testid="message-text"], .markdown, .prose, [data-markdown]')
      .first();
    const text = (rich.length ? rich.text() : node.text() || '').trim();

    if (text) {
      chunks.push(role ? `**${role}:**\n${text}` : text);
    }
  });

  const content =
    chunks.length
      ? chunks.join('\n\n')
      : ($('main').text().trim() || $('body').text().trim() || '').slice(0, 20000);

  return {
    model: 'Claude',
    content,
    scrapedAt: new Date().toISOString(),
    sourceHtmlBytes: html.length,
  };
}
