import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({
  url: z.string().default('').describe('URL to present in the viewer window'),
  title: z.string().default('Presenter').describe('Window title'),
  mode: z.enum(['display', 'input']).default('input').describe('display = view only, input = collect feedback'),
  expressPort: z.number().int().positive().max(65535).optional().describe('Optional fixed port for the presenter HTTP server'),
  linkPort: z.number().int().positive().max(65535).optional().describe('Optional fixed port for containerLink WebSocket'),
  startupTimeoutMs: z.number().int().positive().default(8000).describe('Startup timeout for server boot (ms)'),
  lucaScriptUrl: z.string().default('https://esm.sh/@soederpop/luca@0.0.11/src/browser.ts').describe('Browser script URL that exposes window.luca'),
})

function buildPresenterHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Presenter</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; background: #1a1a2e; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }

  .container { display: flex; flex-direction: column; height: 100vh; }

  .title-bar {
    background: #16213e; padding: 8px 16px; font-size: 13px; color: #8892b0;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid #2a2a4a; flex-shrink: 0;
  }
  .title-bar .title { font-weight: 600; color: #ccd6f6; }
  .title-bar .url { opacity: 0.6; font-size: 12px; margin-left: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }

  .iframe-wrap { flex: 1; position: relative; min-height: 0; }
  .iframe-wrap iframe { width: 100%; height: 100%; border: none; background: #fff; }
  .iframe-error {
    position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    background: #1a1a2e; color: #8892b0; font-size: 14px; text-align: center; padding: 32px;
  }
  .iframe-error.visible { display: flex; }

  /* Input mode: feedback panel */
  .feedback-panel {
    flex-shrink: 0; background: #16213e; border-top: 1px solid #2a2a4a;
    padding: 12px 16px; display: flex; gap: 12px; align-items: flex-end;
  }
  .feedback-panel textarea {
    flex: 1; resize: none; height: 64px; background: #0f0f23; border: 1px solid #2a2a4a;
    border-radius: 6px; color: #e0e0e0; padding: 10px 12px; font-size: 14px;
    font-family: inherit; outline: none; transition: border-color 0.2s;
  }
  .feedback-panel textarea:focus { border-color: #64ffda; }
  .feedback-panel textarea::placeholder { color: #4a4a6a; }

  .btn {
    padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px;
    font-weight: 600; cursor: pointer; transition: all 0.2s;
  }
  .btn-submit { background: #64ffda; color: #0a0a1a; }
  .btn-submit:hover { background: #52e0c4; }
  .btn-close { background: #2a2a4a; color: #8892b0; }
  .btn-close:hover { background: #3a3a5a; color: #ccd6f6; }

  /* Display mode: floating close */
  .float-close {
    position: fixed; top: 12px; right: 12px; z-index: 100;
    background: rgba(22, 33, 62, 0.9); border: 1px solid #2a2a4a;
    padding: 8px 16px; border-radius: 6px; color: #8892b0;
    font-size: 13px; cursor: pointer; backdrop-filter: blur(8px);
    transition: all 0.2s;
  }
  .float-close:hover { background: rgba(42, 42, 74, 0.95); color: #ccd6f6; }

  .thanks {
    display: none; align-items: center; justify-content: center;
    background: #16213e; border-top: 1px solid #2a2a4a; padding: 20px;
    color: #64ffda; font-size: 15px; font-weight: 600;
  }
  .thanks.visible { display: flex; }

  .status {
    position: fixed; bottom: 8px; right: 8px; font-size: 11px; color: #4a4a6a; z-index: 200;
  }
  .status.connected { color: #64ffda; }
  .status.error { color: #ff6b6b; }
</style>
</head>
<body>
<div class="container" id="app"></div>
<div class="status" id="status">loading...</div>

<script>
(function() {
  var params = new URLSearchParams(window.location.search);
  var url = params.get('url') || '';
  var wsUrl = params.get('wsUrl') || '';
  var mode = params.get('mode') || 'input';
  var title = params.get('title') || 'Presenter';
  var lucaScriptUrl = params.get('lucaScriptUrl') || '';

  var app = document.getElementById('app');
  var statusEl = document.getElementById('status');
  var link = null;

  // Build layout
  var titleBar = '<div class="title-bar"><span class="title">' + escapeHtml(title) + '</span><span class="url">' + escapeHtml(url) + '</span></div>';
  var iframeWrap = '<div class="iframe-wrap"><iframe id="viewer" src="' + escapeAttr(url) + '" sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe><div class="iframe-error" id="iframe-error">This page cannot be displayed in an iframe.<br>The site may block embedding via X-Frame-Options or CSP.</div></div>';

  if (mode === 'input') {
    app.innerHTML = titleBar + iframeWrap +
      '<div class="feedback-panel" id="feedback-panel">' +
        '<textarea id="comment" placeholder="Your feedback..."></textarea>' +
        '<button class="btn btn-submit" id="submit-btn">Submit</button>' +
        '<button class="btn btn-close" id="close-btn">Close</button>' +
      '</div>' +
      '<div class="thanks" id="thanks">Thanks for your feedback!</div>';
  } else {
    app.innerHTML = iframeWrap +
      '<button class="float-close" id="close-btn">Close</button>';
  }

  document.title = title;

  // Iframe error detection
  var iframe = document.getElementById('viewer');
  if (iframe) {
    iframe.addEventListener('load', function() {
      try {
        // Try to access contentDocument — will throw if blocked by CORS/CSP
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc || !doc.body || doc.body.innerHTML === '') {
          showIframeError();
        }
      } catch(e) {
        // Cross-origin — that's fine, it loaded
      }
    });
    iframe.addEventListener('error', showIframeError);
  }

  function showIframeError() {
    var el = document.getElementById('iframe-error');
    if (el) el.classList.add('visible');
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      if (window.luca) { resolve(window.luca); return; }
      function waitForLuca(timeout) {
        var start = Date.now();
        function check() {
          if (window.luca) { resolve(window.luca); }
          else if (Date.now() - start > timeout) { reject(new Error('luca bundle loaded but window.luca is missing')); }
          else { setTimeout(check, 50); }
        }
        check();
      }
      var moduleTag = document.createElement('script');
      moduleTag.type = 'module';
      moduleTag.src = src;
      moduleTag.onload = function() { waitForLuca(3000); };
      moduleTag.onerror = function() {
        var classicTag = document.createElement('script');
        classicTag.src = src;
        classicTag.async = true;
        classicTag.onload = function() { waitForLuca(3000); };
        classicTag.onerror = function() { reject(new Error('failed to load luca browser bundle')); };
        document.head.appendChild(classicTag);
      };
      document.head.appendChild(moduleTag);
    });
  }

  async function connectLink() {
    if (!wsUrl) {
      setStatus('no ws url', 'error');
      return;
    }
    if (!lucaScriptUrl) {
      setStatus('no luca script url', 'error');
      return;
    }
    setStatus('loading luca...', '');
    try {
      await loadScript(lucaScriptUrl);
    } catch (err) {
      setStatus('bundle load error', 'error');
      console.error(err);
      return;
    }

    if (!window.luca || typeof window.luca.feature !== 'function') {
      setStatus('window.luca missing', 'error');
      return;
    }

    try {
      setStatus('registering...', '');
      link = window.luca.feature('containerLink', {
        enable: true,
        hostUrl: wsUrl,
        reconnect: false,
        capabilities: ['presenter'],
        meta: { mode: mode, title: title, targetUrl: url }
      });

      link.on('connected', function() {
        setStatus('connected', 'connected');
      });
      link.on('disconnected', function() {
        setStatus('disconnected', 'error');
      });

      await link.connect();
      sendEvent('opened', { mode: mode, title: title, targetUrl: url });
    } catch (err) {
      setStatus('link connection error', 'error');
      console.error(err);
    }
  }

  function sendEvent(eventName, data) {
    if (!link || !link.isConnected) return;
    try {
      link.emitToHost(eventName, data);
    } catch {}
  }

  // --- UI handlers ---
  var submitBtn = document.getElementById('submit-btn');
  var closeBtn = document.getElementById('close-btn');
  var commentEl = document.getElementById('comment');
  var feedbackPanel = document.getElementById('feedback-panel');
  var thanksEl = document.getElementById('thanks');

  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      var comment = commentEl ? commentEl.value : '';
      sendEvent('submitted', { comment: comment });
      if (feedbackPanel) feedbackPanel.style.display = 'none';
      if (thanksEl) thanksEl.classList.add('visible');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      sendEvent('closed', { reason: 'button' });
      try {
        if (link && link.isConnected) link.disconnect('closed');
      } catch {}
      window.close();
    });
  }

  // Handle Cmd+Enter to submit
  if (commentEl) {
    commentEl.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && submitBtn) {
        submitBtn.click();
      }
    });
  }

  window.addEventListener('beforeunload', function() {
    sendEvent('closed', { reason: 'beforeunload' });
    try {
      if (link && link.isConnected) link.disconnect('closed');
    } catch {}
  });

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  connectLink().catch(function(err) {
    setStatus('startup error', 'error');
    console.error(err);
  });
})();
</script>
</body>
</html>`
}

interface PresentResult {
  action: 'submitted' | 'closed' | 'opened-in-browser'
  comment?: string
}

function isValidPort(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 65535
}

function normalizePort(value: unknown): number | undefined {
  const port = Number(value)
  return isValidPort(port) ? port : undefined
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

async function present(options: z.infer<typeof argsSchema>, context: ContainerContext): Promise<PresentResult> {
  const { container } = context
  const { title, mode, startupTimeoutMs, lucaScriptUrl } = options
  const url = options.url || container.argv._[1] as string

  if (!url) {
    console.error('Usage: luca present --url <url> [--title <title>] [--mode display|input]')
    throw new Error('url is required')
  }

  const networking = container.feature('networking')

  // Check if the presenter service from luca main is already running on the known port
  const { PRESENTER_EXPRESS_PORT } = await import('../features/presenter')
  const presenterAlive = !(await networking.isPortOpen(PRESENTER_EXPRESS_PORT))

  if (presenterAlive) {
    return await presentViaAuthority(container, { url, title, mode })
  }

  // No presenter service — start our own servers (standalone mode)
  const expressPort = normalizePort(options.expressPort) ?? normalizePort(await networking.findOpenPort(9200))!
  if (!expressPort) {
    throw new Error('Could not resolve a valid presenter HTTP port. Try passing --expressPort <port>.')
  }

  const linkPortStart = normalizePort(options.linkPort) ?? (expressPort + 1)
  const linkPort = normalizePort(options.linkPort) ?? normalizePort(await networking.findOpenPort(linkPortStart))!
  if (!linkPort) {
    throw new Error('Could not resolve a valid containerLink port. Try passing --linkPort <port>.')
  }
  if (linkPort === expressPort) {
    throw new Error(`containerLink port ${linkPort} conflicts with presenter HTTP port`)
  }

  const link = container.feature('containerLink', { port: linkPort })
  const expressServer = container.server('express', { port: expressPort, cors: true })
  let startupLinkError: any = null
  link.on('error', (err: any) => {
    startupLinkError = err
  })

  try {
    await withTimeout(link.start(), startupTimeoutMs, `containerLink startup on port ${linkPort}`)
    if (!link.isListening) {
      throw new Error(`containerLink did not report listening=true on port ${linkPort}`)
    }
  } catch (err: any) {
    const linkErr = startupLinkError?.message ? ` Last containerLink error: ${startupLinkError.message}` : ''
    throw new Error(`${err?.message || String(err)}${linkErr}`)
  }

  const app = expressServer.app
  const html = buildPresenterHTML()
  const lucaProxyPath = '/__present_luca_browser.js'

  app.get('/', (_req: any, res: any) => {
    res.type('html').send(html)
  })

  app.get(lucaProxyPath, async (_req: any, res: any) => {
    // Serve an ESM shim that imports the luca browser module and exposes window.luca
    const loader = `import container from ${JSON.stringify(lucaScriptUrl)};\nwindow.luca = container;\n`
    res.type('application/javascript').send(loader)
  })

  try {
    await withTimeout(expressServer.start({ port: expressPort }), startupTimeoutMs, `express startup on port ${expressPort}`)
  } catch (err: any) {
    try { await link.stop() } catch {}
    throw err
  }

  const wsUrl = `ws://localhost:${linkPort}`
  const localLucaScriptUrl = `http://localhost:${expressPort}${lucaProxyPath}`
  const pageUrl = `http://localhost:${expressPort}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&wsUrl=${encodeURIComponent(wsUrl)}&mode=${mode}&lucaScriptUrl=${encodeURIComponent(localLucaScriptUrl)}`

  console.log(`Presenter serving at ${pageUrl}`)
  console.log(`ContainerLink WebSocket at ${wsUrl}`)
  console.log('Waiting for presenter connection and feedback...')

  // Cleanup helper
  let cleaned = false
  const cleanup = async () => {
    if (cleaned) return
    cleaned = true
    try { await link.stop() } catch {}
    try { await expressServer.stop() } catch {}
  }

  // Try native window, fall back to browser
  let useNativeWindow = false
  let nativeWindowId: string | undefined

  // Check if the window manager is available and connected before attempting spawn
  let wmAvailable = false
  try {
    const wm = container.feature('windowManager')
    wmAvailable = !!wm.isClientConnected
  } catch {}

  if (wmAvailable) {
    try {
      const wm = container.feature('windowManager')
      const result = await wm.spawn({ url: pageUrl, width: 1200, height: 900 })
      if (result?.windowId) {
        useNativeWindow = true
        nativeWindowId = String(result.windowId)
      }
    } catch {
      console.log('Window manager connected but spawn failed — falling back to browser')
    }
  } else {
    console.log('Window manager not connected — opening in browser')
  }

  if (!useNativeWindow) {
    try {
      const opener = container.feature('opener')
      await opener.open(pageUrl)
    } catch {
      console.log('Could not open browser automatically. Open manually:', pageUrl)
    }
  }

  // Wait for feedback or close
  return new Promise<PresentResult>((resolve) => {
    let resolved = false
    const marker = (line: string) => console.log(line)

    const done = (result: PresentResult) => {
      if (resolved) return
      resolved = true
      cleanup().then(() => resolve(result)).catch(() => resolve(result))
    }

    // Listen for containerLink events from the browser page
    link.on('connection', (uuid: string, meta: any) => {
      console.log(`Presenter connected: ${uuid}`)
      marker(`__PRESENTER_EVENT__=connected`)
      marker(`__PRESENTER_UUID__=${uuid}`)
      if (meta?.meta?.targetUrl) {
        console.log(`Target URL: ${meta.meta.targetUrl}`)
      }
    })

    link.on('event', (_uuid: string, eventName: string, data: any) => {
      if (eventName === 'opened') {
        console.log(`Presenter opened (${data?.mode || mode})`)
        marker(`__PRESENTER_EVENT__=opened`)
        return
      }

      if (eventName === 'submitted') {
        const comment = data?.comment || ''
        console.log('Presenter submitted feedback:')
        console.log(comment || '(empty)')
        marker(`__PRESENTER_EVENT__=submitted`)
        marker(`__BEGIN_FEEDBACK_TEXT__`)
        if (comment) {
          console.log(comment)
        }
        marker(`__END_FEEDBACK_TEXT__`)
        done({ action: 'submitted', comment })
      } else if (eventName === 'closed') {
        console.log('Presenter closed')
        marker(`__PRESENTER_EVENT__=closed`)
        done({ action: 'closed' })
      }
    })

    // Detect native window close
    if (useNativeWindow) {
      try {
        const wm = container.feature('windowManager')
        wm.on('windowClosed', (msg: any) => {
          if (!nativeWindowId || String(msg?.windowId || '') === nativeWindowId) {
            marker(`__PRESENTER_EVENT__=windowClosed`)
            done({ action: 'closed' })
          }
        })
        wm.on('clientDisconnected', () => {
          marker(`__PRESENTER_EVENT__=clientDisconnected`)
          done({ action: 'closed' })
        })
      } catch {}
    }

    // Detect browser tab close via WS disconnection
    link.on('disconnection', () => {
      if (link.connectionCount === 0) {
        console.log('Presenter disconnected')
        marker(`__PRESENTER_EVENT__=disconnected`)
        done({ action: 'closed' })
      }
    })

    // Safety timeout: 5 minutes max wait
    setTimeout(() => {
      done({ action: 'closed' })
    }, 5 * 60 * 1000)
  })
}

/**
 * Fast path: the presenter service is already running in luca main.
 * Connect to the authority WS, ask it to watch for browser events, open the window,
 * and wait for feedback — no server boot needed.
 */
async function presentViaAuthority(
  container: any,
  opts: { url: string; title: string; mode: string },
): Promise<PresentResult> {
  const { readCurrentInstance } = await import('../features/instance-registry')
  const instance = readCurrentInstance()
  const presenterExpressPort = instance?.ports.presenterExpress ?? (await import('../features/presenter')).PRESENTER_EXPRESS_PORT
  const presenterLinkPort = instance?.ports.presenterLink ?? (await import('../features/presenter')).PRESENTER_LINK_PORT
  const authorityPort = instance?.ports.authority ?? 4410

  const wsUrl = `ws://localhost:${presenterLinkPort}`
  const localLucaScriptUrl = `http://localhost:${presenterExpressPort}/__present_luca_browser.js`
  const pageUrl = `http://localhost:${presenterExpressPort}?url=${encodeURIComponent(opts.url)}&title=${encodeURIComponent(opts.title)}&wsUrl=${encodeURIComponent(wsUrl)}&mode=${opts.mode}&lucaScriptUrl=${encodeURIComponent(localLucaScriptUrl)}`

  console.log(`Presenter service detected — skipping server boot`)
  console.log(`Presenter serving at ${pageUrl}`)

  // Connect to luca main's authority WS and register for presenter events
  const ws = container.client('websocket', {
    baseURL: `ws://localhost:${authorityPort}`,
    json: true,
  })

  return new Promise<PresentResult>((resolve) => {
    let resolved = false
    const marker = (line: string) => console.log(line)

    const done = (result: PresentResult) => {
      if (resolved) return
      resolved = true
      try { ws.disconnect() } catch {}
      resolve(result)
    }

    ws.on('open', () => {
      // Ask luca main to open the window and forward presenter events to us
      ws.send({ type: 'command', payload: { action: 'present', pageUrl, sessionId: Date.now().toString() } })
    })

    ws.on('message', async (msg: any) => {
      // Initial response — authority has opened the window (native or browser)
      if (msg.type === 'response' && msg.data?.ok) {
        const windowId = msg.data.windowId
        if (windowId) {
          console.log(`Native window spawned: ${windowId}`)
        }
        return
      }

      // Forwarded presenter events from luca main
      if (msg.type === 'presenter:event') {
        const { event, data } = msg

        if (event === 'connection') {
          console.log(`Presenter connected: ${data?.uuid}`)
          marker(`__PRESENTER_EVENT__=connected`)
          if (data?.uuid) marker(`__PRESENTER_UUID__=${data.uuid}`)
        } else if (event === 'opened') {
          console.log(`Presenter opened (${data?.mode || opts.mode})`)
          marker(`__PRESENTER_EVENT__=opened`)
        } else if (event === 'submitted') {
          const comment = data?.comment || ''
          console.log('Presenter submitted feedback:')
          console.log(comment || '(empty)')
          marker(`__PRESENTER_EVENT__=submitted`)
          marker(`__BEGIN_FEEDBACK_TEXT__`)
          if (comment) console.log(comment)
          marker(`__END_FEEDBACK_TEXT__`)
          done({ action: 'submitted', comment })
        } else if (event === 'closed') {
          console.log('Presenter closed')
          marker(`__PRESENTER_EVENT__=closed`)
          done({ action: 'closed' })
        } else if (event === 'disconnection') {
          if (data?.connectionCount === 0) {
            console.log('Presenter disconnected')
            marker(`__PRESENTER_EVENT__=disconnected`)
            done({ action: 'closed' })
          }
        } else if (event === 'windowClosed') {
          marker(`__PRESENTER_EVENT__=windowClosed`)
          done({ action: 'closed' })
        } else if (event === 'clientDisconnected') {
          marker(`__PRESENTER_EVENT__=clientDisconnected`)
          done({ action: 'closed' })
        }
      }
    })

    ws.on('error', (err: any) => {
      console.error(`Authority WS error: ${err?.message || err}`)
      done({ action: 'closed' })
    })

    ws.connect()

    // Safety timeout: 5 minutes
    setTimeout(() => done({ action: 'closed' }), 5 * 60 * 1000)
  })
}

export default {
  description: 'Present a URL in a native viewer window with optional feedback collection',
  argsSchema,
  handler: present,
}
