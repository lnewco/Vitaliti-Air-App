/**
 * Survey Types for Session Sentiment Tracking
 * 
 * Defines the data structures for pre-session, post-session, 
 * and intra-session sentiment surveys.
 */

// Survey scale labels for UI display
export const CLARITY_LABELS = {
  1: "Very Foggy",
  2: "Somewhat Foggy", 
  3: "Neutral",
  4: "Somewhat Clear",
  5: "Very Clear"
};

export const ENERGY_LABELS = {
  1: "Very Fatigued",
  2: "Somewhat Fatigued",
  3: "Neutral", 
  4: "Somewhat Energized",
  5: "Very Energized"
};

export const STRESS_LABELS = {
  1: "Strained",
  2: "Tense",
  3: "Neutral",
  4: "Focused", 
  5: "Invigorated"
};

// Default survey values
export const DEFAULT_SURVEY_VALUES = {
  clarity: 3,
  energy: 3,
  stress: 3
}; 