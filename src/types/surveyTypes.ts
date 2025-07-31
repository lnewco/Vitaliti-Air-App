/**
 * Survey Types for Session Sentiment Tracking
 * 
 * Defines the data structures for pre-session, post-session, 
 * and intra-session sentiment surveys.
 */

// Scale values: 1-5 integer range
export type SurveyScale = 1 | 2 | 3 | 4 | 5;

// Base survey response interface
export interface SurveyResponse {
  clarity: SurveyScale;
  energy: SurveyScale;
}

// Pre-session survey data
export interface PreSessionSurvey extends SurveyResponse {
  // Inherits clarity and energy from SurveyResponse
}

// Post-session survey data  
export interface PostSessionSurvey extends SurveyResponse {
  stress: SurveyScale;
  notes?: string;
}

// Intra-session survey data
export interface IntraSessionResponse extends SurveyResponse {
  stress: SurveyScale;
  phaseNumber: number;
  timestamp: number;
}

// Complete session survey record (database entity)
export interface SessionSurvey {
  id?: number;
  sessionId: string;
  clarityPre?: SurveyScale;
  energyPre?: SurveyScale;
  clarityPost?: SurveyScale;
  energyPost?: SurveyScale;
  stressPost?: SurveyScale;
  notesPost?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Intra-session response record (database entity)
export interface IntraSessionResponseRecord {
  id?: number;
  sessionId: string;
  phaseNumber: number;
  clarity: SurveyScale;
  energy: SurveyScale;
  stress: SurveyScale;
  timestamp: number;
  createdAt?: number;
}

// Combined survey data for a session
export interface SessionSurveyData {
  sessionId: string;
  preSession?: PreSessionSurvey;
  postSession?: PostSessionSurvey;
  intraSessionResponses: IntraSessionResponse[];
}

// Survey validation result
export interface SurveyValidationResult {
  isValid: boolean;
  errors: string[];
}

// Survey submission status
export interface SurveySubmissionResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Scale labels for UI
export const CLARITY_LABELS = {
  1: 'Very Foggy',
  2: 'Foggy', 
  3: 'Neutral',
  4: 'Clear',
  5: 'Very Clear'
} as const;

export const ENERGY_LABELS = {
  1: 'Very Fatigued',
  2: 'Fatigued',
  3: 'Neutral', 
  4: 'Energized',
  5: 'Very Energized'
} as const;

export const STRESS_LABELS = {
  1: 'Strained',
  2: 'Tense',
  3: 'Neutral',
  4: 'Focused', 
  5: 'Invigorated'
} as const;

// Default survey values (UI defaults to neutral)
export const DEFAULT_SURVEY_VALUES = {
  clarity: 3 as SurveyScale,
  energy: 3 as SurveyScale,
  stress: 3 as SurveyScale
} as const; 