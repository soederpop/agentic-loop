/**
 * update — Check for new versions of luca and contentbase, install them,
 * and sync luca docs into the skill references folder.
 *
 * Run with: luca update
 */
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Update luca and contentbase to latest versions and sync reference docs'

export const argsSchema = z.object({
  dryRun: z.boolean().default(false).describe('Show what would be updated without making changes'),
})

export default async function update(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')
  const fs = container.feature('fs')
  const proc = container.feature('proc')
  const root = container.paths.resolve('.')

  const packages = ['@soederpop/luca', 'contentbase']
  const pkgJsonPath = container.paths.resolve('package.json')

  // Read current package.json
  const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8'))
  const currentDeps = pkgJson.dependencies || {}

  ui.print.cyan('\n  Checking for updates...\n')

  // Check latest versions from npm
  const updates: { name: string; current: string; latest: string }[] = []

  for (const pkg of packages) {
    const currentVersion = (currentDeps[pkg] || '').replace(/[\^~]/, '')
    try {
      const latest = (await proc.exec(`npm view ${pkg} version`, { cwd: root })).trim()

      if (latest && latest !== currentVersion) {
        updates.push({ name: pkg, current: currentVersion, latest })
        ui.print.green(`  ${pkg}: ${currentVersion} → ${latest}`)
      } else {
        ui.print.dim(`  ${pkg}: ${currentVersion} (up to date)`)
      }
    } catch (err: any) {
      ui.print.red(`  ${pkg}: failed to check — ${err.message}`)
    }
  }

  if (updates.length === 0) {
    ui.print.dim('\n  Everything is up to date.\n')
  }

  if (options.dryRun) {
    ui.print.dim('\n  Dry run — no changes made.\n')
    return
  }

  // Update package.json versions
  if (updates.length > 0) {
    for (const { name, latest } of updates) {
      pkgJson.dependencies[name] = `^${latest}`
    }
    await fs.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n')
    ui.print.cyan('\n  Updated package.json')

    // Run bun install
    ui.print.cyan('  Running bun install...\n')
    try {
      const installOutput = await proc.exec('bun install', { cwd: root })
      if (installOutput) ui.print.dim(installOutput)
      ui.print.green('  Packages installed.')
    } catch (err: any) {
      ui.print.red(`  bun install failed: ${err.message}`)
      return
    }
  }

  // Sync luca docs into references folder
  ui.print.cyan('\n  Syncing luca reference docs...\n')

  const lucaDocsBase = container.paths.resolve('node_modules/@soederpop/luca/docs')
  const refsBase = container.paths.resolve('.claude/skills/luca-framework/references')

  const folders = ['examples', 'tutorials', 'apis']

  for (const folder of folders) {
    const src = `${lucaDocsBase}/${folder}`
    const dest = `${refsBase}/${folder}`

    // Check source exists
    if (!(await fs.exists(src))) {
      ui.print.dim(`  Skipping ${folder}/ (not found in luca package)`)
      continue
    }

    // Remove old copy and do a fresh sync
    if (await fs.exists(dest)) {
      await proc.exec(`rm -rf ${dest}`, { cwd: root })
    }
    await proc.exec(`cp -r ${src} ${dest}`, { cwd: root })

    // Count files copied
    const count = (await proc.exec(`find ${dest} -type f | wc -l`, { cwd: root })).trim()
    ui.print.green(`  ${folder}/  (${count} files)`)
  }

  ui.print.cyan('\n  Update complete.\n')
}
