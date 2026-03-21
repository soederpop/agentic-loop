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

export const PreferencesOptionsSchema = FeatureOptionsSchema.extend({})
export type PreferencesOptions = z.infer<typeof PreferencesOptionsSchema>

/**
 * A feature that does something useful
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
}

export default Preferences