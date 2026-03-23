import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    browserUse: typeof BrowserUse
  }
}

export const BrowserUseStateSchema = FeatureStateSchema.extend({
  session: z.string().default('default').describe('Active browser session name'),
  headed: z.boolean().default(false).describe('Whether the browser window is visible'),
  currentUrl: z.string().optional().describe('The current page URL'),
})
export type BrowserUseState = z.infer<typeof BrowserUseStateSchema>

export const BrowserUseOptionsSchema = FeatureOptionsSchema.extend({
  session: z.string().optional().describe('Default session name'),
  headed: z.boolean().optional().describe('Show browser window by default'),
  profile: z.string().optional().describe('Chrome profile name to use'),
  connect: z.boolean().optional().describe('Auto-discover and connect to a running Chrome via CDP'),
  cdpUrl: z.string().optional().describe('Connect to an existing browser via CDP URL (http:// or ws://)'),
})
export type BrowserUseOptions = z.infer<typeof BrowserUseOptionsSchema>

export const BrowserUseEventsSchema = FeatureEventsSchema.extend({
  navigated: z.tuple([z.string().describe('URL navigated to')]).describe('Emitted after navigating to a URL'),
  clicked: z.tuple([z.string().describe('Target description')]).describe('Emitted after clicking an element'),
  typed: z.tuple([z.string().describe('Text typed')]).describe('Emitted after typing text'),
  screenshot: z.tuple([z.string().describe('Base64 or file path')]).describe('Emitted after taking a screenshot'),
  closed: z.tuple([]).describe('Emitted when the browser session is closed'),
})

/** Result shape from browser-use --json */
interface BrowserUseResult {
  id?: string
  success: boolean
  data: Record<string, any>
}

/**
 * Browser automation feature wrapping the browser-use CLI.
 * Provides programmatic browser control — navigation, clicking, typing,
 * screenshots, JavaScript evaluation, data extraction, and more.
 *
 * @example
 * ```typescript
 * const browser = container.feature('browserUse')
 * await browser.open('https://example.com')
 * const state = await browser.getState()
 * await browser.click('21')
 * await browser.close()
 * ```
 *
 * @extends Feature
 */
export class BrowserUse extends Feature<BrowserUseState, BrowserUseOptions> {
  static override shortcut = 'features.browserUse' as const
  static override stateSchema = BrowserUseStateSchema
  static override optionsSchema = BrowserUseOptionsSchema
  static override eventsSchema = BrowserUseEventsSchema

  static tools = {
    browserOpen: {
      description: 'Navigate the browser to a URL',
      schema: z.object({
        url: z.string().describe('The URL to navigate to'),
      }),
    },
    browserClick: {
      description: 'Click an element by its index number (from browserGetState) or x,y coordinates',
      schema: z.object({
        target: z.string().describe('Element index number, or "x y" coordinates'),
      }),
    },
    browserType: {
      description: 'Type text at the current cursor position in the browser',
      schema: z.object({
        text: z.string().describe('Text to type'),
      }),
    },
    browserInput: {
      description: 'Type text into a specific element by index',
      schema: z.object({
        index: z.string().describe('Element index number'),
        text: z.string().describe('Text to type into the element'),
      }),
    },
    browserGetState: {
      description: 'Get the current browser state including URL, title, and interactive elements with their index numbers',
      schema: z.object({}),
    },
    browserScreenshot: {
      description: 'Take a screenshot of the current page. Returns base64 PNG if no path given.',
      schema: z.object({
        path: z.string().optional().describe('File path to save screenshot to'),
        full: z.boolean().optional().describe('Capture full page screenshot'),
      }),
    },
    browserEval: {
      description: 'Execute JavaScript code in the browser page context',
      schema: z.object({
        js: z.string().describe('JavaScript code to execute'),
      }),
    },
    browserExtract: {
      description: 'Extract structured data from the page using an LLM query',
      schema: z.object({
        query: z.string().describe('Description of what data to extract'),
      }),
    },
    browserScroll: {
      description: 'Scroll the page up or down',
      schema: z.object({
        direction: z.enum(['up', 'down']).default('down').describe('Scroll direction'),
        amount: z.number().optional().describe('Scroll amount in pixels'),
      }),
    },
    browserKeys: {
      description: 'Send keyboard keys (e.g. "Enter", "Control+a", "Escape")',
      schema: z.object({
        keys: z.string().describe('Key combination to send'),
      }),
    },
    browserBack: {
      description: 'Go back in browser history',
      schema: z.object({}),
    },
    browserGetTitle: {
      description: 'Get the current page title',
      schema: z.object({}),
    },
    browserGetHtml: {
      description: 'Get the full HTML of the current page',
      schema: z.object({}),
    },
    browserGetText: {
      description: 'Get the text content of a specific element by index',
      schema: z.object({
        index: z.string().describe('Element index number'),
      }),
    },
    browserSelect: {
      description: 'Select an option from a dropdown element',
      schema: z.object({
        index: z.string().describe('Element index of the dropdown'),
        value: z.string().describe('Value to select'),
      }),
    },
    browserWaitForSelector: {
      description: 'Wait for a CSS selector to appear on the page',
      schema: z.object({
        selector: z.string().describe('CSS selector to wait for'),
      }),
    },
    browserWaitForText: {
      description: 'Wait for text to appear on the page',
      schema: z.object({
        text: z.string().describe('Text to wait for'),
      }),
    },
    browserSwitchTab: {
      description: 'Switch to a different browser tab by index',
      schema: z.object({
        tab: z.string().describe('Tab index to switch to'),
      }),
    },
    browserCloseTab: {
      description: 'Close a browser tab',
      schema: z.object({
        tab: z.string().optional().describe('Tab index to close (current tab if omitted)'),
      }),
    },
    browserClose: {
      description: 'Close the browser session',
      schema: z.object({
        all: z.boolean().optional().describe('Close all sessions'),
      }),
    },
    browserSessions: {
      description: 'List active browser sessions',
      schema: z.object({}),
    },
  }

  static { Feature.register(this, 'browserUse') }

  override async afterInitialize() {
    if (this.options.session) this.state.set('session', this.options.session)
    if (this.options.headed) this.state.set('headed', true)
  }

  /** Build the base args array with global flags */
  private baseArgs(): string[] {
    const args: string[] = ['--json']
    if (this.state.get('headed')) args.push('--headed')
    const session = this.state.get('session')
    if (session && session !== 'default') args.push('--session', session)
    if (this.options.profile) args.push('--profile', this.options.profile)
    if (this.options.connect) args.push('--connect')
    if (this.options.cdpUrl) args.push('--cdp-url', this.options.cdpUrl)
    return args
  }

  /** Execute a browser-use command and parse the JSON result */
  private async exec(subcommand: string, ...cmdArgs: string[]): Promise<BrowserUseResult> {
    const args = [...this.baseArgs(), subcommand, ...cmdArgs]
    const proc = this.container.feature('proc')
    const result = await proc.spawnAndCapture('browser-use', args)

    const stdout = (result.stdout || '').trim()
    if (!stdout) {
      return { success: false, data: { error: result.stderr || 'No output from browser-use' } }
    }

    try {
      return JSON.parse(stdout) as BrowserUseResult
    } catch {
      return { success: true, data: { _raw_text: stdout } }
    }
  }

  // --- Core methods ---

  /**
   * Navigate to a URL
   * @param url - The URL to open
   * @returns The browser-use result
   *
   * @example
   * ```typescript
   * await browserUse.open('https://example.com')
   * ```
   */
  async open(url: string): Promise<BrowserUseResult> {
    const result = await this.exec('open', url)
    if (result.success) {
      this.state.set('currentUrl', url)
      this.emit('navigated', url)
    }
    return result
  }

  /**
   * Click an element by index or coordinates
   * @param target - Element index or "x y" coordinates
   *
   * @example
   * ```typescript
   * await browserUse.click('21')       // click element 21
   * await browserUse.click('100 200')  // click at coordinates
   * ```
   */
  async click(target: string): Promise<BrowserUseResult> {
    const args = target.split(/\s+/)
    const result = await this.exec('click', ...args)
    if (result.success) this.emit('clicked', target)
    return result
  }

  /**
   * Type text at the current cursor position
   * @param text - Text to type
   */
  async type(text: string): Promise<BrowserUseResult> {
    const result = await this.exec('type', text)
    if (result.success) this.emit('typed', text)
    return result
  }

  /**
   * Type text into a specific element
   * @param index - Element index
   * @param text - Text to enter
   */
  async input(index: string, text: string): Promise<BrowserUseResult> {
    return this.exec('input', index, text)
  }

  /**
   * Get the current browser state (URL, title, interactive elements)
   *
   * @example
   * ```typescript
   * const state = await browserUse.getState()
   * console.log(state.data._raw_text)
   * ```
   */
  async getState(): Promise<BrowserUseResult> {
    return this.exec('state')
  }

  /**
   * Take a screenshot
   * @param options - Optional path and full-page flag
   * @returns Base64 PNG data or file path
   */
  async screenshot(options: { path?: string; full?: boolean } = {}): Promise<BrowserUseResult> {
    const args: string[] = []
    if (options.full) args.push('--full')
    if (options.path) args.push(options.path)
    const result = await this.exec('screenshot', ...args)
    if (result.success) {
      this.emit('screenshot', options.path || 'base64')
    }
    return result
  }

  /**
   * Execute JavaScript in the page context
   * @param js - JavaScript code to evaluate
   */
  async evaluate(js: string): Promise<BrowserUseResult> {
    return this.exec('eval', js)
  }

  /**
   * Extract structured data from the page using an LLM
   * @param query - Natural language description of what to extract
   */
  async extract(query: string): Promise<BrowserUseResult> {
    return this.exec('extract', query)
  }

  /**
   * Scroll the page
   * @param direction - 'up' or 'down'
   * @param amount - Pixels to scroll
   */
  async scroll(direction: 'up' | 'down' = 'down', amount?: number): Promise<BrowserUseResult> {
    const args: string[] = [direction]
    if (amount) args.push('--amount', String(amount))
    return this.exec('scroll', ...args)
  }

  /**
   * Send keyboard keys
   * @param keys - Key combination (e.g. "Enter", "Control+a")
   */
  async keys(keys: string): Promise<BrowserUseResult> {
    return this.exec('keys', keys)
  }

  /** Go back in browser history */
  async back(): Promise<BrowserUseResult> {
    return this.exec('back')
  }

  /** Get the current page title */
  async getTitle(): Promise<BrowserUseResult> {
    return this.exec('get', 'title')
  }

  /** Get the full page HTML */
  async getHtml(): Promise<BrowserUseResult> {
    return this.exec('get', 'html')
  }

  /**
   * Get text content of an element
   * @param index - Element index
   */
  async getText(index: string): Promise<BrowserUseResult> {
    return this.exec('get', 'text', index)
  }

  /**
   * Select a dropdown option
   * @param index - Element index of the dropdown
   * @param value - Value to select
   */
  async select(index: string, value: string): Promise<BrowserUseResult> {
    return this.exec('select', index, value)
  }

  /**
   * Wait for a CSS selector to appear
   * @param selector - CSS selector
   */
  async waitForSelector(selector: string): Promise<BrowserUseResult> {
    return this.exec('wait', 'selector', selector)
  }

  /**
   * Wait for text to appear on the page
   * @param text - Text to wait for
   */
  async waitForText(text: string): Promise<BrowserUseResult> {
    return this.exec('wait', 'text', text)
  }

  /**
   * Switch to a tab by index
   * @param tab - Tab index
   */
  async switchTab(tab: string): Promise<BrowserUseResult> {
    return this.exec('switch', tab)
  }

  /**
   * Close a tab
   * @param tab - Tab index (closes current if omitted)
   */
  async closeTab(tab?: string): Promise<BrowserUseResult> {
    const args = tab ? [tab] : []
    return this.exec('close-tab', ...args)
  }

  /**
   * Close the browser session
   * @param all - If true, close all sessions
   */
  async close(all?: boolean): Promise<BrowserUseResult> {
    const args = all ? ['--all'] : []
    const result = await this.exec('close', ...args)
    if (result.success) this.emit('closed')
    return result
  }

  /** List active browser sessions */
  async sessions(): Promise<BrowserUseResult> {
    return this.exec('sessions')
  }

  /**
   * Hover over an element
   * @param index - Element index
   */
  async hover(index: string): Promise<BrowserUseResult> {
    return this.exec('hover', index)
  }

  /**
   * Double-click an element
   * @param index - Element index
   */
  async dblclick(index: string): Promise<BrowserUseResult> {
    return this.exec('dblclick', index)
  }

  /**
   * Right-click an element
   * @param index - Element index
   */
  async rightclick(index: string): Promise<BrowserUseResult> {
    return this.exec('rightclick', index)
  }

  // --- Tool handlers (matched by name to static tools) ---

  async browserOpen(options: { url: string }) {
    return this.open(options.url)
  }

  async browserClick(options: { target: string }) {
    return this.click(options.target)
  }

  async browserType(options: { text: string }) {
    return this.type(options.text)
  }

  async browserInput(options: { index: string; text: string }) {
    return this.input(options.index, options.text)
  }

  async browserGetState() {
    return this.getState()
  }

  async browserScreenshot(options: { path?: string; full?: boolean }) {
    return this.screenshot(options)
  }

  async browserEval(options: { js: string }) {
    return this.evaluate(options.js)
  }

  async browserExtract(options: { query: string }) {
    return this.extract(options.query)
  }

  async browserScroll(options: { direction: 'up' | 'down'; amount?: number }) {
    return this.scroll(options.direction, options.amount)
  }

  async browserKeys(options: { keys: string }) {
    return this.keys(options.keys)
  }

  async browserBack() {
    return this.back()
  }

  async browserGetTitle() {
    return this.getTitle()
  }

  async browserGetHtml() {
    return this.getHtml()
  }

  async browserGetText(options: { index: string }) {
    return this.getText(options.index)
  }

  async browserSelect(options: { index: string; value: string }) {
    return this.select(options.index, options.value)
  }

  async browserWaitForSelector(options: { selector: string }) {
    return this.waitForSelector(options.selector)
  }

  async browserWaitForText(options: { text: string }) {
    return this.waitForText(options.text)
  }

  async browserSwitchTab(options: { tab: string }) {
    return this.switchTab(options.tab)
  }

  async browserCloseTab(options: { tab?: string }) {
    return this.closeTab(options.tab)
  }

  async browserClose(options: { all?: boolean }) {
    return this.close(options.all)
  }

  async browserSessions() {
    return this.sessions()
  }
}

export default features.register('browserUse', BrowserUse)
