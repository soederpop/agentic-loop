import type { Assistant } from '@soederpop/luca/agi'
import matter from 'gray-matter'
import { validateDocument } from 'contentbase'

declare global {
	var assistant: Assistant
}

const WRITE_TOOLS = new Set(['writeFile', 'editFile', 'deleteFile', 'moveFile', 'createDirectory'])

export function started() {
	const { schemas, handlers } = (assistant.container as any).selectors.toTools(assistant.container)
	assistant
		.use({ schemas, handlers })
		.use(container.docs)
		.use(container.feature('memory', { namespace: 'chiefOfStaff' }))

	// File tools: read anywhere, write only to docs/
	const fileTools = container.feature('fileTools')
	assistant.use(fileTools.toTools({
		only: ['readFile', 'listDirectory', 'searchFiles', 'findFiles', 'fileInfo', 'writeFile', 'editFile', 'deleteFile', 'createDirectory', 'moveFile']
	}))
	fileTools.setupToolsConsumer(assistant as any)

	const cwd = assistant.container.cwd
	const docsRoot = `${cwd}/docs/`

	// Guard: write operations must target docs/
	assistant.intercept('beforeToolCall', async function guardFileWrites(ctx, next) {
		if (WRITE_TOOLS.has(ctx.name)) {
			const targetPath = (ctx.args.path || ctx.args.destination || '') as string
			const resolved = targetPath.startsWith('/') ? targetPath : `${cwd}/${targetPath}`

			if (!resolved.startsWith(docsRoot)) {
				ctx.skip = true
				ctx.result = JSON.stringify({
					error: `Write denied: ${ctx.name} is restricted to the docs/ directory. Target "${targetPath}" is outside the allowed scope.`
				})
				return
			}
		}
		await next()
	})

	// After write: validate contentbase docs automatically
	assistant.intercept('afterToolCall', async function validateContentbaseDocs(ctx, next) {
		if (ctx.name === 'writeFile' || ctx.name === 'editFile') {
			const targetPath = (ctx.args.path || '') as string
			const resolved = targetPath.startsWith('/') ? targetPath : `${cwd}/${targetPath}`

			// Only validate markdown files inside docs/
			if (resolved.startsWith(docsRoot) && resolved.endsWith('.md')) {
				try {
					const collection = assistant.contentDb.collection
					// Derive the doc id from the path (strip docs/ prefix and .md suffix)
					const docId = resolved.slice(docsRoot.length).replace(/\.md$/, '')
					const modelDef = collection.findModelDefinition(docId)

					if (modelDef) {
						const fs = container.feature('fs')
						const rawContent = await fs.readFileAsync(resolved).then(String)
						const { data: meta, content } = matter(rawContent)
						const doc = collection.createDocument({ id: docId, content, meta })
						const result = validateDocument(doc, modelDef)

						if (!result.valid) {
							const errors = result.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`)
							// Append validation warnings to the tool result
							const original = typeof ctx.result === 'string' ? ctx.result : JSON.stringify(ctx.result)
							ctx.result = JSON.stringify({
								fileResult: original,
								contentbaseValidation: { valid: false, errors },
								hint: 'The file was written but does not conform to the contentbase model. Please fix the errors above.'
							})
						}
					}
				} catch {
					// Validation is best-effort — don't block the write
				}
			}
		}
		await next()
	})

	assistant.addSystemPromptExtension('file-tools-scope', [
		'## File Tools',
		'You have file tools (readFile, listDirectory, searchFiles, findFiles, fileInfo, writeFile, editFile, deleteFile, createDirectory, moveFile).',
		'You can READ files anywhere, but WRITE operations (writeFile, editFile, deleteFile, moveFile, createDirectory) are restricted to the docs/ directory.',
		'When you write or edit markdown files in docs/, they are automatically validated against the contentbase model. Fix any validation errors reported.',
		'Use readFile to read documents directly instead of the old readDocs tool.',
	].join('\n'))
}

export async function formatSystemPrompt(prompt: string) {
	// in theory here we could inject context
	//
	const docs = await assistant.contentDb.readMultiple(['memories/SELF', 'memories/USER', 'memories/TODO', 'README','assistant-README'])

	return [ prompt, docs ].join('\n\n<-- BEGIN INTERNAL MEMORY DOCUMENTATION -->')
}
