import { Client, GatewayIntentBits, Partials } from 'discord.js'
import cron from 'node-cron'
import { getEnv } from './utils/config-loader.js'
import { registerReactionHandler } from './events/reaction-handler.js'
import { runNewsJob } from './jobs/news-job.js'

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

  // ニュース収集ジョブをスケジュール（JST 7:00, 13:00, 19:00）
  // cron式はUTC: 22:00, 4:00, 10:00
  let jobRunning = false
  const scheduleJob = (cronExpr: string, label: string) => {
    cron.schedule(cronExpr, async () => {
      if (jobRunning) {
        console.log(`${label}: 前回のジョブがまだ実行中のためスキップ`)
        return
      }
      jobRunning = true
      try {
        console.log(`\n${label}: ニュース収集ジョブ開始`)
        await runNewsJob({ client, channelId: env.discordChannelId })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`${label}: ジョブ実行エラー: ${msg}`)
      } finally {
        jobRunning = false
      }
    })
    console.log(`スケジュール登録: ${label} (${cronExpr})`)
  }

  scheduleJob('0 22 * * *', 'JST 7:00')
  scheduleJob('0 4 * * *', 'JST 13:00')
  scheduleJob('0 10 * * *', 'JST 19:00')

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
