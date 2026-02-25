import { describe, it, expect } from 'vitest'
import { splitIntoChunks } from '../src/ai/translator.js'

describe('splitIntoChunks', () => {
  it('短いテキストは1チャンクになる', () => {
    const text = 'これは短いテキストです。'
    const chunks = splitIntoChunks(text)

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(text)
  })

  it('長いテキストは複数チャンクに分割される', () => {
    const paragraph = 'これはテスト用の文章です。' + 'あ'.repeat(1900) + '\n\n'
    const text = paragraph + paragraph + paragraph

    const chunks = splitIntoChunks(text)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(2000)
    }
  })

  it('段落の切れ目で分割する', () => {
    const part1 = 'あ'.repeat(900)
    const part2 = 'い'.repeat(900)
    const text = part1 + '\n\n' + part2

    const chunks = splitIntoChunks(text)

    // ヘッダー分を考慮して最初のチャンクの上限はやや小さい
    // テキスト全体が1チャンクに収まるならそのまま
    if (chunks.length === 1) {
      expect(chunks[0]).toBe(text)
    } else {
      expect(chunks[0]).toContain(part1)
    }
  })

  it('句点で分割する', () => {
    const sentence = 'これはテスト文です。'
    // 1950文字のヘッダー込み上限に合わせて句点で分割されるか
    const text = sentence.repeat(250) // 約2500文字

    const chunks = splitIntoChunks(text)

    expect(chunks.length).toBeGreaterThan(1)
    // 各チャンクが句点で終わるか確認（最終チャンク以外）
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i]).toMatch(/。$/)
    }
  })

  it('空テキストは空配列を返す', () => {
    const chunks = splitIntoChunks('')
    expect(chunks).toHaveLength(0)
  })

  it('ちょうど2000文字のテキストは1チャンクになる', () => {
    // ヘッダー分を引いた文字数
    const headerLength = '📖 **全文翻訳**\n\n'.length
    const text = 'あ'.repeat(2000 - headerLength)
    const chunks = splitIntoChunks(text)

    expect(chunks).toHaveLength(1)
  })
})

describe('createTranslator', () => {
  it('ファクトリ関数がtranslateArticleメソッドを返す', async () => {
    const { createTranslator } = await import('../src/ai/translator.js')
    const translator = createTranslator('test-api-key')

    expect(translator).toHaveProperty('translateArticle')
    expect(typeof translator.translateArticle).toBe('function')
  })
})
