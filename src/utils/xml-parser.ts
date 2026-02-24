interface RssItem {
  readonly title: string
  readonly url: string
  readonly pubDate: Date
  readonly source: string
}

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)

  for (const match of itemMatches) {
    const item = match[1]

    const title = extractCdataOrText(item, 'title')
    const link = extractText(item, 'link')
    const pubDate = extractText(item, 'pubDate')
    const description = extractCdataOrText(item, 'description')

    if (title && link) {
      items.push({
        title: unescapeHtml(title),
        url: link,
        pubDate: pubDate ? new Date(pubDate) : new Date(),
        source: extractSource(description),
      })
    }
  }

  return items
}

function extractCdataOrText(xml: string, tag: string): string {
  const cdataMatch = xml.match(new RegExp(`<${tag}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))
  if (cdataMatch) return cdataMatch[1]
  return extractText(xml, tag)
}

function extractText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))
  return match ? match[1] : ''
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

function extractSource(description: string): string {
  const match = description.match(/>([^<]+)<\/a>/)
  return match ? match[1].trim() : ''
}
