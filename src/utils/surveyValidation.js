/**
 * Validates if a value is a valid survey scale (1-5)
 */
export const isValidSurveyScale = (value) => {
  return Number.isInteger(value) && value >= 1 && value <= 5;
};

/**
 * Validates pre-session survey data
 */
export const validatePreSessionSurvey = (data) => {
  const errors = [];

  if (!data.clarity || !isValidSurveyScale(data.clarity)) {
    errors.push('Mental clarity is required and must be a value from 1 to 5');
  }

  if (!data.energy || !isValidSurveyScale(data.energy)) {
    errors.push('Energy level is required and must be a value from 1 to 5');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates post-session survey data
 */
export const validatePostSessionSurvey = (data) => {
  const errors = [];

  if (!data.clarity || !isValidSurveyScale(data.clarity)) {
    errors.push('Mental clarity is required and must be a value from 1 to 5');
  }

  if (!data.energy || !isValidSurveyScale(data.energy)) {
    errors.push('Energy level is required and must be a value from 1 to 5');
  }

  if (!data.stress || !isValidSurveyScale(data.stress)) {
    errors.push('Stress level is required and must be a value from 1 to 5');
  }

  // Notes are optional, but if provided, should be reasonable length
  if (data.notes && data.notes.length > 500) {
    errors.push('Notes should be 500 characters or less');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates intra-session response data
 */
export const validateIntraSessionResponse = (data) => {
  const errors = [];

  if (!data.clarity || !isValidSurveyScale(data.clarity)) {
    errors.push('Mental clarity is required and must be a value from 1 to 5');
  }

  if (!data.energy || !isValidSurveyScale(data.energy)) {
    errors.push('Energy level is required and must be a value from 1 to 5');
  }

  if (!data.stress || !isValidSurveyScale(data.stress)) {
    errors.push('Stress level is required and must be a value from 1 to 5');
  }

  if (!data.phaseNumber || !Number.isInteger(data.phaseNumber) || data.phaseNumber < 1) {
    errors.push('Phase number is required and must be a positive integer');
  }

  if (!data.timestamp || !Number.isInteger(data.timestamp) || data.timestamp <= 0) {
    errors.push('Timestamp is required and must be a valid timestamp');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitizes survey notes by trimming whitespace and limiting length
 */
export const sanitizeSurveyNotes = (notes) => {
  if (!notes || typeof notes !== 'string') {
    return null;
  }

  const trimmed = notes.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Limit to 500 characters
  return trimmed.length > 500 ? trimmed.substring(0, 500) : trimmed;
};

/**
 * Checks if all required fields are filled for a survey
 */
export const isPreSessionSurveyComplete = (data) => {
  return isValidSurveyScale(data.clarity) && isValidSurveyScale(data.energy);
};

export const isPostSessionSurveyComplete = (data) => {
  return isValidSurveyScale(data.clarity) && 
         isValidSurveyScale(data.energy) && 
         isValidSurveyScale(data.stress);
};

export const isIntraSessionResponseComplete = (data) => {
  return isValidSurveyScale(data.clarity) && 
         isValidSurveyScale(data.energy) && 
         isValidSurveyScale(data.stress) &&
         Boolean(data.phaseNumber && data.timestamp);
};

/**
 * Creates default survey values with neutral defaults
 */
export const createDefaultPreSessionSurvey = () => ({
  clarity: null,
  energy: null,
});

export const createDefaultPostSessionSurvey = () => ({
  clarity: null,
  energy: null,
  stress: null,
  notes: null,
});

export const createDefaultIntraSessionResponse = (phaseNumber) => ({
  clarity: null,
  energy: null,
  stress: null,
  phaseNumber,
  timestamp: Date.now(),
});

/**
 * Error messages for user-friendly display
 */
export const SURVEY_ERROR_MESSAGES = {
  REQUIRED_FIELD: 'This field is required',
  INVALID_SCALE: 'Please select a value from 1 to 5',
  NOTES_TOO_LONG: 'Notes should be 500 characters or less',
  GENERAL_VALIDATION: 'Please check your responses and try again',
}; 