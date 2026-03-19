import type { NodeContainer } from '@soederpop/luca'
import type { AGIContainer } from '@soederpop/luca/agi'

type VoiceSettings = {
	stability?: number
	similarityBoost?: number
	style?: number
	speed?: number
	useSpeakerBoost?: boolean
}

type SpeechStreamerOptions = {
	container: AGIContainer & NodeContainer
	voiceId?: string
	modelId?: string
	voiceSettings?: VoiceSettings
	conversationModePrefix?: string
	maxChunkLength?: number
	debug?: boolean
}

/**
 * Buffers streaming LLM text, splits on sentence-ending punctuation,
 * caps chunks at a max length, synthesizes each chunk via ElevenLabs,
 * and plays them sequentially so one finishes before the next starts.
 *
 * Audio tags like [laughs] or [dramatic tone] are treated as atomic
 * tokens and excluded from the spoken-length budget so they don't
 * cause premature chunk splits.
 */
export class SpeechStreamer {
	private container: AGIContainer & NodeContainer
	readonly voiceId: string
	readonly modelId: string | undefined
	readonly voiceSettings: VoiceSettings | undefined
	readonly conversationModePrefix: string | undefined
	private maxChunkLength: number
	private debug: boolean
	private buffer = ''
	private queue: string[] = []
	private playing = false
	private _done = false
	private drainResolve: (() => void) | null = null
	private chunkIndex = 0

	constructor(options: SpeechStreamerOptions) {
		this.container = options.container
		this.voiceId = options.voiceId

		if (!this.voiceId) {
			throw new Error(`You must supply a voiceId`)
		}

		this.modelId = options.modelId || "eleven_v3"
		this.voiceSettings = options.voiceSettings
		this.conversationModePrefix = options.conversationModePrefix
		this.maxChunkLength = options.maxChunkLength || 150
		this.debug = options.debug || false
	}

	/**
	 * Feed a chunk of text from the LLM stream. The streamer accumulates
	 * text and splits on sentence-ending punctuation (.!?;:) or when the
	 * buffer exceeds maxChunkLength.
	 */
	push(text: string) {
		this.buffer += text
		if (this.debug) {
			console.log(`[speech:debug] push: buffer now ${this.buffer.length} chars`)
		}
		this.splitBuffer()
	}

	/**
	 * Signal that the LLM stream is done. Flushes any remaining buffer
	 * and returns a promise that resolves when all audio has finished playing.
	 */
	async finish(): Promise<void> {
		this._done = true

		// Flush whatever is left in the buffer
		const remaining = this.buffer.trim()
		if (remaining) {
			if (this.debug) {
				console.log(`[speech:debug] finish: flushing remaining buffer: "${remaining}"`)
			}
			this.queue.push(remaining)
			this.buffer = ''
		}

		if (this.debug) {
			console.log(`[speech:debug] finish: ${this.queue.length} chunks queued, ${this.chunkIndex} already synthesized`)
		}

		this.startDrain()

		// Wait for queue to fully drain
		if (this.playing || this.queue.length > 0) {
			return new Promise<void>((resolve) => {
				this.drainResolve = resolve
			})
		}
	}

	/**
	 * Compute the "spoken" length of a string — excludes [audio tags] since
	 * they are TTS directives, not spoken text.
	 */
	private spokenLength(text: string): number {
		return text.replace(/\[[^\]]*\]/g, '').length
	}

	private splitBuffer() {
		// Split on sentence-ending punctuation followed by a space or end of buffer.
		// Never split inside a [tag] — treat bracketed content as atomic.
		const punctuationPattern = /([.!?;:])\s+/
		let match: RegExpExecArray | null

		while ((match = punctuationPattern.exec(this.buffer)) !== null) {
			// Make sure we're not inside a [tag]
			const before = this.buffer.slice(0, match.index + match[1].length)
			const openBrackets = (before.match(/\[/g) || []).length
			const closeBrackets = (before.match(/\]/g) || []).length
			if (openBrackets > closeBrackets) {
				// Inside a tag — skip this match by advancing past it
				// Push past this match to find the next one
				const skip = match.index + match[0].length
				const rest = this.buffer.slice(skip)
				const nextMatch = punctuationPattern.exec(rest)
				if (!nextMatch) break
				// Adjust and retry from the top
				continue
			}

			const endIndex = match.index + match[1].length
			const chunk = this.buffer.slice(0, endIndex).trim()

			if (chunk) {
				this.enqueueChunk(chunk)
			}

			this.buffer = this.buffer.slice(endIndex).trimStart()
		}

		// If the spoken length exceeds max without punctuation, force-split at the last space
		while (this.spokenLength(this.buffer) > this.maxChunkLength) {
			const slice = this.buffer.slice(0, this.maxChunkLength + 50) // extra room for tags
			const lastSpace = slice.lastIndexOf(' ')
			const splitAt = lastSpace > 20 ? lastSpace : this.maxChunkLength

			const chunk = this.buffer.slice(0, splitAt).trim()
			if (chunk) {
				this.queue.push(chunk)
			}
			this.buffer = this.buffer.slice(splitAt).trimStart()
		}

		this.startDrain()
	}

	private enqueueChunk(text: string) {
		if (this.spokenLength(text) <= this.maxChunkLength) {
			this.queue.push(text)
			return
		}

		// Split long chunks at spaces near maxChunkLength
		let remaining = text
		while (this.spokenLength(remaining) > this.maxChunkLength) {
			const slice = remaining.slice(0, this.maxChunkLength + 50)
			const lastSpace = slice.lastIndexOf(' ')
			const splitAt = lastSpace > 20 ? lastSpace : this.maxChunkLength
			this.queue.push(remaining.slice(0, splitAt).trim())
			remaining = remaining.slice(splitAt).trimStart()
		}
		if (remaining.trim()) {
			this.queue.push(remaining.trim())
		}
	}

	private startDrain() {
		if (this.playing) return
		this.drainQueue()
	}

	private async drainQueue() {
		if (this.playing) return
		this.playing = true

		let prefetchedAudio: Promise<{ path: string; text: string } | null> | null = null

		while (this.queue.length > 0) {
			let audioResult: { path: string; text: string } | null

			if (prefetchedAudio) {
				// We already started synthesizing this chunk — consume it and shift
				audioResult = await prefetchedAudio
				prefetchedAudio = null
				this.queue.shift()
			} else {
				const chunk = this.queue.shift()!
				audioResult = await this.synthesize(chunk)
			}

			if (!audioResult) continue

			// While this chunk plays, start synthesizing the next one in the background
			if (this.queue.length > 0) {
				prefetchedAudio = this.synthesize(this.queue[0])
			}

			await this.play(audioResult.path, audioResult.text)
		}

		this.playing = false

		// If there's still stuff queued (pushed while we were playing), keep going
		if (this.queue.length > 0) {
			this.drainQueue()
			return
		}

		// If we're done and queue is empty, resolve the drain promise
		if (this._done && this.queue.length === 0 && this.drainResolve) {
			this.drainResolve()
			this.drainResolve = null
		}
	}

	/** Synthesize text to an audio file, returns the path or null on failure. */
	private async synthesize(text: string): Promise<{ path: string; text: string } | null> {
		try {
			const el = this.container.client('elevenlabs')
			if (!el.state.get('connected')) {
				await el.connect()
			}

			const prefixed = this.conversationModePrefix ? `${this.conversationModePrefix} ${text}` : text
			const idx = this.chunkIndex++

			if (this.debug) {
				console.log(`[speech:debug] chunk #${idx} original: "${text}"`)
				console.log(`[speech:debug] chunk #${idx} prefix: "${this.conversationModePrefix || '(none)'}"`)
				console.log(`[speech:debug] chunk #${idx} → elevenlabs: "${prefixed}"`)
				console.log(`[speech:debug] chunk #${idx} voiceId=${this.voiceId} modelId=${this.modelId || 'default'}`)
			}

			const outputPath = `/tmp/voice-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`
			const audio = await el.synthesize(prefixed, {
				voiceId: this.voiceId,
				...(this.modelId ? { modelId: this.modelId } : {}),
				...(this.voiceSettings ? { voiceSettings: this.voiceSettings } : {}),
			})
			await this.container.fs.writeFileAsync(outputPath, audio)
			return { path: outputPath, text }
		} catch (err: any) {
			console.error(`[speech] synthesis failed:`, err.message)
			return null
		}
	}

	/** Play an audio file and clean it up afterward. */
	private async play(outputPath: string, text: string) {
		try {
			console.log(`[speech] playing: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`)
			const proc = this.container.feature('proc')
			await proc.spawnAndCapture('afplay', [outputPath])

			try {
				const { unlinkSync } = await import('fs')
				unlinkSync(outputPath)
			} catch {}
		} catch (err: any) {
			console.error(`[speech] playback failed:`, err.message)
		}
	}
}
