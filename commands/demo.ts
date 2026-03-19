import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({
	assistant: z.string().default('chiefOfStaff').describe('Which assistant to chat with'),
	silenceTimeout: z.number().default(4).describe('Seconds to wait for speech before giving up'),
})

async function demo(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const { container } = context
	await container.helpers.discover('features')

	const ink = container.feature('ink', { enable: true })
	await ink.loadModules()

	const React = ink.React
	const h = React.createElement
	const { Box, Text, Spacer } = ink.components
	const { useState, useEffect, useRef, useCallback } = React
	const { useInput, useApp } = ink.hooks

	const router = container.feature('voiceRouter')
	await router.loadHandlers()

	const listener = container.feature('voiceListener')
	const voiceChat = container.feature('voiceChat', {
		assistant: options.assistant,
		playPhrases: true,
	}) as any

	await voiceChat.start()

	// ── Cyberpunk theme constants ──────────────────────────────────────────

	const CYAN = '#00fff7'
	const MAGENTA = '#ff00ff'
	const YELLOW = '#ffff00'
	const GREEN = '#39ff14'
	const RED = '#ff003c'
	const DIM = '#444466'

	const GLYPHS = {
		topLeft: '\u2554',
		topRight: '\u2557',
		botLeft: '\u255A',
		botRight: '\u255D',
		horiz: '\u2550',
		vert: '\u2551',
		bullet: '\u25B8',
		block: '\u2588',
		halfBlock: '\u2584',
		lightBlock: '\u2591',
		medBlock: '\u2592',
		heavyBlock: '\u2593',
		diamond: '\u25C6',
		arrow: '\u25B6',
		dot: '\u2022',
	}

	// ── VU Meter Bar ──────────────────────────────────────────────────────

	function VUBar({ level, width, color, label, animated }: any) {
		const barWidth = width || 30
		const filled = Math.round(level * barWidth)
		const empty = barWidth - filled

		const blocks = []
		for (let i = 0; i < filled; i++) {
			const intensity = i / barWidth
			const blockColor = intensity > 0.8 ? RED : intensity > 0.5 ? YELLOW : color || GREEN
			blocks.push(h(Text, { key: `f${i}`, color: blockColor }, GLYPHS.block))
		}
		for (let i = 0; i < empty; i++) {
			blocks.push(h(Text, { key: `e${i}`, color: DIM }, GLYPHS.lightBlock))
		}

		return h(Box, null,
			label ? h(Text, { color: color || CYAN, bold: true }, `${label} `) : null,
			h(Text, { color: DIM }, '['),
			...blocks,
			h(Text, { color: DIM }, ']'),
			h(Text, { color: color || GREEN, dimColor: level < 0.01 }, ` ${(level * 100).toFixed(0).padStart(3)}%`),
		)
	}

	// ── Spinner / pulse hook ──────────────────────────────────────────────

	function usePulse(active: boolean, fps = 12): number {
		const [frame, setFrame] = useState(0)

		useEffect(() => {
			if (!active) return
			const interval = setInterval(() => {
				setFrame((prev: number) => prev + 1)
			}, 1000 / fps)
			return () => clearInterval(interval)
		}, [active])

		return frame
	}

	function useAnimatedVU(active: boolean): number {
		const frame = usePulse(active, 20)
		if (!active) return 0
		// Simulate speech VU with a randomized bounce
		const base = 0.3 + Math.sin(frame * 0.3) * 0.15
		const jitter = (Math.sin(frame * 1.7) * 0.1) + (Math.sin(frame * 3.1) * 0.08)
		return Math.max(0, Math.min(1, base + jitter))
	}

	// ── Header ────────────────────────────────────────────────────────────

	function Header({ assistantName }: any) {
		const frame = usePulse(true, 2)
		const glitch = frame % 4 === 0

		return h(Box, { flexDirection: 'column', paddingX: 1 },
			h(Box, null,
				h(Text, { color: CYAN, bold: true },
					glitch ? `${GLYPHS.diamond} V0!CE_L1NK ${GLYPHS.diamond}` : `${GLYPHS.diamond} VOICE_LINK ${GLYPHS.diamond}`
				),
				h(Spacer),
				h(Text, { color: MAGENTA }, `${GLYPHS.arrow} ${assistantName.toUpperCase()}`),
				h(Text, { color: DIM }, `  ${GLYPHS.dot} `),
				h(Text, { color: GREEN }, 'ONLINE'),
			),
			h(Text, { color: DIM },
				GLYPHS.horiz.repeat(process.stdout.columns ? process.stdout.columns - 2 : 78)
			),
		)
	}

	// ── Chat Message ──────────────────────────────────────────────────────

	function ChatMessage({ role, text, isStreaming }: any) {
		const frame = usePulse(!!isStreaming, 4)
		const cursor = isStreaming ? (frame % 2 === 0 ? GLYPHS.block : ' ') : ''

		const roleColor = role === 'user' ? CYAN : MAGENTA
		const roleLabel = role === 'user' ? 'YOU' : 'AI'

		return h(Box, {
			flexDirection: 'column',
			paddingX: 1,
			marginBottom: 0,
		},
			h(Box, null,
				h(Text, { color: roleColor, bold: true }, `${GLYPHS.bullet} ${roleLabel} `),
				h(Text, { color: DIM }, role === 'user' ? '(voice)' : '(speaking)'),
			),
			h(Box, { paddingLeft: 2 },
				h(Text, { wrap: 'wrap', color: role === 'user' ? '#aaeeff' : '#ffaaff' },
					text + cursor
				),
			),
		)
	}

	// ── Status Indicator ──────────────────────────────────────────────────

	function StatusIndicator({ phase, transcript }: any) {
		const frame = usePulse(true, 6)
		const dots = '.'.repeat((frame % 3) + 1).padEnd(3)

		const phases: Record<string, { color: string; label: string; icon: string }> = {
			idle: { color: DIM, label: 'STANDBY', icon: GLYPHS.diamond },
			listening: { color: GREEN, label: `LISTENING${dots}`, icon: GLYPHS.arrow },
			recording: { color: RED, label: `RECORDING${dots}`, icon: GLYPHS.dot },
			transcribing: { color: YELLOW, label: `TRANSCRIBING${dots}`, icon: GLYPHS.heavyBlock },
			thinking: { color: MAGENTA, label: `THINKING${dots}`, icon: GLYPHS.medBlock },
			speaking: { color: CYAN, label: `SPEAKING${dots}`, icon: GLYPHS.arrow },
		}

		const current = phases[phase] || phases.idle

		return h(Box, { paddingX: 1 },
			h(Text, { color: current.color, bold: true },
				`${current.icon} ${current.label}`
			),
			transcript ? h(Box, { marginLeft: 2 },
				h(Text, { color: DIM, dimColor: true }, `preview: "${transcript.slice(0, 50)}${transcript.length > 50 ? '...' : ''}"`),
			) : null,
		)
	}

	// ── Footer ────────────────────────────────────────────────────────────

	function Footer() {
		return h(Box, { paddingX: 1, flexDirection: 'column' },
			h(Text, { color: DIM },
				GLYPHS.horiz.repeat(process.stdout.columns ? process.stdout.columns - 2 : 78)
			),
			h(Box, null,
				h(Text, { color: DIM }, `${GLYPHS.bullet} `),
				h(Text, { color: CYAN }, 'SPACE'),
				h(Text, { color: DIM }, ':talk  '),
				h(Text, { color: CYAN }, 'ESC'),
				h(Text, { color: DIM }, ':quit  '),
				h(Spacer),
				h(Text, { color: DIM }, `silenceTimeout:${options.silenceTimeout}s`),
			),
		)
	}

	// ── Main App ──────────────────────────────────────────────────────────

	function App() {
		const { exit } = useApp()

		type Message = { role: 'user' | 'assistant'; text: string }
		const [messages, setMessages] = useState<Message[]>([])
		const [phase, setPhase] = useState('idle')
		const [vuLevel, setVuLevel] = useState(0)
		const [streamingText, setStreamingText] = useState('')
		const [transcript, setTranscript] = useState('')
		const [isProcessing, setIsProcessing] = useState(false)

		const animatedVU = useAnimatedVU(phase === 'speaking')
		const displayVU = phase === 'speaking' ? animatedVU : vuLevel

		// Wire up listener events
		useEffect(() => {
			const onVU = (level: number) => setVuLevel(level)
			const onRecordStart = () => {
				setPhase('recording')
				setVuLevel(0.5) // Show activity when recording
			}
			const onRecordStop = () => setPhase('transcribing')
			const onPreview = (text: string) => setTranscript(text)

			listener.on('vu', onVU)
			listener.on('recording:start', onRecordStart)
			listener.on('recording:stop', onRecordStop)
			listener.on('preview', onPreview)

			return () => {
				listener.off('vu', onVU)
				listener.off('recording:start', onRecordStart)
				listener.off('recording:stop', onRecordStop)
				listener.off('preview', onPreview)
			}
		}, [])

		// Wire up voiceChat events for streaming response text
		useEffect(() => {
			const onChunk = (chunk: string) => {
				setStreamingText((prev: string) => prev + chunk)
			}

			voiceChat.assistant.on('chunk', onChunk)

			return () => {
				voiceChat.assistant.off('chunk', onChunk)
			}
		}, [])

		// Voice conversation loop
		const startListening = useCallback(async () => {
			if (isProcessing) return
			setIsProcessing(true)
			setPhase('listening')
			setTranscript('')
			setVuLevel(0)

			const text = await listener.listen({ silenceTimeout: options.silenceTimeout })

			if (!text.trim()) {
				setPhase('idle')
				setIsProcessing(false)
				return
			}

			// Add user message
			setMessages((prev: Message[]) => [...prev, { role: 'user', text: text.trim() }])
			setPhase('thinking')
			setStreamingText('')

			// Get AI response (speech happens via SpeechStreamer)
			setPhase('speaking')
			const response = await voiceChat.say(text.trim())

			// Add completed assistant message
			setMessages((prev: Message[]) => [...prev, { role: 'assistant', text: response }])
			setStreamingText('')
			setPhase('idle')
			setIsProcessing(false)
		}, [isProcessing])

		useInput((input: string, key: any) => {
			if (key.escape) {
				exit()
				return
			}
			if (input === ' ' && !isProcessing) {
				startListening()
			}
		})

		// Build visible messages — show last N to fit screen
		const termRows = process.stdout.rows || 40
		const maxMessages = Math.max(2, Math.floor((termRows - 12) / 4))
		const visibleMessages = messages.slice(-maxMessages)

		return h(Box, {
			flexDirection: 'column',
			width: '100%',
			height: termRows,
		},
			// Header
			h(Header, { assistantName: options.assistant }),

			// Chat history
			h(Box, {
				flexDirection: 'column',
				flexGrow: 1,
				paddingX: 0,
			},
				...visibleMessages.map((msg: Message, i: number) =>
					h(ChatMessage, {
						key: i,
						role: msg.role,
						text: msg.text,
						isStreaming: false,
					})
				),
				// Streaming assistant response
				streamingText ? h(ChatMessage, {
					key: 'streaming',
					role: 'assistant',
					text: streamingText,
					isStreaming: true,
				}) : null,
			),

			// VU meter
			h(Box, { paddingX: 1, flexDirection: 'column' },
				h(VUBar, {
					level: displayVU,
					width: Math.min(40, (process.stdout.columns || 80) - 16),
					color: phase === 'speaking' ? MAGENTA : phase === 'recording' ? RED : GREEN,
					label: phase === 'speaking' ? 'OUT' : 'MIC',
					animated: phase === 'speaking',
				}),
			),

			// Status
			h(StatusIndicator, { phase, transcript }),

			// Footer
			h(Footer),
		)
	}

	// ── Mount and run ─────────────────────────────────────────────────────
	process.stdout.write('\x1B[2J\x1B[3J\x1B[H')

	await ink.render(h(App))
	await ink.waitUntilExit()
}

export default {
	description: 'Cyberpunk voice chat terminal',
	argsSchema,
	handler: demo,
}
