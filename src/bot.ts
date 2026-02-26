import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { getEnv } from './utils/config-loader.js'
import { registerReactionHandler } from './events/reaction-handler.js'

async function startBot(): Promise<void> {
  console.log('=== ニュース通知Bot 常時起動モード ===')
  console.log(`起動時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`)

  const env = getEnv()

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
      Partials.Message,
      Partials.Reaction,
      Partials.User,
    ],
  })

  // Discord接続（readyリスナーをlogin前に登録してイベント取りこぼしを防ぐ）
  const readyPromise = new Promise<void>((resolve) => {
    client.once('ready', () => {
      console.log(`Discord Bot 接続完了: ${client.user?.tag}`)
      resolve()
    })
  })
  await client.login(env.discordBotToken)
  await readyPromise

  // リアクションハンドラー登録
  registerReactionHandler(client, env.discordChannelId)

  // 安全な終了処理
  const shutdown = () => {
    console.log('\nBot停止中...')
    client.destroy()
    console.log('Discord Bot 切断完了')
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  console.log('\nBot起動完了 - リアクション待機中...')
}

startBot().catch(error => {
  console.error('Bot起動エラー:', error)
  process.exit(1)
})
