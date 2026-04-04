import { z } from 'zod'
import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

export const schemas = {
  rg: z.object({
    args: z.string().describe("Arguments to pass to ripgrep, e.g. \"TODO\" --type ts -n"),
  }).describe("Arguments to pass to ripgrep, e.g. \"TODO\" --type ts -n'),\n\t}).describe('Search file contents using ripgrep (rg). Fast, recursive, respects .gitignore."),
  ls: z.object({
    args: z.string().describe("Arguments to pass to ls, e.g. -la src/"),
  }).describe("Arguments to pass to ls, e.g. -la src/'),\n\t}).describe('List files and directories."),
  cat: z.object({
    args: z.string().describe("Arguments to pass to cat, e.g. src/index.ts"),
  }).describe("Arguments to pass to cat, e.g. src/index.ts'),\n\t}).describe('Read file contents."),
  sed: z.object({
    args: z.string().describe("Arguments to pass to sed, e.g. -n \"10,20p\" src/index.ts"),
  }).describe("Arguments to pass to sed, e.g. -n \"10,20p\" src/index.ts'),\n\t}).describe('Stream editor for filtering and transforming text."),
  awk: z.object({
    args: z.string().describe("Arguments to pass to awk, e.g. \\'{print $1}\\' file.txt"),
  }).describe("Arguments to pass to awk, e.g. \\'{print $1}\\' file.txt'),\n\t}).describe('Pattern scanning and text processing."),
  writeFile: z.object({
    path: z.string().describe("File path relative to the project root, e.g. src/utils/helper.ts"),
    content: z.string().describe("The full content to write to the file"),
  }).describe("File path relative to the project root, e.g. src/utils/helper.ts'),\n\t\tcontent: z.string().describe('The full content to write to the file'),\n\t}).describe('Write content to a file. Creates the file if it does not exist, overwrites if it does."),
  pwd: z.object({}).describe("Print the current working directory."),
}

export async function rg(options: z.infer<typeof schemas.rg>) {
  return proc().exec(`rg ${sanitizeArgs(args, 'rg', 'permissive')}`)
}

export async function ls(options: z.infer<typeof schemas.ls>) {
  return proc().exec(`ls ${sanitizeArgs(args, 'ls')}`)
}

export async function cat(options: z.infer<typeof schemas.cat>) {
  return proc().exec(`cat ${sanitizeArgs(args, 'cat')}`)
}

export async function sed(options: z.infer<typeof schemas.sed>) {
  return proc().exec(`sed ${sanitizeArgs(args, 'sed', 'permissive')}`)
}

export async function awk(options: z.infer<typeof schemas.awk>) {
  return proc().exec(`awk ${sanitizeArgs(args, 'awk', 'permissive')}`)
}

export async function writeFile(options: z.infer<typeof schemas.writeFile>) {
  await fs().writeFileAsync(path, content)
  return `Wrote ${content.length} bytes to ${path}`
}

export async function pwd(options: z.infer<typeof schemas.pwd>) {
  return proc().exec('pwd')
}
