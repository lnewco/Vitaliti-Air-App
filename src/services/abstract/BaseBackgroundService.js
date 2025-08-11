/**
 * BaseBackgroundService - Abstract base class for background services
 * 
 * Defines the interface that both native and Expo implementations must follow
 */

export default class BaseBackgroundService {
  constructor() {
    this.isNative = false;
    this.isActive = false;
    this.sessionData = null;
  }

  /**
   * Initialize the background service
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Start background monitoring for a session
   */
  async startBackgroundMonitoring(sessionData) {
    throw new Error('startBackgroundMonitoring() must be implemented by subclass');
  }

  /**
   * Stop background monitoring
   */
  async stopBackgroundMonitoring() {
    throw new Error('stopBackgroundMonitoring() must be implemented by subclass');
  }

  /**
   * Update background state
   */
  async updateBackgroundState(state) {
    throw new Error('updateBackgroundState() must be implemented by subclass');
  }

  /**
   * Sync with background state when app returns to foreground
   */
  async syncWithBackgroundState() {
    throw new Error('syncWithBackgroundState() must be implemented by subclass');
  }

  /**
   * Pause background session
   */
  async pauseBackgroundSession() {
    throw new Error('pauseBackgroundSession() must be implemented by subclass');
  }

  /**
   * Resume background session
   */
  async resumeBackgroundSession() {
    throw new Error('resumeBackgroundSession() must be implemented by subclass');
  }

  /**
   * Check if background service is available
   */
  isAvailable() {
    return this.isNative;
  }

  /**
   * Get service type identifier
   */
  getServiceType() {
    return this.isNative ? 'native' : 'expo';
  }
}