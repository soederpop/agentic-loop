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

export interface CommsServiceHooks {
  log?: (source: string, message: string) => void
  recordEvent?: (source: string, event: string, data?: any) => void
}

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

const IMSG_REPLY_PREFIX = '(from the chief) '

// Dedup window for iMessage — self-chat delivers the same text multiple times
const recentImsgIds = new Map<string, number>() // message key → timestamp
const DEDUP_WINDOW_MS = 30_000

// Circuit breaker: disable imsg if >10 messages land in 30s
const imsgTimestamps: number[] = []
const CIRCUIT_BREAKER_LIMIT = 10
const CIRCUIT_BREAKER_WINDOW_MS = 30_000
let imsgCircuitBroken = false

// Only one imsg message processed at a time — drop anything that arrives mid-flight
let imsgBusy = false

function isImsgDuplicate(payload: any): boolean {
  const now = Date.now()
  // Evict stale entries
  for (const [key, ts] of recentImsgIds) {
    if (now - ts > DEDUP_WINDOW_MS) recentImsgIds.delete(key)
  }
  // Use guid if available (unique per message), fall back to text
  const key = payload?.guid || payload?.text || ''
  if (!key) return false
  if (recentImsgIds.has(key)) return true
  recentImsgIds.set(key, now)
  return false
}

/**
 * Starts the communications service with full message handling, reaction rules,
 * iMessage safety guards, and assistant routing.
 *
 * Returns the Communications feature instance for pause/resume/status integration.
 */
export async function startCommsService(
  container: any,
  channels: { imsg?: boolean; telegram?: boolean; gmail?: boolean },
  hooks: CommsServiceHooks = {},
): Promise<Communications> {
  const log = hooks.log ?? ((source: string, msg: string) => console.log(`[${source}] ${msg}`))
  const recordEvent = hooks.recordEvent ?? (() => {})

  const fs = container.feature('fs')
  const yaml = container.feature('yaml')
  const comms: Communications = container.feature('communications')
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
      log('comms', `assistant "${name}" not found`)
      return null
    }

    const assistant = manager.create(fullName) as Assistant
    assistant.resumeThread(`comms:${name}`)
    await assistant.start()
    assistantCache.set(name, assistant)
    log('comms', `assistant "${name}" started`)
    return assistant
  }

  function isTrustedSender(channel: string, sender: string): boolean {
    const list = trustedSenders[channel] || []
    if (list.length === 0) return true // no list = allow all
    return list.some((s: string) => sender.includes(s))
  }

  function extractSender(channel: string, payload: any): string {
    if (channel === 'imsg') return payload?.sender || payload?.from || ''
    if (channel === 'telegram') return String(payload?.message?.from?.id || payload?.message?.chat?.id || '')
    if (channel === 'gws') {
      const raw = payload?.from || payload?.sender || ''
      // Extract email from "Name <email>" format
      const match = raw.match(/<([^>]+)>/)
      return match ? match[1] : raw
    }
    return ''
  }

  function extractText(channel: string, payload: any): string {
    if (channel === 'imsg') return (payload?.text || payload?.body || '').trim()
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
          const outbound = text.startsWith(IMSG_REPLY_PREFIX) ? text : IMSG_REPLY_PREFIX + text
          await imsg.send(sender, outbound)
          log('comms', `replied via iMessage to ${sender}: ${outbound.slice(0, 80)}`)
        }
      } else if (channel === 'telegram') {
        const chatId = payload?.message?.chat?.id
        if (payload?.reply) {
          await payload.reply(text)
          log('comms', `replied via Telegram to ${chatId}`)
        } else if (chatId) {
          const tg = comms.telegramBot
          await tg.bot.api.sendMessage(chatId, text)
          log('comms', `replied via Telegram to ${chatId}`)
        }
      } else if (channel === 'gws') {
        const sender = extractSender(channel, payload)
        const messageId = payload?.id
        if (sender && messageId) {
          const gws = container.feature('gws')
          const gwsConfig = commsConfig.gws || {}
          if (gwsConfig.profile) gws.useProfile(gwsConfig.profile)
          await gws.helper('gmail', '+reply', {
            params: { 'message-id': messageId, body: text },
            profile: gwsConfig.profile,
          })
          log('comms', `replied via Gmail (in-thread) to ${sender}: ${text.slice(0, 80)}`)
        } else if (sender) {
          // Fallback: no message ID, send as new email
          const gws = container.feature('gws')
          const gwsConfig = commsConfig.gws || {}
          if (gwsConfig.profile) gws.useProfile(gwsConfig.profile)
          const subject = payload?.subject || 'Re: (no subject)'
          const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
          await gws.gmail.send({ to: sender, subject: replySubject, body: text })
          log('comms', `replied via Gmail (new thread) to ${sender}: ${text.slice(0, 80)}`)
        }
      }
    } catch (err: any) {
      log('comms', `failed to send reply on ${channel}: ${err.message}`)
    }
  }

  // Process incoming messages against reaction rules
  comms.on('message', async ({ channel, payload }: { channel: string; payload: any }) => {
    if (channel === 'imsg') {
      log('comms', `[imsg-debug] raw payload: ${JSON.stringify(payload, null, 2)}`)

      // Drop outbound (is_from_me) messages — self-chat delivers both sides
      if (payload?.is_from_me) {
        log('comms', `[imsg-debug] BLOCKED — is_from_me`)
        return
      }

      // Circuit breaker already tripped
      if (imsgCircuitBroken) {
        log('comms', `[imsg-debug] BLOCKED by circuit breaker`)
        return
      }

      const msgText = payload?.text || ''

      // Skip assistant replies (they bounce back because self-chat is all is_from_me)
      if (msgText.startsWith(IMSG_REPLY_PREFIX)) {
        log('comms', `[imsg-debug] BLOCKED — starts with assistant prefix`)
        return
      }

      // Skip duplicate deliveries (self-chat echoes the same message twice)
      if (isImsgDuplicate(payload)) {
        log('comms', `[imsg-debug] BLOCKED — duplicate (guid/text already seen in window)`)
        return
      }

      // Only one message in-flight at a time — drop the rest
      if (imsgBusy) {
        log('comms', `[imsg-debug] BLOCKED — already processing a message`)
        return
      }

      log('comms', `[imsg-debug] PASSED all filters — processing message`)

      // Circuit breaker: too many messages in a short window = likely loop
      const now = Date.now()
      imsgTimestamps.push(now)
      while (imsgTimestamps.length && imsgTimestamps[0] < now - CIRCUIT_BREAKER_WINDOW_MS) {
        imsgTimestamps.shift()
      }
      if (imsgTimestamps.length > CIRCUIT_BREAKER_LIMIT) {
        imsgCircuitBroken = true
        log('comms', `CIRCUIT BREAKER: imsg received ${imsgTimestamps.length} messages in ${CIRCUIT_BREAKER_WINDOW_MS / 1000}s — ignoring all future imsg messages`)
        return
      }
    }

    const sender = extractSender(channel, payload)
    const text = extractText(channel, payload)

    log('comms', `message on ${channel} from ${sender}: ${text.slice(0, 100)}`)
    recordEvent('comms', 'message', { channel, sender, text: text.slice(0, 200) })

    // Find matching rules
    const matchingRules = reactionRules.filter((rule) => {
      if (!rule.enabled) return false
      if (rule.channel !== channel) return false
      if (rule.filters.trustedSendersOnly && !isTrustedSender(channel, sender)) return false
      if (rule.filters.senderMatch && !new RegExp(rule.filters.senderMatch).test(sender)) return false
      if (rule.filters.textMatch && !new RegExp(rule.filters.textMatch, 'i').test(text)) return false
      return true
    })

    if (matchingRules.length === 0) {
      log('comms', `no matching reaction rules for ${channel} message`)
      return
    }

    for (const rule of matchingRules) {
      log('comms', `matched rule: "${rule.name}" → ${rule.action.type}`)
      recordEvent('comms', 'rule:matched', { rule: rule.name, action: rule.action.type, channel })

      if (rule.action.type === 'log') {
        log('comms', `[log] ${channel}/${sender}: ${text}`)
        continue
      }

      if (rule.action.type === 'auto-reply') {
        const assistant = await getAssistant(rule.assistant)
        if (!assistant) continue

        const subject = payload?.subject || ''
        const rawPrompt = buildPrompt(rule.action.promptTemplate, { sender, channel, text, subject })
        const prompt = channel === 'gws'
          ? [
              rawPrompt,
              '',
              `IMPORTANT: This is an email from ${sender}${subject ? ` with subject "${subject}"` : ''}.`,
              `Your response will be sent as a reply email directly to ${sender}.`,
              `Write a clear, professional email response. Do NOT include email headers (To/From/Subject) in your response — just the body text.`,
              `Do NOT reference any relay system. Respond naturally as if you are replying to their email directly.`,
            ].join('\n')
          : [
              rawPrompt,
              '',
              `IMPORTANT: Your response will be sent directly to ${sender} via ${channel}. ` +
              `The user is talking to YOU — they don't know about any relay or intermediary. ` +
              `Respond as if you are speaking directly to them in a conversation. ` +
              `Do NOT reference receiving a message from someone, do NOT mention the channel or relay system. ` +
              `Just reply naturally and directly to what they said.`,
            ].join('\n')

        if (channel === 'imsg') imsgBusy = true
        try {
          log('comms', `asking ${rule.assistant}...`)
          let response = await assistant.ask(prompt)

          if (rule.action.maxResponseLength && response.length > rule.action.maxResponseLength) {
            response = response.slice(0, rule.action.maxResponseLength)
          }

          const replyText = channel === 'imsg' ? IMSG_REPLY_PREFIX + response : response
          await sendReply(channel, payload, replyText)
          recordEvent('comms', 'reply:sent', { channel, sender, rule: rule.name })
        } catch (err: any) {
          log('comms', `assistant error for rule "${rule.name}": ${err.message}`)
          recordEvent('comms', 'reply:error', { rule: rule.name, error: err.message })
        } finally {
          if (channel === 'imsg') imsgBusy = false
        }
      }

      if (rule.action.type === 'notify') {
        comms.emit('notification', { rule, channel, sender, text, payload })
        log('comms', `notification emitted for rule "${rule.name}"`)
        recordEvent('comms', 'notification', { rule: rule.name, channel })
      }
    }
  })

  // Activate channels and start
  if (channels.imsg) comms.activateChannel('imsg', {})
  if (channels.telegram) comms.activateChannel('telegram', {})
  if (channels.gmail) {
    const gwsConfig = commsConfig.gws || {}
    comms.activateChannel('gmail', {
      profile: gwsConfig.profile || null,
      pollIntervalMs: gwsConfig.pollIntervalMs || 120_000,
      trustedSenders: trustedSenders.gws || [],
    })
  }

  // Forward log events from the communications feature
  comms.on('log', (msg: string) => log('comms', msg))

  await comms.start()

  const enabledRules = reactionRules.filter(r => r.enabled).length
  log('comms', `service started — channels: ${comms.activeChannels.join(', ')}, ${enabledRules} reaction rules`)
  recordEvent('comms', 'started', { channels: comms.activeChannels, ruleCount: enabledRules })

  return comms
}

/**
 * CLI command — thin wrapper around startCommsService for standalone use.
 */
export default async function commsServiceCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  const comms = await startCommsService(container, {
    imsg: options.imsg,
    telegram: options.telegram,
    gmail: options.gmail,
  })

  await comms.waitFor('stopped')
}
