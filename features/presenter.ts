import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    presenter: typeof Presenter
  }
}

export const PRESENTER_EXPRESS_PORT = 9210
export const PRESENTER_LINK_PORT = 9211

export const PresenterStateSchema = FeatureStateSchema.extend({
  running: z.boolean().default(false),
  expressPort: z.number().default(PRESENTER_EXPRESS_PORT),
  linkPort: z.number().default(PRESENTER_LINK_PORT),
})
export type PresenterState = z.infer<typeof PresenterStateSchema>

export const PresenterOptionsSchema = FeatureOptionsSchema.extend({
  expressPort: z.number().default(PRESENTER_EXPRESS_PORT),
  linkPort: z.number().default(PRESENTER_LINK_PORT),
  lucaScriptUrl: z.string().default('http://localhost:4101/dist/luca.browser.js'),
})
export type PresenterOptions = z.infer<typeof PresenterOptionsSchema>

/**
 * Long-running presenter server kept alive by luca main.
 * Serves the presenter HTML shell and a containerLink WebSocket so that
 * `luca present` can skip the server boot and open windows instantly.
 */
export class Presenter extends Feature<PresenterState, PresenterOptions> {
  static override shortcut = 'features.presenter' as const
  static override stateSchema = PresenterStateSchema
  static override optionsSchema = PresenterOptionsSchema
  static override description =
    'Persistent presenter HTTP + WebSocket server for instant present command responsiveness'

  static {
    Feature.register(this, 'presenter')
  }

  private _expressServer: any = null
  private _link: any = null

  get expressPort() { return this.state.get('expressPort') }
  get linkPort() { return this.state.get('linkPort') }
  get link() { return this._link }
  get expressServer() { return this._expressServer }

  async start() {
    if (this.state.get('running')) return this

    const { container } = this
    const networking = container.feature('networking')
    const opts = this.options

    // Resolve ports — use configured defaults, but verify they're free
    let expressPort = opts.expressPort
    let linkPort = opts.linkPort

    const expressOpen = await networking.isPortOpen(expressPort)
    if (!expressOpen) {
      expressPort = await networking.findOpenPort(expressPort + 10)
    }

    const linkOpen = await networking.isPortOpen(linkPort)
    if (!linkOpen) {
      linkPort = await networking.findOpenPort(linkPort + 10)
    }

    // Start containerLink WebSocket server
    this._link = container.feature('containerLink', { port: linkPort })
    await this._link.start()

    // Start express server with presenter shell
    this._expressServer = container.server('express', { port: expressPort, cors: true })
    const app = this._expressServer.app
    const html = buildPresenterHTML()
    const lucaScriptUrl = opts.lucaScriptUrl
    const lucaProxyPath = '/__present_luca_browser.js'

    app.get('/', (_req: any, res: any) => {
      res.type('html').send(html)
    })

    app.get(lucaProxyPath, async (_req: any, res: any) => {
      try {
        const response = await fetch(lucaScriptUrl)
        if (!response.ok) {
          res.status(502).type('text/plain').send(`Failed to fetch luca browser bundle (${response.status})`)
          return
        }
        const js = await response.text()
        res.type('application/javascript').send(js)
      } catch (err: any) {
        res.status(502).type('text/plain').send(`Failed to proxy luca browser bundle: ${err?.message || String(err)}`)
      }
    })

    await this._expressServer.start({ port: expressPort })

    this.state.set('expressPort', expressPort)
    this.state.set('linkPort', linkPort)
    this.state.set('running', true)

    return this
  }

  /** Build the full page URL for a given presentation */
  buildPageUrl(opts: { url: string; title?: string; mode?: string }) {
    const expressPort = this.state.get('expressPort')
    const linkPort = this.state.get('linkPort')
    const wsUrl = `ws://localhost:${linkPort}`
    const localLucaScriptUrl = `http://localhost:${expressPort}/__present_luca_browser.js`
    return `http://localhost:${expressPort}?url=${encodeURIComponent(opts.url)}&title=${encodeURIComponent(opts.title || 'Presenter')}&wsUrl=${encodeURIComponent(wsUrl)}&mode=${opts.mode || 'input'}&lucaScriptUrl=${encodeURIComponent(localLucaScriptUrl)}`
  }

  async stop() {
    if (!this.state.get('running')) return
    try { await this._link?.stop() } catch {}
    try { await this._expressServer?.stop() } catch {}
    this.state.set('running', false)
  }
}

export default Presenter

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

  var iframe = document.getElementById('viewer');
  if (iframe) {
    iframe.addEventListener('load', function() {
      try {
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc || !doc.body || doc.body.innerHTML === '') {
          showIframeError();
        }
      } catch(e) {}
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
      function finishLoad() {
        if (window.luca) { resolve(window.luca); } else { reject(new Error('luca bundle loaded but window.luca is missing')); }
      }
      var moduleTag = document.createElement('script');
      moduleTag.type = 'module';
      moduleTag.src = src;
      moduleTag.onload = finishLoad;
      moduleTag.onerror = function() {
        var classicTag = document.createElement('script');
        classicTag.src = src;
        classicTag.async = true;
        classicTag.onload = finishLoad;
        classicTag.onerror = function() { reject(new Error('failed to load luca browser bundle')); };
        document.head.appendChild(classicTag);
      };
      document.head.appendChild(moduleTag);
    });
  }

  async function connectLink() {
    if (!wsUrl) { setStatus('no ws url', 'error'); return; }
    if (!lucaScriptUrl) { setStatus('no luca script url', 'error'); return; }
    setStatus('loading luca...', '');
    try { await loadScript(lucaScriptUrl); } catch (err) {
      setStatus('bundle load error', 'error'); console.error(err); return;
    }

    if (!window.luca || typeof window.luca.feature !== 'function') {
      setStatus('window.luca missing', 'error'); return;
    }

    try {
      setStatus('registering...', '');
      link = window.luca.feature('containerLink', {
        enable: true, hostUrl: wsUrl, reconnect: false,
        capabilities: ['presenter'],
        meta: { mode: mode, title: title, targetUrl: url }
      });
      link.on('connected', function() { setStatus('connected', 'connected'); });
      link.on('disconnected', function() { setStatus('disconnected', 'error'); });
      await link.connect();
      sendEvent('opened', { mode: mode, title: title, targetUrl: url });
    } catch (err) {
      setStatus('link connection error', 'error'); console.error(err);
    }
  }

  function sendEvent(eventName, data) {
    if (!link || !link.isConnected) return;
    try { link.emitToHost(eventName, data); } catch {}
  }

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
      try { if (link && link.isConnected) link.disconnect('closed'); } catch {}
      window.close();
    });
  }

  if (commentEl) {
    commentEl.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && submitBtn) { submitBtn.click(); }
    });
  }

  window.addEventListener('beforeunload', function() {
    sendEvent('closed', { reason: 'beforeunload' });
    try { if (link && link.isConnected) link.disconnect('closed'); } catch {}
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
    setStatus('startup error', 'error'); console.error(err);
  });
})();
</script>
</body>
</html>`
}
