import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import type { Communications } from '../features/communications'
import type { Assistant } from '@soederpop/luca/agi'

export const description = 'Communications service — listens on channels and routes messages to assistants via reaction rules'

export const argsSchema = z.object({
  _: z.array(z.union([z.string(), z.number()])),
  imsg: z.boolean().default(false).describe('Whether to listen on the imessage channel for new messages'),
  telegram: z.boolean().default(false).describe('Whether to listen on the telegram channel for new messages'),
  gmail: z.boolean().default(false).describe('Whether to listen on the gmail channel for new messages'),
})

interface ReactionRule {
  name: string
  channel: string
  assistant: string
  enabled: boolean
  filters: {
    trustedSendersOnly: boolean
    senderMatch: string
    textMatch: string
  }
  action: {
    type: 'auto-reply' | 'notify' | 'log'
    promptTemplate: string
    maxResponseLength: number
  }
  id: string
}

export default async function commsService(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')
  const yaml = container.feature('yaml')
  const comms = container.feature('communications')
  const manager = container.feature('assistantsManager')

  await manager.discover()

  // Load config
  const configPath = container.paths.resolve('config.yml')
  const config = yaml.parse(fs.readFileSync(configPath, 'utf-8').toString('utf-8'))
  const reactionRules: ReactionRule[] = config.reactionRules || []
  const commsConfig = config.communications || {}

  // Track trusted senders per channel
  const trustedSenders: Record<string, string[]> = {
    imsg: commsConfig.imsg?.trustedSenders || [],
    telegram: commsConfig.telegram?.trustedSenders || [],
    gws: commsConfig.gws?.trustedSenders || [],
  }

  // Cache assistants so we reuse them across messages
  const assistantCache = new Map<string, Assistant>()

  async function getAssistant(name: string): Promise<Assistant | null> {
    if (assistantCache.has(name)) return assistantCache.get(name)!

    const fullName = manager.list().find(
      (e: any) => e.name === name || e.name === `assistants/${name}`
    )?.name

    if (!fullName) {
      console.error(`[comms] assistant "${name}" not found`)
      return null
    }

    const assistant = manager.create(fullName) as Assistant
    assistant.resumeThread(`comms:${name}`)
    await assistant.start()
    assistantCache.set(name, assistant)
    console.log(`[comms] assistant "${name}" started`)
    return assistant
  }

  function isTrustedSender(channel: string, sender: string): boolean {
    const list = trustedSenders[channel] || []
    if (list.length === 0) return true // no list = allow all
    return list.some((s: string) => sender.includes(s))
  }

  function extractSender(channel: string, payload: any): string {
    if (channel === 'imsg') return payload?.sender || payload?.from || ''
    // grammY context: payload.message.from.id / payload.message.chat.id
    if (channel === 'telegram') return String(payload?.message?.from?.id || payload?.message?.chat?.id || '')
    if (channel === 'gws') return payload?.from || payload?.sender || ''
    return ''
  }

  function extractText(channel: string, payload: any): string {
    if (channel === 'imsg') return payload?.text || payload?.body || ''
    // grammY context: payload.message.text
    if (channel === 'telegram') return payload?.message?.text || ''
    if (channel === 'gws') return payload?.body || payload?.text || payload?.snippet || ''
    return ''
  }

  function buildPrompt(template: string, vars: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    return result
  }

  async function sendReply(channel: string, payload: any, text: string) {
    try {
      if (channel === 'imsg') {
        const imsg = container.feature('imsg')
        const sender = extractSender(channel, payload)
        if (sender) {
          await imsg.send(sender, text)
          console.log(`[comms] replied via iMessage to ${sender}`)
        }
      } else if (channel === 'telegram') {
        // payload is a grammY Context — use ctx.reply() or fall back to bot API
        const chatId = payload?.message?.chat?.id
        if (payload?.reply) {
          await payload.reply(text)
          console.log(`[comms] replied via Telegram to ${chatId}`)
        } else if (chatId) {
          const tg = comms.telegramBot
          await tg.bot.api.sendMessage(chatId, text)
          console.log(`[comms] replied via Telegram to ${chatId}`)
        }
      } else if (channel === 'gws') {
        // TODO: implement gws reply
        console.log(`[comms] gws reply not yet implemented`)
      }
    } catch (err: any) {
      console.error(`[comms] failed to send reply on ${channel}:`, err.message)
    }
  }

  // Process incoming messages against reaction rules
  comms.on('message', async ({ channel, payload }: { channel: string; payload: any }) => {
    const sender = extractSender(channel, payload)
    const text = extractText(channel, payload)

    console.log(`[comms] message on ${channel} from ${sender}: ${text.slice(0, 100)}`)

    // Find matching rules
    const matchingRules = reactionRules.filter((rule) => {
      if (!rule.enabled) return false
      if (rule.channel !== channel) return false
      if (rule.filters.trustedSendersOnly && !isTrustedSender(channel, sender)) return false
      if (rule.filters.senderMatch && !new RegExp(rule.filters.senderMatch).test(sender)) return false
      if (rule.filters.textMatch && !new RegExp(rule.filters.textMatch).test(text)) return false
      return true
    })

    if (matchingRules.length === 0) {
      console.log(`[comms] no matching reaction rules for ${channel} message`)
      return
    }

    for (const rule of matchingRules) {
      console.log(`[comms] matched rule: "${rule.name}" → ${rule.action.type}`)

      if (rule.action.type === 'log') {
        console.log(`[comms][log] ${channel}/${sender}: ${text}`)
        continue
      }

      if (rule.action.type === 'auto-reply') {
        const assistant = await getAssistant(rule.assistant)
        if (!assistant) continue

        const prompt = buildPrompt(rule.action.promptTemplate, { sender, channel, text })

        try {
          console.log(`[comms] asking ${rule.assistant}...`)
          let response = await assistant.ask(prompt)

          if (rule.action.maxResponseLength && response.length > rule.action.maxResponseLength) {
            response = response.slice(0, rule.action.maxResponseLength)
          }

          await sendReply(channel, payload, response)
        } catch (err: any) {
          console.error(`[comms] assistant error for rule "${rule.name}":`, err.message)
        }
      }

      if (rule.action.type === 'notify') {
        // Emit an event that other parts of the system can listen to
        comms.emit('notification', { rule, channel, sender, text, payload })
        console.log(`[comms] notification emitted for rule "${rule.name}"`)
      }
    }
  })

  // Activate channels and start
  if (options.imsg) comms.activateChannel('imsg', {})
  if (options.telegram) comms.activateChannel('telegram', {})
  if (options.gmail) comms.activateChannel('gmail', {})

  await comms.start()
  console.log(`[comms] service started — channels: ${comms.activeChannels.join(', ')}`)
  console.log(`[comms] ${reactionRules.filter(r => r.enabled).length} reaction rules loaded`)

  await comms.waitFor('stopped')
}
