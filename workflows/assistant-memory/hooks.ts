import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, container }: WorkflowHooksSetupContext) {
  const assistantsManager = container.feature('assistantsManager') as any

  function getMemory(assistantId: string) {
    return container.feature('memory', { namespace: assistantId } as any) as any
  }

  async function ensureAssistantExists(id: string) {
    await assistantsManager.discover()
    const entry = assistantsManager.get?.(id)
    if (!entry) throw new Error(`Assistant "${id}" not found`)
    return entry
  }

  app.get('/api/workflows/assistant-memory/assistants', async (_req: any, res: any) => {
    try {
      await assistantsManager.discover()
      const assistants = (assistantsManager.list?.() || []).map((e: any) => {
        const id = (e.name || '').replace(/^assistants\//, '')
        return { id, name: id, hasVoice: !!e.hasVoice }
      })
      res.json({ assistants })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/workflows/assistant-memory/assistants/:id/summary', async (req: any, res: any) => {
    try {
      const { id } = req.params
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const categories = await memory.categories()
      const categoryCounts = await Promise.all(categories.map(async (category: string) => ({
        category,
        count: await memory.count(category),
      })))
      const events = await memory.getEvents({ limit: 20 })
      res.json({
        assistantId: id,
        namespace: `assistant:${id}`,
        epoch: memory.getEpoch(),
        total: await memory.count(),
        categories: categoryCounts,
        recentEvents: events,
        exported: await memory.exportToJson(),
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/workflows/assistant-memory/assistants/:id/category/:category', async (req: any, res: any) => {
    try {
      const { id, category } = req.params
      const { limit, sortOrder, filterMetadata } = req.query || {}
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const memories = await memory.getAll(category, {
        limit: limit ? Number(limit) : 200,
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
        filterMetadata: filterMetadata ? JSON.parse(filterMetadata) : undefined,
      })
      res.json({ assistantId: id, category, memories })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/workflows/assistant-memory/assistants/:id/search', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const { category, query, nResults, maxDistance, filterMetadata } = req.query || {}
      if (!category || !query) return res.status(400).json({ error: 'category and query are required' })
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const results = await memory.search(String(category), String(query), nResults ? Number(nResults) : 10, {
        maxDistance: maxDistance ? Number(maxDistance) : undefined,
        filterMetadata: filterMetadata ? JSON.parse(filterMetadata) : undefined,
      })
      res.json({ assistantId: id, category, query, results })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/workflows/assistant-memory/assistants/:id/memories', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const { category, text, metadata, unique, similarityThreshold } = req.body || {}
      if (!category || !text) return res.status(400).json({ error: 'category and text are required' })
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const record = unique
        ? await memory.createUnique(category, text, metadata || {}, similarityThreshold)
        : await memory.create(category, text, metadata || {})
      res.json({ assistantId: id, record })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/workflows/assistant-memory/assistants/:id/category/:category/:memoryId', async (req: any, res: any) => {
    try {
      const { id, category, memoryId } = req.params
      const { text, metadata } = req.body || {}
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const record = await memory.update(category, Number(memoryId), { text, metadata })
      res.json({ assistantId: id, category, record })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/workflows/assistant-memory/assistants/:id/category/:category/:memoryId', async (req: any, res: any) => {
    try {
      const { id, category, memoryId } = req.params
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const ok = await memory.delete(category, Number(memoryId))
      res.json({ assistantId: id, category, memoryId: Number(memoryId), ok })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/workflows/assistant-memory/assistants/:id/category/:category', async (req: any, res: any) => {
    try {
      const { id, category } = req.params
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const deleted = await memory.wipeCategory(category)
      res.json({ assistantId: id, category, deleted })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/workflows/assistant-memory/assistants/:id/events', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const { text, metadata } = req.body || {}
      if (!text) return res.status(400).json({ error: 'text is required' })
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const record = await memory.createEvent(text, metadata || {})
      res.json({ assistantId: id, record })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/workflows/assistant-memory/assistants/:id/epoch', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const { value, increment } = req.body || {}
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      let epoch = memory.getEpoch()
      if (increment) epoch = await memory.incrementEpoch()
      else if (typeof value === 'number') {
        memory.setEpoch(value)
        epoch = memory.getEpoch()
      }
      res.json({ assistantId: id, epoch })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/workflows/assistant-memory/assistants/:id/export', async (req: any, res: any) => {
    try {
      const { id } = req.params
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      res.json({ assistantId: id, export: await memory.exportToJson() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/workflows/assistant-memory/assistants/:id/import', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const { data, replace } = req.body || {}
      if (!data) return res.status(400).json({ error: 'data is required' })
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const imported = await memory.importFromJson(data, replace)
      res.json({ assistantId: id, imported })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/workflows/assistant-memory/assistants/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params
      await ensureAssistantExists(id)
      const memory = getMemory(id)
      await memory.initDb()
      const deleted = await memory.wipeAll()
      res.json({ assistantId: id, deleted })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })
}
