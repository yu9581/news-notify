export function extractJSON(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text)
  } catch { /* empty */ }

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch { /* empty */ }
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch { /* empty */ }
  }

  return null
}
