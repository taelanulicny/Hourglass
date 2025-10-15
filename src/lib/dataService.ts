import { supabase } from './supabaseClient'

// Data migration service to move localStorage to Supabase
export class DataService {
  static async migrateUserData(userId: string) {
    try {
      // Check if user already has data (already migrated)
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (existingProfile) {
        console.log('User data already exists, skipping migration')
        return { migrated: false, message: 'Data already exists' }
      }

      // Migrate user profile/settings
      await this.migrateUserProfile(userId)
      
      // Migrate focus areas
      await this.migrateFocusAreas(userId)
      
      // Migrate events
      await this.migrateEvents(userId)
      
      // Migrate tasks
      await this.migrateTasks(userId)
      
      // Migrate vault resources
      await this.migrateVaultResources(userId)

      return { migrated: true, message: 'Migration completed successfully' }
    } catch (error) {
      console.error('Migration failed:', error)
      return { migrated: false, message: 'Migration failed', error }
    }
  }

  private static async migrateUserProfile(userId: string) {
    const userName = localStorage.getItem('userName')
    const userEmail = localStorage.getItem('userEmail')
    const sleepHours = localStorage.getItem('sleepHours')
    const miscHours = localStorage.getItem('miscHours')
    const profilePicture = localStorage.getItem('profilePicture')

    if (userName || userEmail || sleepHours || miscHours || profilePicture) {
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          username: userName || null,
          email: userEmail || null,
          sleep_hours: sleepHours ? parseInt(sleepHours) : null,
          misc_hours: miscHours ? parseInt(miscHours) : null,
          profile_picture: profilePicture || null
        })

      if (error) throw error
    }
  }

  private static async migrateFocusAreas(userId: string) {
    // Get current focus categories
    const focusCategoriesRaw = localStorage.getItem('focusCategories')
    const lastProcessedWeekKey = localStorage.getItem('lastProcessedWeekKey')
    
    if (focusCategoriesRaw) {
      const focusCategories = JSON.parse(focusCategoriesRaw)
      
      // Get current week key
      const now = new Date()
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1))
      const currentWeekKey = startOfWeek.toISOString().split('T')[0]
      
      const { error } = await supabase
        .from('focus_areas')
        .insert({
          user_id: userId,
          week_key: currentWeekKey,
          categories: focusCategories,
          last_processed_week_key: lastProcessedWeekKey || currentWeekKey
        })

      if (error) throw error
    }

    // Migrate weekly snapshots
    const keys = Object.keys(localStorage)
    const weeklyKeys = keys.filter(key => key.startsWith('focusCategories:week:'))
    
    for (const key of weeklyKeys) {
      const weekKey = key.replace('focusCategories:week:', '')
      const data = localStorage.getItem(key)
      if (data) {
        const { error } = await supabase
          .from('focus_areas')
          .upsert({
            user_id: userId,
            week_key: weekKey,
            categories: JSON.parse(data),
            last_processed_week_key: weekKey
          })

        if (error) throw error
      }
    }
  }

  private static async migrateEvents(userId: string) {
    // Check both possible event keys
    const eventKeys = ['hourglassEvents:v1', 'calendarEvents']
    
    for (const eventKey of eventKeys) {
      const eventsRaw = localStorage.getItem(eventKey)
      if (eventsRaw) {
        const events = JSON.parse(eventsRaw)
        
        if (Array.isArray(events) && events.length > 0) {
          // Transform events to match database schema
          const transformedEvents = events.map(event => ({
            user_id: userId,
            title: event.title || '',
            start: event.start || null,
            end: event.end || null,
            category: event.area || event.category || null,
            is_repeating: event.is_repeating || false,
            repeat_type: event.repeat_type || null,
            original_date: event.original_date || null,
            metadata: {
              notes: event.notes || null,
              color: event.color || null
            }
          }))

          const { error } = await supabase
            .from('events')
            .insert(transformedEvents)

          if (error) throw error
          break // Only migrate from first found key
        }
      }
    }
  }

  private static async migrateTasks(userId: string) {
    const keys = Object.keys(localStorage)
    const taskKeys = keys.filter(key => key.startsWith('tasks:'))
    
    for (const taskKey of taskKeys) {
      const focusAreaLabel = taskKey.replace('tasks:', '')
      const tasksRaw = localStorage.getItem(taskKey)
      
      if (tasksRaw) {
        const tasks = JSON.parse(tasksRaw)
        
        const { error } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            focus_area_label: focusAreaLabel,
            tasks: tasks
          })

        if (error) throw error
      }
    }
  }

  private static async migrateVaultResources(userId: string) {
    const vaultRaw = localStorage.getItem('myLearningPath')
    
    if (vaultRaw) {
      const resources = JSON.parse(vaultRaw)
      
      if (Array.isArray(resources) && resources.length > 0) {
        const transformedResources = resources.map(resource => ({
          user_id: userId,
          title: resource.title || resource.name || '',
          url: resource.url || '',
          resource_type: resource.type || 'general',
          tags: resource.tags || [],
          metadata: {
            description: resource.description || null,
            savedAt: resource.savedAt || null
          }
        }))

        const { error } = await supabase
          .from('vault_resources')
          .insert(transformedResources)

        if (error) throw error
      }
    }
  }
}
