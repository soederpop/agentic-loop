# ElevenLabsClient (clients.elevenlabs)

ElevenLabs client — text-to-speech synthesis via the ElevenLabs REST API. Provides methods for listing voices, listing models, and generating speech audio. Audio is returned as a Buffer; use `say()` for a convenience method that writes to disk.

## Usage

```ts
container.client('elevenlabs', {
  // Base URL for the client connection
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
  // ElevenLabs API key (falls back to ELEVENLABS_API_KEY env var)
  apiKey,
  // Default voice ID for speech synthesis
  defaultVoiceId,
  // Default TTS model ID
  defaultModelId,
  // Audio output format (e.g. mp3_44100_128, pcm_16000)
  outputFormat,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | Base URL for the client connection |
| `json` | `boolean` | Whether to automatically parse responses as JSON |
| `apiKey` | `string` | ElevenLabs API key (falls back to ELEVENLABS_API_KEY env var) |
| `defaultVoiceId` | `string` | Default voice ID for speech synthesis |
| `defaultModelId` | `string` | Default TTS model ID |
| `outputFormat` | `string` | Audio output format (e.g. mp3_44100_128, pcm_16000) |

## Methods

### beforeRequest

Inject the xi-api-key header before each request.

**Returns:** `void`



### connect

Validate the API key by listing available models.

**Returns:** `Promise<this>`

```ts
await el.connect()
```



### listVoices

List available voices with optional search and filtering.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{
    search?: string
    category?: string
    voice_type?: string
    page_size?: number
    next_page_token?: string
  }` |  | Query parameters for filtering voices |

**Returns:** `Promise<any>`

```ts
const voices = await el.listVoices()
const premade = await el.listVoices({ category: 'premade' })
```



### getVoice

Get details for a single voice.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `voiceId` | `string` | ✓ | The voice ID to look up |

**Returns:** `Promise<any>`

```ts
const voice = await el.getVoice('21m00Tcm4TlvDq8ikWAM')
console.log(voice.name, voice.settings)
```



### listModels

List available TTS models.

**Returns:** `Promise<any[]>`

```ts
const models = await el.listModels()
console.log(models.map(m => m.model_id))
```



### synthesize

Synthesize speech from text, returning audio as a Buffer.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text to convert to speech |
| `options` | `SynthesizeOptions` |  | Voice, model, format, and voice settings overrides |

`SynthesizeOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `voiceId` | `string` |  |
| `modelId` | `string` |  |
| `outputFormat` | `string` |  |
| `voiceSettings` | `ElevenLabsVoiceSettings` |  |
| `disableCache` | `boolean` |  |

**Returns:** `Promise<Buffer>`

```ts
const audio = await el.synthesize('Hello world')
// audio is a Buffer of mp3 data

const custom = await el.synthesize('Hello', {
 voiceId: '21m00Tcm4TlvDq8ikWAM',
 voiceSettings: { stability: 0.5, similarityBoost: 0.8 }
})
```



### say

Synthesize speech and write the audio to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text to convert to speech |
| `outputPath` | `string` | ✓ | File path to write the audio to |
| `options` | `SynthesizeOptions` |  | Voice, model, format, and voice settings overrides |

`SynthesizeOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `voiceId` | `string` |  |
| `modelId` | `string` |  |
| `outputFormat` | `string` |  |
| `voiceSettings` | `ElevenLabsVoiceSettings` |  |
| `disableCache` | `boolean` |  |

**Returns:** `Promise<string>`

```ts
const path = await el.say('Hello world', './hello.mp3')
console.log(`Audio saved to ${path}`)
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `apiKey` | `string` | The resolved API key from options or environment. |

## Events (Zod v4 schema)

### failure

Emitted when a request fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error object |



### voices

Emitted after listing voices

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `array` |  |



### speech

Emitted after speech synthesis completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `voiceId` | `string` |  |
| `text` | `string` |  |
| `audioSize` | `number` |  |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Whether the client is currently connected |
| `requestCount` | `number` | Total number of API requests made |
| `characterCount` | `number` | Total characters sent for synthesis (tracks billing usage) |
| `lastRequestTime` | `any` | Timestamp of the last API request |

## Environment Variables

- `ELEVENLABS_API_KEY`

## Examples

**clients.elevenlabs**

```ts
const el = container.client('elevenlabs')
await el.connect()
const voices = await el.listVoices()
const audio = await el.synthesize('Hello world')
// audio is a Buffer of mp3 data
```



**connect**

```ts
await el.connect()
```



**listVoices**

```ts
const voices = await el.listVoices()
const premade = await el.listVoices({ category: 'premade' })
```



**getVoice**

```ts
const voice = await el.getVoice('21m00Tcm4TlvDq8ikWAM')
console.log(voice.name, voice.settings)
```



**listModels**

```ts
const models = await el.listModels()
console.log(models.map(m => m.model_id))
```



**synthesize**

```ts
const audio = await el.synthesize('Hello world')
// audio is a Buffer of mp3 data

const custom = await el.synthesize('Hello', {
 voiceId: '21m00Tcm4TlvDq8ikWAM',
 voiceSettings: { stability: 0.5, similarityBoost: 0.8 }
})
```



**say**

```ts
const path = await el.say('Hello world', './hello.mp3')
console.log(`Audio saved to ${path}`)
```

