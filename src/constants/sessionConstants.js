/**
 * Session configuration constants
 */

export const SESSION_DEFAULTS = {
  ALTITUDE_LEVEL: 6,
  TOTAL_CYCLES: 5,
  HYPOXIC_DURATION: 7,
  RECOVERY_DURATION: 3,
  DEFAULT_USER_ID: 'default_user',
};

export const SESSION_LIMITS = {
  MAX_CYCLES: 5,
  MIN_CYCLES: 1,
  MAX_HYPOXIC_DURATION: 10,
  MIN_HYPOXIC_DURATION: 3,
  MAX_RECOVERY_DURATION: 5,
  MIN_RECOVERY_DURATION: 2,
};

export const SESSION_COLORS = {
  SUCCESS: '#4CAF50',
  WARNING: '#FFCC00',
  ERROR: '#FF3B30',
  DARK_BG: '#000',
};

export const DEMO_MODE = {
  DEVICE_NAME: 'DEMO MODE',
  DEVICE_ID: 'demo-device',
};