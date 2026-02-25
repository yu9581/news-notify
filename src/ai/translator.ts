import { GoogleGenerativeAI } from '@google/generative-ai'

const TRANSLATE_PROMPT = `以下の英語ニュース記事を日本語に翻訳してください。

ルール:
- 自然で読みやすい日本語にする
- 固有名詞（人名、企業名、製品名）は英語のまま残す
- 段落の区切りを維持する
- 翻訳文のみを返す（説明や注釈は不要）

---
{text}
---`

const DISCORD_MAX_LENGTH = 2000
export const CHUNK_HEADER = '📖 **全文翻訳**\n\n'

export function createTranslator(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  })

  async function translateArticle(text: string): Promise<string> {
    const prompt = TRANSLATE_PROMPT.replace('{text}', () => text)
    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  }

  return { translateArticle }
}

export function splitIntoChunks(text: string): string[] {
  const firstChunkLimit = DISCORD_MAX_LENGTH - CHUNK_HEADER.length
  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    const limit = chunks.length === 0 ? firstChunkLimit : DISCORD_MAX_LENGTH
    if (remaining.length <= limit) {
      chunks.push(remaining)
      break
    }

    const cutPoint = findCutPoint(remaining, limit)
    chunks.push(remaining.slice(0, cutPoint).trimEnd())
    remaining = remaining.slice(cutPoint).trimStart()
  }

  return chunks
}

function findCutPoint(text: string, limit: number): number {
  // 段落の切れ目（空行）
  const paragraphBreak = text.lastIndexOf('\n\n', limit)
  if (paragraphBreak > limit * 0.5) return paragraphBreak

  // 改行
  const lineBreak = text.lastIndexOf('\n', limit)
  if (lineBreak > limit * 0.5) return lineBreak

  // 句点
  const period = text.lastIndexOf('。', limit)
  if (period > limit * 0.5) return period + 1

  // ピリオド + スペース
  const dotSpace = text.lastIndexOf('. ', limit)
  if (dotSpace > limit * 0.5) return dotSpace + 2

  return limit
}
