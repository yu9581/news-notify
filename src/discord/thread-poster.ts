import type { Client } from 'discord.js'
import { splitIntoChunks, CHUNK_HEADER } from '../ai/translator.js'

const CHUNK_DELAY_MS = 1000
const PENDING_MESSAGE = '📖 翻訳しています...'

interface EditableMessage {
  edit(content: string): Promise<unknown>
}

interface ThreadSendable {
  send(content: string): Promise<EditableMessage>
}

interface MessageWithThread {
  thread: ThreadSendable | null
  hasThread: boolean
}

function getThread(client: Client, channelId: string, messageId: string) {
  return {
    async fetch(): Promise<ThreadSendable> {
      const channel = await client.channels.fetch(channelId)
      if (!channel || !('messages' in channel)) {
        throw new Error(`チャンネル ${channelId} が見つかりません`)
      }

      const textChannel = channel as unknown as {
        messages: { fetch(id: string): Promise<MessageWithThread> }
      }
      const message = await textChannel.messages.fetch(messageId)

      if (!message.thread) {
        throw new Error(`スレッドが見つかりません: ${messageId}`)
      }

      return message.thread
    },
  }
}

export async function sendPendingMessage(
  client: Client,
  channelId: string,
  messageId: string
): Promise<EditableMessage> {
  const thread = await getThread(client, channelId, messageId).fetch()
  return thread.send(PENDING_MESSAGE)
}

export async function postTranslationToThread(
  client: Client,
  channelId: string,
  messageId: string,
  translatedText: string,
  pendingMessage?: EditableMessage
): Promise<void> {
  const thread = await getThread(client, channelId, messageId).fetch()
  const chunks = splitIntoChunks(translatedText)

  for (let i = 0; i < chunks.length; i++) {
    const content = i === 0 ? CHUNK_HEADER + chunks[i] : chunks[i]

    if (i === 0 && pendingMessage) {
      await pendingMessage.edit(content)
    } else {
      await thread.send(content)
    }

    if (i < chunks.length - 1) {
      await sleep(CHUNK_DELAY_MS)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
