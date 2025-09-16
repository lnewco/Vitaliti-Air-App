/**
 * SurveyDatabaseService - Handles all survey-related database operations
 *
 * Manages pre-session, post-session, and intra-session surveys
 * with validation and consistent error handling.
 */

import BaseDatabaseService from './BaseDatabaseService';
import SupabaseService from '../SupabaseService';

class SurveyDatabaseService extends BaseDatabaseService {
  constructor() {
    super('SurveyDatabaseService');
  }

  /**
   * Validate survey scale value (1-5)
   * @param {number} value - Value to validate
   * @returns {boolean}
   */
  isValidSurveyScale(value) {
    return value !== null && value !== undefined && value >= 1 && value <= 5;
  }

  /**
   * Save pre-session survey with retry logic
   * @param {string} sessionId - Session ID
   * @param {number} clarityPre - Mental clarity rating (1-5)
   * @param {number} energyPre - Energy level rating (1-5)
   * @param {number} stressPre - Stress level rating (1-5)
   * @returns {Promise<Object>}
   */
  async savePreSessionSurvey(sessionId, clarityPre, energyPre, stressPre) {
    this.ensureInitialized();

    // Validate inputs
    if (!this.isValidSurveyScale(clarityPre) ||
        !this.isValidSurveyScale(energyPre) ||
        !this.isValidSurveyScale(stressPre)) {
      throw new Error('Invalid survey scale values. All values must be between 1 and 5.');
    }

    const operation = async () => {
      const query = `
        INSERT INTO surveys (
          session_id, clarity_pre, energy_pre, stress_pre,
          survey_timestamp_pre, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      const timestamp = Date.now();
      await this.db.runAsync(query, [
        sessionId, clarityPre, energyPre, stressPre,
        timestamp, timestamp
      ]);

      this.log.info(`✅ Saved pre-session survey for session ${sessionId}`);

      // Sync to Supabase
      try {
        if (SupabaseService?.syncPreSessionSurvey) {
          await SupabaseService.syncPreSessionSurvey(
            sessionId, clarityPre, energyPre, stressPre
          );
          this.log.info('✅ Synced pre-session survey to Supabase');
        }
      } catch (syncError) {
        this.log.warn('⚠️ Failed to sync pre-session survey:', syncError.message);
      }

      return this.formatSuccessResponse('savePreSessionSurvey', {
        sessionId,
        clarityPre,
        energyPre,
        stressPre
      });
    };

    return this.executeWithRetry(operation, 'savePreSessionSurvey');
  }

  /**
   * Save post-session survey with retry logic
   * @param {string} sessionId - Session ID
   * @param {number} clarityPost - Post-session mental clarity (1-5)
   * @param {number} energyPost - Post-session energy level (1-5)
   * @param {number} stressPost - Post-session stress level (1-5)
   * @param {string} notesPost - Optional notes
   * @param {string[]} symptoms - Array of symptoms
   * @param {number} overallRating - Overall session rating (1-5)
   * @returns {Promise<Object>}
   */
  async savePostSessionSurvey(sessionId, clarityPost, energyPost, stressPost,
                               notesPost = null, symptoms = [], overallRating = null) {
    this.ensureInitialized();

    // Validate required fields
    if (!this.isValidSurveyScale(clarityPost) ||
        !this.isValidSurveyScale(energyPost) ||
        !this.isValidSurveyScale(stressPost)) {
      throw new Error('Invalid survey scale values. All values must be between 1 and 5.');
    }

    if (overallRating && !this.isValidSurveyScale(overallRating)) {
      throw new Error('Invalid overall rating. Must be between 1 and 5.');
    }

    const operation = async () => {
      // Check if pre-survey exists
      const existing = await this.db.getAllAsync(
        'SELECT id FROM surveys WHERE session_id = ?',
        [sessionId]
      );

      if (!existing || existing.length === 0) {
        throw new Error('Pre-session survey not found. Cannot save post-session survey.');
      }

      const query = `
        UPDATE surveys SET
          clarity_post = ?,
          energy_post = ?,
          stress_post = ?,
          notes_post = ?,
          symptoms = ?,
          overall_rating = ?,
          survey_timestamp_post = ?,
          updated_at = ?
        WHERE session_id = ?
      `;

      const timestamp = Date.now();
      await this.db.runAsync(query, [
        clarityPost,
        energyPost,
        stressPost,
        notesPost,
        JSON.stringify(symptoms),
        overallRating,
        timestamp,
        timestamp,
        sessionId
      ]);

      this.log.info(`✅ Saved post-session survey for session ${sessionId}`);

      // Sync to Supabase
      try {
        if (SupabaseService?.syncPostSessionSurvey) {
          await SupabaseService.syncPostSessionSurvey(
            sessionId, clarityPost, energyPost, stressPost,
            notesPost, symptoms, overallRating
          );
          this.log.info('✅ Synced post-session survey to Supabase');
        }
      } catch (syncError) {
        this.log.warn('⚠️ Failed to sync post-session survey:', syncError.message);
      }

      return this.formatSuccessResponse('savePostSessionSurvey', {
        sessionId,
        clarityPost,
        energyPost,
        stressPost,
        symptoms: symptoms.length
      });
    };

    return this.executeWithRetry(operation, 'savePostSessionSurvey');
  }

  /**
   * Save intra-session response with retry logic
   * @param {Object} response - Intra-session response data
   * @returns {Promise<Object>}
   */
  async saveIntraSessionResponse(response) {
    this.ensureInitialized();
    this.validateRequiredFields(response, ['sessionId', 'phaseNumber', 'clarity', 'energy', 'stressPerception']);

    // Validate survey scales
    if (!this.isValidSurveyScale(response.clarity) ||
        !this.isValidSurveyScale(response.energy) ||
        !this.isValidSurveyScale(response.stressPerception)) {
      throw new Error('Invalid survey scale values. All values must be between 1 and 5.');
    }

    const operation = async () => {
      const query = `
        INSERT INTO intra_session_responses (
          session_id, phase_number, clarity, energy, stress_perception,
          sensations, spo2, heart_rate, response_timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const timestamp = response.timestamp || Date.now();
      await this.db.runAsync(query, [
        response.sessionId,
        response.phaseNumber,
        response.clarity,
        response.energy,
        response.stressPerception,
        JSON.stringify(response.sensations || []),
        response.spo2 || null,
        response.heartRate || null,
        timestamp,
        Date.now()
      ]);

      this.log.info(`✅ Saved intra-session response for session ${response.sessionId}, phase ${response.phaseNumber}`);

      // Sync to Supabase
      try {
        if (SupabaseService?.syncIntraSessionResponse) {
          await SupabaseService.syncIntraSessionResponse(
            response.sessionId,
            response.phaseNumber,
            response.clarity,
            response.energy,
            response.stressPerception,
            response.sensations,
            response.spo2,
            response.heartRate,
            timestamp
          );
          this.log.info('✅ Synced intra-session response to Supabase');
        }
      } catch (syncError) {
        this.log.warn('⚠️ Failed to sync intra-session response:', syncError.message);
      }

      return this.formatSuccessResponse('saveIntraSessionResponse', {
        sessionId: response.sessionId,
        phaseNumber: response.phaseNumber
      });
    };

    return this.executeWithRetry(operation, 'saveIntraSessionResponse');
  }

  /**
   * Get all survey data for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async getSessionSurveyData(sessionId) {
    this.ensureInitialized();

    const operation = async () => {
      // Get main survey
      const surveyQuery = `
        SELECT * FROM surveys WHERE session_id = ? LIMIT 1
      `;
      const surveyRow = await this.db.getFirstAsync(surveyQuery, [sessionId]);

      // Get intra-session responses
      const responsesQuery = `
        SELECT * FROM intra_session_responses
        WHERE session_id = ?
        ORDER BY phase_number ASC
      `;
      const responsesResult = await this.db.getAllAsync(responsesQuery, [sessionId]);

      // Parse JSON fields
      if (surveyRow?.symptoms) {
        try {
          surveyRow.symptoms = JSON.parse(surveyRow.symptoms);
        } catch (e) {
          surveyRow.symptoms = [];
        }
      }

      const responses = responsesResult.map(row => {
        if (row.sensations) {
          try {
            row.sensations = JSON.parse(row.sensations);
          } catch (e) {
            row.sensations = [];
          }
        }
        return row;
      });

      const result = {
        preSurvey: surveyRow && surveyRow.clarity_pre !== null ? {
          clarity: surveyRow.clarity_pre,
          energy: surveyRow.energy_pre,
          stress: surveyRow.stress_pre,
          timestamp: surveyRow.survey_timestamp_pre
        } : null,
        postSurvey: surveyRow && surveyRow.clarity_post !== null ? {
          clarity: surveyRow.clarity_post,
          energy: surveyRow.energy_post,
          stress: surveyRow.stress_post,
          notes: surveyRow.notes_post,
          symptoms: surveyRow.symptoms,
          overallRating: surveyRow.overall_rating,
          timestamp: surveyRow.survey_timestamp_post
        } : null,
        intraSessionResponses: responses
      };

      this.logOperation('getSessionSurveyData', { sessionId }, result);

      return this.formatSuccessResponse('getSessionSurveyData', result);
    };

    return this.executeWithRetry(operation, 'getSessionSurveyData', 1);
  }

  /**
   * Get survey completion status for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>}
   */
  async getSurveyCompletionStatus(sessionId) {
    this.ensureInitialized();

    const operation = async () => {
      const query = `
        SELECT
          CASE WHEN clarity_pre IS NOT NULL THEN 1 ELSE 0 END as hasPreSurvey,
          CASE WHEN clarity_post IS NOT NULL THEN 1 ELSE 0 END as hasPostSurvey
        FROM surveys
        WHERE session_id = ?
      `;

      const status = await this.db.getFirstAsync(query, [sessionId]);

      const intraCountQuery = `
        SELECT COUNT(*) as count FROM intra_session_responses
        WHERE session_id = ?
      `;
      const intraCount = await this.db.getFirstAsync(intraCountQuery, [sessionId]);

      const result = {
        hasPreSurvey: status?.hasPreSurvey === 1,
        hasPostSurvey: status?.hasPostSurvey === 1,
        intraSessionResponseCount: intraCount?.count || 0
      };

      return this.formatSuccessResponse('getSurveyCompletionStatus', result);
    };

    return this.executeWithRetry(operation, 'getSurveyCompletionStatus', 1);
  }
}

export default new SurveyDatabaseService();