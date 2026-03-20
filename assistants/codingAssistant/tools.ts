import { z } from 'zod'
import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

const proc = () => container.feature('proc')

export const schemas = {
	rg: z.object({
		args: z.string().describe('Arguments to pass to ripgrep, e.g. "TODO" --type ts -n'),
	}).describe('Search file contents using ripgrep (rg). Fast, recursive, respects .gitignore.'),

	ls: z.object({
		args: z.string().default('.').describe('Arguments to pass to ls, e.g. -la src/'),
	}).describe('List files and directories.'),

	cat: z.object({
		args: z.string().describe('Arguments to pass to cat, e.g. src/index.ts'),
	}).describe('Read file contents.'),

	sed: z.object({
		args: z.string().describe('Arguments to pass to sed, e.g. -n "10,20p" src/index.ts'),
	}).describe('Stream editor for filtering and transforming text.'),

	awk: z.object({
		args: z.string().describe('Arguments to pass to awk, e.g. \'{print $1}\' file.txt'),
	}).describe('Pattern scanning and text processing.'),

	pwd: z.object({}).describe('Print the current working directory.'),
}

export function rg({ args }: z.infer<typeof schemas.rg>): string {
	return proc().exec(`rg ${args}`)
}

export function ls({ args }: z.infer<typeof schemas.ls>): string {
	return proc().exec(`ls ${args}`)
}

export function cat({ args }: z.infer<typeof schemas.cat>): string {
	return proc().exec(`cat ${args}`)
}

export function sed({ args }: z.infer<typeof schemas.sed>): string {
	return proc().exec(`sed ${args}`)
}

export function awk({ args }: z.infer<typeof schemas.awk>): string {
	return proc().exec(`awk ${args}`)
}

export function pwd(): string {
	return proc().exec('pwd')
}
