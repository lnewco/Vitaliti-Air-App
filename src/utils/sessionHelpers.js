/**
 * Session helper utilities
 */

import { SESSION_LIMITS } from '../constants/sessionConstants';

/**
 * Calculate total session duration
 * @param {number} cycles - Number of cycles
 * @param {number} hypoxicDuration - Hypoxic phase duration in minutes
 * @param {number} recoveryDuration - Recovery phase duration in minutes
 * @returns {number} Total session time in minutes
 */
export const calculateSessionDuration = (cycles, hypoxicDuration, recoveryDuration) => {
  return cycles * (hypoxicDuration + recoveryDuration);
};

/**
 * Cycle through total cycles value
 * @param {number} current - Current cycle count
 * @returns {number} Next cycle count
 */
export const cycleCount = (current) => {
  return current >= SESSION_LIMITS.MAX_CYCLES ? SESSION_LIMITS.MIN_CYCLES : current + 1;
};

/**
 * Cycle through hypoxic duration value
 * @param {number} current - Current hypoxic duration
 * @returns {number} Next hypoxic duration
 */
export const cycleHypoxicDuration = (current) => {
  return current >= SESSION_LIMITS.MAX_HYPOXIC_DURATION ? SESSION_LIMITS.MIN_HYPOXIC_DURATION : current + 1;
};

/**
 * Cycle through recovery duration value
 * @param {number} current - Current recovery duration
 * @returns {number} Next recovery duration
 */
export const cycleRecoveryDuration = (current) => {
  return current >= SESSION_LIMITS.MAX_RECOVERY_DURATION ? SESSION_LIMITS.MIN_RECOVERY_DURATION : current + 1;
};