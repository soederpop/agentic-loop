import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    preferences: typeof Preferences
  }
}

export const PreferencesStateSchema = FeatureStateSchema.extend({})
export type PreferencesState = z.infer<typeof PreferencesStateSchema>

export const PreferencesOptionsSchema = FeatureOptionsSchema.extend({
  configFilePath: z.string().default('config.yml').describe('the path to the preferences configuration file'),
  manifestKey: z.string().default('agenticLoop').describe('Where to look for preferences data in the projects package.json')
})

export type PreferencesOptions = z.infer<typeof PreferencesOptionsSchema>

/**
 * The Preferences feature manages the global preferences of the Agentic Loop and allows users to control things like the default coding assistant to use when running tasks / plays etc.   
 *
 * @example
 * ```typescript
 * const preferences = container.feature('preferences')
 * ```
 *
 * @extends Feature
 */
export class Preferences extends Feature<PreferencesState, PreferencesOptions> {
  static override shortcut = 'features.preferences' as const
  static override stateSchema = PreferencesStateSchema
  static override optionsSchema = PreferencesOptionsSchema
  static { Feature.register(this, 'preferences') }

  async afterInitialize() {
    // Setup logic goes here — not in the constructor
  }
  
  get configFilePath() {
    return this.container.paths.resolve(this.options.configFilePath || 'config.yml')
  }
  
  get loopConfigFileData() {
    if (!this.container.fs.exists(this.configFilePath)) {
      return { }
    }

    return this.container.feature('yaml').parse<Record<string, any>>(
      this.container.fs.readFile(this.configFilePath).toString()
    )
  }
  
  get manifestPreferences() {
    const manifestKey = this.options.manifestKey || 'agenticLoop'
    return (this.container.manifest[manifestKey] || { }) as Record<string,any>
  }
}

export default Preferences