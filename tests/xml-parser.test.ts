import { describe, it, expect } from 'vitest'
import { parseRssItems } from '../src/utils/xml-parser.js'

describe('parseRssItems', () => {
  it('標準的なRSSアイテムをパースできる', () => {
    const xml = `
      <rss>
        <channel>
          <item>
            <title>Test Article Title</title>
            <link>https://example.com/article1</link>
            <pubDate>Mon, 24 Feb 2026 10:00:00 GMT</pubDate>
            <description>Article description</description>
          </item>
        </channel>
      </rss>
    `

    const items = parseRssItems(xml)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Test Article Title')
    expect(items[0].url).toBe('https://example.com/article1')
    expect(items[0].pubDate).toBeInstanceOf(Date)
  })

  it('CDATAセクション付きのアイテムをパースできる', () => {
    const xml = `
      <item>
        <title><![CDATA[CDATA Title & Special <chars>]]></title>
        <link>https://example.com/cdata</link>
        <pubDate>Tue, 25 Feb 2026 12:00:00 GMT</pubDate>
        <description><![CDATA[<a href="https://source.com">Source Name</a>]]></description>
      </item>
    `

    const items = parseRssItems(xml)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('CDATA Title & Special <chars>')
    expect(items[0].source).toBe('Source Name')
  })

  it('HTMLエスケープ文字をデコードできる', () => {
    const xml = `
      <item>
        <title>Title with &amp; and &lt;tags&gt; and &quot;quotes&quot;</title>
        <link>https://example.com/escaped</link>
        <pubDate>Wed, 26 Feb 2026 08:00:00 GMT</pubDate>
        <description></description>
      </item>
    `

    const items = parseRssItems(xml)
    expect(items[0].title).toBe('Title with & and <tags> and "quotes"')
  })

  it('複数のアイテムをパースできる', () => {
    const xml = `
      <item>
        <title>Article 1</title>
        <link>https://example.com/1</link>
        <description></description>
      </item>
      <item>
        <title>Article 2</title>
        <link>https://example.com/2</link>
        <description></description>
      </item>
      <item>
        <title>Article 3</title>
        <link>https://example.com/3</link>
        <description></description>
      </item>
    `

    const items = parseRssItems(xml)
    expect(items).toHaveLength(3)
  })

  it('titleまたはlinkがないアイテムはスキップする', () => {
    const xml = `
      <item>
        <title>Valid Article</title>
        <link>https://example.com/valid</link>
        <description></description>
      </item>
      <item>
        <title>No Link Article</title>
        <description></description>
      </item>
      <item>
        <link>https://example.com/no-title</link>
        <description></description>
      </item>
    `

    const items = parseRssItems(xml)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Valid Article')
  })

  it('空のXMLでは空配列を返す', () => {
    const items = parseRssItems('<rss><channel></channel></rss>')
    expect(items).toHaveLength(0)
  })

  it('pubDateがない場合は現在日時を使う', () => {
    const xml = `
      <item>
        <title>No Date Article</title>
        <link>https://example.com/nodate</link>
        <description></description>
      </item>
    `

    const before = new Date()
    const items = parseRssItems(xml)
    const after = new Date()

    expect(items[0].pubDate.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(items[0].pubDate.getTime()).toBeLessThanOrEqual(after.getTime())
  })
})
