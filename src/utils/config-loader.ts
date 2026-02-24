import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { Watchlist } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..', '..')

export function loadWatchlist(): Watchlist {
  const raw = readFileSync(join(rootDir, 'config', 'watchlist.json'), 'utf-8')
  return JSON.parse(raw)
}

export function getEnv(): { geminiApiKey: string; discordBotToken: string; discordChannelId: string } {
  const required = ['GEMINI_API_KEY', 'DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`環境変数が未設定です: ${missing.join(', ')}`)
  }

  return {
    geminiApiKey: process.env.GEMINI_API_KEY!,
    discordBotToken: process.env.DISCORD_BOT_TOKEN!,
    discordChannelId: process.env.DISCORD_CHANNEL_ID!,
  }
}

export function getRootDir(): string {
  return rootDir
}
