import { runNewsJob } from './jobs/news-job.js'

// バッチ実行モード（GitHub Actions / 手動実行用）
runNewsJob().catch(error => {
  console.error('実行エラー:', error)
  process.exit(1)
})
