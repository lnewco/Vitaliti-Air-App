export interface IHHTSessionData {
  sessionId: string;
  sessionType: string;
  startTime: number; // Unix timestamp in milliseconds
  totalCycles?: number;
}

export interface IHHTActivityUpdateData {
  currentPhase: 'HYPOXIC' | 'HYPEROXIC' | 'COMPLETED';
  currentCycle: number;
  phaseTimeRemaining: number; // seconds
  pausedAt?: number; // Unix timestamp in milliseconds, null if not paused
}

export interface LiveActivityResponse {
  success: boolean;
  activityId?: string;
  message?: string;
  updated?: boolean;
  ended?: boolean;
}

export interface ActivityStatus {
  hasActiveActivity: boolean;
  activityId?: string;
  activityState?: string;
}

export interface ActivityStateChangeEvent {
  state: 'started' | 'ended';
  activityId: string;
}

export interface LiveActivityModuleInterface {
  /**
   * Check if Live Activities are supported on this device
   */
  isSupported(): Promise<boolean>;

  /**
   * Start a new Live Activity for an IHHT session
   */
  startActivity(sessionData: IHHTSessionData): Promise<LiveActivityResponse>;

  /**
   * Update the current Live Activity with new session data
   */
  updateActivity(updateData: IHHTActivityUpdateData): Promise<LiveActivityResponse>;

  /**
   * Stop the current Live Activity
   */
  stopActivity(): Promise<LiveActivityResponse>;

  /**
   * Get the current activity status
   */
  getActivityStatus(): ActivityStatus;

  // Event listeners will be added in a future update
} 