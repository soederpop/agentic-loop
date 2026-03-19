import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({
  _: z.array(z.string()).default([]).describe('Subcommand and arguments: list, add <name>, remove <name>, active, use <name>'),
  file: z.string().optional().describe('Path to credentials file (for add subcommand)'),
})

type ProfileOptions = z.infer<typeof argsSchema>

const PROFILES_DIR_BASE = '.luca/gws-profiles'

async function gwsProfiles(options: ProfileOptions, context: ContainerContext) {
  const { container } = context as any
  const fs = container.feature('fs')
  const ui = container.feature('ui')
  const proc = container.feature('proc')
  const chalk = ui.colors

  const home = process.env.HOME || process.env.USERPROFILE || ''
  const profilesDir = `${home}/${PROFILES_DIR_BASE}`

  const positional = options._ || []
  const subcommand = positional[1] || 'list'
  const name = positional[2]

  function ensureProfilesDir() {
    if (!fs.exists(profilesDir)) {
      fs.ensureFolder(profilesDir)
    }
  }

  async function listProfiles(): Promise<string[]> {
    if (!fs.exists(profilesDir)) return []
    try {
      const entries = await fs.readdir(profilesDir)
      // Filter to directories only by checking for credential files
      return entries.filter((entry: { name: string }) => {
        const dir = `${profilesDir}/${entry.name}`
        return fs.exists(`${dir}/profile.json`) || fs.exists(`${dir}/credentials.json`) || fs.exists(`${dir}/service-account.json`)
      }).map((entry: { name: string }) => entry.name)
    } catch {
      return []
    }
  }

  switch (subcommand) {
    case 'list': {
      const profiles = await listProfiles()
      if (profiles.length === 0) {
        console.log(chalk.yellow('No GWS profiles found.'))
        console.log(`Create one with: ${chalk.cyan('luca gws-profiles add <name>')}`)
        return
      }
      console.log(chalk.bold('GWS Credential Profiles:\n'))
      for (const p of profiles) {
        const dir = `${profilesDir}/${p}`
        const hasProfile = fs.exists(`${dir}/profile.json`)
        const hasSA = fs.exists(`${dir}/service-account.json`)
        const hasCreds = fs.exists(`${dir}/credentials.json`)
        let type = hasProfile ? 'oauth' : hasSA ? 'service-account' : hasCreds ? 'credentials' : 'empty'
        let account = ''
        if (hasProfile) {
          try {
            const cfg = JSON.parse(fs.readFile(`${dir}/profile.json`))
            account = cfg.account ? ` → ${cfg.account}` : ''
          } catch {}
        }
        console.log(`  ${chalk.green(p)} ${chalk.gray(`(${type}${account})`)}`)
      }
      break
    }

    case 'add': {
      if (!name) {
        console.error(chalk.red('Usage: luca gws-profiles add <name> [--file <path>]'))
        return
      }

      ensureProfilesDir()
      const profileDir = `${profilesDir}/${name}`

      if (fs.exists(profileDir)) {
        console.error(chalk.red(`Profile '${name}' already exists.`))
        return
      }

      if (options.file) {
        // Import existing credentials file
        const sourcePath = container.paths.resolve(options.file)
        if (!fs.exists(sourcePath)) {
          console.error(chalk.red(`File not found: ${sourcePath}`))
          return
        }

        fs.ensureFolder(profileDir)
        const isServiceAccount = options.file.includes('service-account')
        const destName = isServiceAccount ? 'service-account.json' : 'credentials.json'
        const destPath = `${profileDir}/${destName}`

        const content = fs.readFile(sourcePath)
        await fs.writeFileAsync(destPath, content)
        await proc.exec(`chmod 600 "${destPath}"`)
        console.log(chalk.green(`Profile '${name}' created from ${options.file}`))
      } else {
        // Interactive: run gws auth login, capture the output to get credentials_file path
        console.log(chalk.cyan(`Authenticating profile '${name}'...`))
        console.log('Running gws auth login...\n')

        let urlOpened = false
        const handleOutput = (data: string) => {
          process.stdout.write(data)
          if (!urlOpened) {
            const urlMatch = data.match(/https?:\/\/[^\s]+/)
            if (urlMatch) {
              urlOpened = true
              proc.exec(`open "${urlMatch[0]}"`)
            }
          }
        }

        const loginResult = await proc.spawnAndCapture('gws', ['auth', 'login'], {
          onOutput: handleOutput,
          onError: handleOutput,
        })

        if (loginResult.exitCode !== 0) {
          console.error(chalk.red('Authentication failed.'))
          return
        }

        // Parse the login output to get the credentials_file and account
        let loginInfo: any
        try {
          // The login output contains the auth URL text followed by JSON — extract the JSON part
          const jsonMatch = loginResult.stdout.match(/\{[\s\S]*\}\s*$/)
          if (!jsonMatch) throw new Error('No JSON found in login output')
          loginInfo = JSON.parse(jsonMatch[0])
        } catch (e: any) {
          console.error(chalk.red(`Failed to parse login output: ${e.message}`))
          console.error(chalk.gray(`stdout: ${loginResult.stdout.slice(-500)}`))
          return
        }

        if (loginInfo.status !== 'success' || !loginInfo.credentials_file) {
          console.error(chalk.red('Login did not return expected success response.'))
          console.error(chalk.gray(JSON.stringify(loginInfo, null, 2)))
          return
        }

        // Verify the credentials file exists
        if (!fs.exists(loginInfo.credentials_file)) {
          console.error(chalk.red(`Credentials file not found at: ${loginInfo.credentials_file}`))
          return
        }

        // Save a profile.json that references the gws credentials location
        fs.ensureFolder(profileDir)
        const profileConfig = {
          account: loginInfo.account,
          credentialsFile: loginInfo.credentials_file,
          scopes: loginInfo.scopes || [],
          createdAt: new Date().toISOString(),
        }
        const profilePath = `${profileDir}/profile.json`
        await fs.writeFileAsync(profilePath, JSON.stringify(profileConfig, null, 2))
        console.log(chalk.green(`Profile '${name}' created successfully.`))
        console.log(chalk.gray(`  account: ${loginInfo.account}`))
        console.log(chalk.gray(`  credentials: ${loginInfo.credentials_file}`))
      }
      break
    }

    case 'remove': {
      if (!name) {
        console.error(chalk.red('Usage: luca gws-profiles remove <name>'))
        return
      }

      const profileDir = `${profilesDir}/${name}`
      if (!fs.exists(profileDir)) {
        console.error(chalk.red(`Profile '${name}' not found.`))
        return
      }

      await fs.rmdir(profileDir)
      console.log(chalk.green(`Profile '${name}' removed.`))
      break
    }

    case 'active': {
      const gws = container.feature('gws')
      const current = gws.currentProfile
      if (current) {
        console.log(`Active profile: ${chalk.green(current)}`)
      } else {
        console.log(chalk.yellow('No active profile (using default credentials).'))
      }
      break
    }

    case 'use': {
      if (!name) {
        console.error(chalk.red('Usage: luca gws-profiles use <name>'))
        return
      }

      const profileDir = `${profilesDir}/${name}`
      if (!fs.exists(profileDir)) {
        console.error(chalk.red(`Profile '${name}' not found.`))
        return
      }

      const gws = container.feature('gws')
      gws.useProfile(name)
      console.log(chalk.green(`Now using profile '${name}'.`))
      break
    }

    default:
      console.error(chalk.red(`Unknown subcommand: ${subcommand}`))
      console.log('Available: list, add, remove, active, use')
  }
}

export default {
  description: 'Manage GWS credential profiles: list, add, remove, activate, and switch between profiles',
  argsSchema,
  handler: gwsProfiles,
}
