import { z } from 'zod'
import matter from 'gray-matter'
import { validateDocument } from 'contentbase'
import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

export const schemas = {
  README: z.object({}).describe("This document will explain everything you need to know about who you are, who I am, and how our underlying document structure works so you can effectively read, write, summarize, and answer questions."),
  updateDocument: z.object({
    id: z.string().min(1).describe("The id of the document you want to write. No need to include the .md extension"),
    rawContent: z.string().describe("YAML Frontmatter + Markdown content for the document.  Follow the model schema.  If you do not know it or are not sure, call the README tool."),
  }).describe("The id of the document you want to write. No need to include the .md extension'),\n\t\t rawContent: z.string().describe('YAML Frontmatter + Markdown content for the document.  Follow the model schema.  If you do not know it or are not sure, call the README tool.')\n\t}).describe('Call this function when you want to update the contents of an existing document. Make sure you understand the models requirements in terms of section headings and yaml frontmatter meta fields"),
  readDocs: z.object({
    idOrIdsCsv: z.string().describe("Pass a single document id, or a CSV list of document ids to read multiple documents at once.  Omit the markdown extension."),
  }).describe("Pass a single document id, or a CSV list of document ids to read multiple documents at once.  Omit the markdown extension.'),\n\t}).describe('Call this function when you want to read documents.  Pass it a single id, or a CSV list"),
  listCodeDirectories: z.object({}).describe("The list code directories commands shows the portfolio directory structure. Your only interest in these paths is for asking questions of our coding assistant and knowing where to direct them to look. Consult memories/USER for some common references so you can translate when i am asking."),
  askCodingAssistant: z.object({
    question: z.string().min(15).describe("The question you want to ask the coding assistant.  The coding assistant has grep, ls, cat, sed, awk, cat, and can read all of the code on this system and answer specific questions based on it."),
  }).describe("The question you want to ask the coding assistant.  The coding assistant has grep, ls, cat, sed, awk, cat, and can read all of the code on this system and answer specific questions based on it.'),\n\t}).describe('Ask the coding assistant a question.  The coding assistant has grep, ls, cat, sed, awk, cat, and can read all of the code on this system and answer specific questions based on it."),
  ls: z.object({}).describe("List the available documents in the contentbase collection"),
  commitFile: z.object({
    filePath: z.string().min(1).describe("The path of the file to commit, relative to the repo root (e.g. docs/memories/SELF.md)"),
    message: z.string().min(1).describe("The commit message"),
  }).describe("The path of the file to commit, relative to the repo root (e.g. docs/memories/SELF.md)'),\n\t\tmessage: z.string().min(1).describe('The commit message'),\n\t}).describe('Stage and commit exactly one file. Use this right after updateDocument to commit the change. Only the specified file will be staged — other working tree changes are left untouched."),
}

export async function README(options: z.infer<typeof schemas.README>) {
  // regenerate the readme fresh
  await assistant.container.proc.spawnAndCapture('cnotes', ['summary'])
  // make sure the collection is fresh
  await assistant.contentDb.collection.load({ refresh: true })
  
  const docs = await assistant.contentDb.readMultiple(['memories/SELF', 'memories/USER', 'memories/TODO', 'README','assistant-README'])
  return docs
}

export async function updateDocument(options: z.infer<typeof schemas.updateDocument>) {
  success: boolean, errors?: string[]
}

export async function readDocs(options: z.infer<typeof schemas.readDocs>) {
  const { idOrIdsCsv } = options
  
  const ids = idOrIdsCsv.split(',').map(id => id.trim().replace(/.md$/i, '').replace(/^docs\//i, ''))
  
  // make sure the collection is fresh, this is expensive i know
  await assistant.contentDb.collection.load({ refresh: true })
  
  const combinedDocs = await assistant.contentDb.readMultiple(ids, {
  	meta: true,
  })
  
  return combinedDocs
}

export async function listCodeDirectories(options: z.infer<typeof schemas.listCodeDirectories>) {
  const result = await assistant.container.proc.exec('tree -d -L 3 -I node_modules')
  return result
}

export async function askCodingAssistant(options: z.infer<typeof schemas.askCodingAssistant>) {
  const { question } = options
  
  if (!codingAssistant) {
  	await container.feature('assistantsManager').discover()
  	codingAssistant = container.feature('assistantsManager').create('codingAssistant')
  }
  
  return codingAssistant.ask(question)
}

export async function ls(options: z.infer<typeof schemas.ls>) {
  await assistant.contentDb.collection.load({ refresh: true }).catch(e => {
  	console.error('error refreshing collection', e)
  })
  
  const available = assistant.contentDb.collection.available
  
  return [
  	'Available Documents: ',
  	'----',
  	...available.sort(),
  	'----',
  	'You can call readDocs({ idOrIdsCsv }) with any one of these values'
  ].join('\n')
}

export async function commitFile(options: z.infer<typeof schemas.commitFile>) {
  success: boolean, error?: string
}
