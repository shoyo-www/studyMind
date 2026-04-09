export function stripReasoningBlocks(text = '') {
  const rawText = `${text || ''}`

  return rawText
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
    .replace(/^\s*<think\b[^>]*>[\s\S]*$/i, '')
    .replace(/^\s*<thinking\b[^>]*>[\s\S]*$/i, '')
    .trim()
}
