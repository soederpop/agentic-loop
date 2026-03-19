const state = {
  handlers: [],
  selectedFile: null,
  selectedKind: null,
  inspectorOpen: false,
  editor: null,
  monaco: null,
  libsLoaded: false,
  runToken: 0,
}

const refs = {
  handlersList: document.getElementById('handlers-list'),
  editorPanel: document.getElementById('editor-panel'),
  editorTitle: document.getElementById('editor-title'),
  toggleEditorButton: document.getElementById('toggle-editor'),
  saveButton: document.getElementById('save-handler'),
  refreshButton: document.getElementById('refresh-handlers'),
  phraseInput: document.getElementById('phrase-input'),
  runTestButton: document.getElementById('run-test'),
  testOutput: document.getElementById('test-output'),
  routingLane: document.getElementById('routing-lane'),
  firstMatch: document.getElementById('first-match'),
  dictionarySubject: document.getElementById('dictionary-subject'),
  dictionaryCount: document.getElementById('dictionary-count'),
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status}: ${body}`)
  }

  return response.json()
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function handlerKey(handlerLike) {
  return handlerLike.file || handlerLike.name
}

function setInspectorOpen(open) {
  state.inspectorOpen = !!open
  refs.editorPanel.classList.toggle('collapsed', !state.inspectorOpen)
  refs.toggleEditorButton.textContent = state.inspectorOpen ? 'Hide Inspector' : 'Open Inspector'
}

function findRouteNodeByKey(key) {
  return Array.from(refs.routingLane.querySelectorAll('.route-node'))
    .find((node) => node.dataset.key === key) || null
}

function renderRoutingLane(matches = []) {
  const matchMap = new Map(matches.map((match) => [handlerKey(match), match]))
  refs.routingLane.innerHTML = ''

  for (const handler of state.handlers) {
    const key = handlerKey(handler)
    const match = matchMap.get(key)
    const node = document.createElement('article')
    node.className = 'route-node pending'
    node.dataset.key = key

    const status = match
      ? match.error
        ? 'Error'
        : match.matched
          ? 'YES'
          : 'NO'
      : 'Waiting'

    node.innerHTML = [
      `<div class="name">${handler.name}</div>`,
      `<div class="meta">p${handler.priority} | ${handler.keywords.join(', ') || 'no keywords'}</div>`,
      `<div class="status">${status}</div>`,
    ].join('')

    refs.routingLane.appendChild(node)
  }
}

function renderHandlers() {
  refs.handlersList.innerHTML = ''

  const dictionaryItem = document.createElement('button')
  dictionaryItem.className = `handler-item${state.selectedKind === 'dictionary' ? ' active' : ''}`
  dictionaryItem.type = 'button'
  dictionaryItem.innerHTML = `
    <div class="name">dictionary.yml</div>
    <div class="meta">Noun/value mappings used by handlers</div>
  `
  dictionaryItem.addEventListener('click', () => {
    loadDictionarySource().catch((error) => {
      refs.testOutput.textContent = String(error)
    })
  })
  refs.handlersList.appendChild(dictionaryItem)

  for (const handler of state.handlers) {
    const item = document.createElement('button')
    item.className = `handler-item${state.selectedKind === 'handler' && state.selectedFile === handler.file ? ' active' : ''}`
    item.type = 'button'
    item.innerHTML = `
      <div class="name">${handler.name}</div>
      <div class="meta">${handler.file || 'No file'} | ${handler.keywords.join(', ')}</div>
    `

    item.addEventListener('click', () => {
      if (!handler.file) return
      selectHandler(handler.file)
    })

    refs.handlersList.appendChild(item)
  }
}

async function fetchHandlers() {
  const { handlers } = await request('/api/handlers')
  state.handlers = handlers

  renderHandlers()
  renderRoutingLane()
}

async function loadMonaco() {
  if (state.monaco) return state.monaco

  await new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${window.MONACO_BASE}/vs/loader.js`
    script.onload = resolve
    script.onerror = reject
    document.body.appendChild(script)
  })

  window.require.config({ paths: { vs: `${window.MONACO_BASE}/vs` } })

  state.monaco = await new Promise((resolve) => {
    window.require(['vs/editor/editor.main'], () => resolve(window.monaco))
  })

  state.editor = state.monaco.editor.create(document.getElementById('editor'), {
    value: '// Pick dictionary.yml or a handler from the left',
    language: 'typescript',
    theme: 'vs',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    tabSize: 2,
  })

  state.editor.onDidChangeModelContent(() => {
    refs.saveButton.disabled = !state.selectedFile
  })

  return state.monaco
}

async function loadTypeLibs() {
  if (state.libsLoaded) return

  await loadMonaco()
  const monaco = state.monaco
  const { files } = await request('/api/types')

  for (const file of files) {
    if (!file.content || !file.path) continue
    const uri = monaco.Uri.parse(`inmemory://model/${file.path}`)
    monaco.languages.typescript.typescriptDefaults.addExtraLib(file.content, uri.toString())
  }

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    strict: false,
    skipLibCheck: true,
  })

  state.libsLoaded = true
}

async function loadHandlerSource(file) {
  setInspectorOpen(true)
  await loadMonaco()
  await loadTypeLibs()

  const { source } = await request(`/api/handlers/source?file=${encodeURIComponent(file)}`)
  state.selectedFile = file
  state.selectedKind = 'handler'

  const modelUri = state.monaco.Uri.parse(`file:///${file}`)
  const existing = state.monaco.editor.getModel(modelUri)
  if (existing) existing.dispose()

  const model = state.monaco.editor.createModel(source, 'typescript', modelUri)
  state.editor.setModel(model)

  refs.editorTitle.textContent = `Editor: ${file}`
  refs.saveButton.disabled = false
  renderHandlers()
}

async function loadDictionarySource() {
  setInspectorOpen(true)
  await loadMonaco()
  const { source } = await request('/api/dictionary')
  state.selectedFile = 'dictionary.yml'
  state.selectedKind = 'dictionary'

  const modelUri = state.monaco.Uri.parse('file:///dictionary.yml')
  const existing = state.monaco.editor.getModel(modelUri)
  if (existing) existing.dispose()

  const model = state.monaco.editor.createModel(source, 'plaintext', modelUri)
  state.editor.setModel(model)

  refs.editorTitle.textContent = 'Editor: dictionary.yml'
  refs.saveButton.disabled = false
  renderHandlers()
}

async function saveCurrentHandler() {
  if (!state.selectedFile || !state.editor) return

  const source = state.editor.getValue()
  refs.saveButton.disabled = true

  try {
    if (state.selectedKind === 'dictionary') {
      await request('/api/dictionary', {
        method: 'PUT',
        body: JSON.stringify({ source }),
      })
    } else {
      await request('/api/handlers/source', {
        method: 'PUT',
        body: JSON.stringify({ file: state.selectedFile, source }),
      })
    }

    await fetchHandlers()
  } catch (error) {
    refs.saveButton.disabled = false
    throw error
  }
}

function applySummary(routing) {
  const subject = routing?.dictionary?.subjectMatch
  const textHits = routing?.dictionary?.textMatches || []

  refs.firstMatch.textContent = routing?.firstMatched || 'None'
  refs.dictionarySubject.textContent = subject ? `${subject.section}.${subject.key}` : 'None'
  refs.dictionaryCount.textContent = String(textHits.length)
}

async function animateRouting(matches = []) {
  const token = ++state.runToken

  for (let index = 0; index < matches.length; index += 1) {
    if (token !== state.runToken) return

    const match = matches[index]
    const key = handlerKey(match)
    const node = findRouteNodeByKey(key)
    if (!node) continue

    node.classList.remove('pending', 'matched', 'missed')
    node.classList.add('active')

    const statusNode = node.querySelector('.status')
    if (statusNode) {
      statusNode.textContent = 'Checking...'
    }

    await sleep(120)

    if (token !== state.runToken) return

    node.classList.remove('active')
    node.classList.add(match.matched ? 'matched' : 'missed')

    if (statusNode) {
      statusNode.textContent = match.error ? `ERROR: ${match.error}` : match.matched ? 'YES' : 'NO'
    }

    await sleep(110)
  }
}

async function runTest() {
  const phrase = refs.phraseInput.value.trim()
  if (!phrase) return

  refs.runTestButton.disabled = true
  refs.testOutput.textContent = 'Running simulation...'
  renderRoutingLane()
  refs.firstMatch.textContent = 'Checking...'
  refs.dictionarySubject.textContent = 'Checking...'
  refs.dictionaryCount.textContent = '...'

  try {
    const result = await request('/api/test', {
      method: 'POST',
      body: JSON.stringify({ phrase }),
    })

    const matches = result?.routing?.matches || []
    renderRoutingLane(matches)
    applySummary(result.routing)
    await animateRouting(matches)

    refs.testOutput.textContent = JSON.stringify({
      phrase: result.phrase,
      parse: result.parse,
      analyze: result.analyze,
      understand: result.understand,
      routing: result.routing,
    }, null, 2)
  } catch (error) {
    refs.testOutput.textContent = String(error)
  } finally {
    refs.runTestButton.disabled = false
  }
}

async function selectHandler(file) {
  try {
    state.selectedKind = 'handler'
    await loadHandlerSource(file)
  } catch (error) {
    refs.testOutput.textContent = String(error)
  }
}

refs.refreshButton.addEventListener('click', async () => {
  try {
    await fetchHandlers()
  } catch (error) {
    refs.testOutput.textContent = String(error)
  }
})

refs.saveButton.addEventListener('click', async () => {
  try {
    await saveCurrentHandler()
  } catch (error) {
    refs.testOutput.textContent = String(error)
  }
})

refs.toggleEditorButton.addEventListener('click', () => {
  const next = !state.inspectorOpen
  setInspectorOpen(next)
  if (next && state.selectedKind === 'handler' && state.selectedFile) {
    loadHandlerSource(state.selectedFile).catch((error) => {
      refs.testOutput.textContent = String(error)
    })
  } else if (next && state.selectedKind === 'dictionary') {
    loadDictionarySource().catch((error) => {
      refs.testOutput.textContent = String(error)
    })
  }
})

refs.runTestButton.addEventListener('click', runTest)
refs.phraseInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    runTest().catch((error) => {
      refs.testOutput.textContent = String(error)
    })
  }
})

async function boot() {
  await fetchHandlers()
  setInspectorOpen(false)
  refs.saveButton.disabled = true

  refs.testOutput.textContent = [
    'Voice trainer ready.',
    '',
    '- Type a phrase and run simulation to visualize deterministic routing.',
    '- Edit dictionary or handlers in the lower panel when needed.',
  ].join('\n')
}

boot().catch((error) => {
  refs.testOutput.textContent = String(error)
})
