import type { SummarizedArticle } from '../utils/types.js'

export function filterByRelevance(
  articles: readonly SummarizedArticle[],
  threshold: number
): { readonly passed: readonly SummarizedArticle[]; readonly filtered: readonly SummarizedArticle[] } {
  const passed: SummarizedArticle[] = []
  const filtered: SummarizedArticle[] = []

  for (const article of articles) {
    if (article.relevance >= threshold) {
      passed.push(article)
    } else {
      filtered.push(article)
    }
  }

  return { passed, filtered }
}
