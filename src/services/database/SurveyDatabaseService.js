/**
 * SurveyDatabaseService - Handles all survey-related database operations
 * Extracted from DatabaseService for better modularity
 */

import log from '../../utils/logger';

class SurveyDatabaseService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Save pre-session survey data
   */
  async savePreSessionSurvey(sessionId, clarityPre, energyPre, stressPre) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarityPre) || !this.isValidSurveyScale(energyPre) || !this.isValidSurveyScale(stressPre)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      log.info(`Saving pre-session survey for: ${sessionId}`);
      
      // Use INSERT OR IGNORE followed by UPDATE to preserve existing data
      const insertQuery = `
        INSERT OR IGNORE INTO session_surveys (session_id, clarity_pre, energy_pre, stress_pre, updated_at)
        VALUES (?, ?, ?, ?, strftime('%s', 'now'))
      `;
      
      const updateQuery = `
        UPDATE session_surveys 
        SET clarity_pre = ?, energy_pre = ?, stress_pre = ?, updated_at = strftime('%s', 'now')
        WHERE session_id = ?
      `;
      
      await this.db.runAsync(insertQuery, [sessionId, clarityPre, energyPre, stressPre]);
      await this.db.runAsync(updateQuery, [clarityPre, energyPre, stressPre, sessionId]);
      
      log.info(`Pre-session survey saved: clarity=${clarityPre}, energy=${energyPre}, stress=${stressPre}`);
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save pre-session survey:', error);
      throw error;
    }
  }

  /**
   * Save post-session survey data (enhanced with symptoms and rating)
   */
  async savePostSessionSurvey(sessionId, clarityPost, energyPost, stressPost, notesPost = null, symptoms = [], overallRating = null) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarityPost) || !this.isValidSurveyScale(energyPost) || !this.isValidSurveyScale(stressPost)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      if (overallRating && !this.isValidSurveyScale(overallRating)) {
        throw new Error('Overall rating must be an integer between 1 and 5');
      }

      log.info(`Saving post-session survey for: ${sessionId}`);
      
      // Convert symptoms array to JSON string for SQLite
      const symptomsJson = JSON.stringify(symptoms || []);
      
      // Use INSERT OR IGNORE followed by UPDATE to preserve existing data
      const insertQuery = `
        INSERT OR IGNORE INTO session_surveys 
        (session_id, clarity_post, energy_post, stress_post, notes_post, post_symptoms, overall_rating, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      `;
      
      const updateQuery = `
        UPDATE session_surveys 
        SET clarity_post = ?, energy_post = ?, stress_post = ?, 
            notes_post = ?, post_symptoms = ?, overall_rating = ?, 
            updated_at = strftime('%s', 'now')
        WHERE session_id = ?
      `;
      
      await this.db.runAsync(insertQuery, [sessionId, clarityPost, energyPost, stressPost, notesPost, symptomsJson, overallRating]);
      await this.db.runAsync(updateQuery, [clarityPost, energyPost, stressPost, notesPost, symptomsJson, overallRating, sessionId]);
      
      log.info(`Post-session survey saved: clarity=${clarityPost}, energy=${energyPost}, stress=${stressPost}, rating=${overallRating}`);
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save post-session survey:', error);
      throw error;
    }
  }

  /**
   * Save intra-session response (enhanced with sensations and physiological data)
   */
  async saveIntraSessionResponse(sessionId, phaseNumber, clarity, energy, stressPerception, timestamp, sensations = [], spo2 = null, heartRate = null) {
    try {
      // Validate input
      if (!this.isValidSurveyScale(clarity) || !this.isValidSurveyScale(energy) || !this.isValidSurveyScale(stressPerception)) {
        throw new Error('Survey values must be integers between 1 and 5');
      }

      log.info(`Saving intra-session response for: ${sessionId}, phase: ${phaseNumber}`);
      
      // Convert sensations array to JSON string for SQLite
      const sensationsJson = JSON.stringify(sensations || []);
      
      const query = `
        INSERT OR REPLACE INTO intra_session_responses 
        (session_id, phase_number, clarity, energy, stress, stress_perception, 
         sensations, spo2_value, hr_value, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.db.runAsync(query, [
        sessionId, phaseNumber, clarity, energy, 
        stressPerception, stressPerception, // Using stress_perception for both old 'stress' and new field
        sensationsJson, spo2, heartRate, timestamp
      ]);
      
      log.info(`Intra-session response saved: phase=${phaseNumber}, clarity=${clarity}, energy=${energy}, stress=${stressPerception}`);
      
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to save intra-session response:', error);
      throw error;
    }
  }

  /**
   * Get complete survey data for a session
   */
  async getSessionSurveyData(sessionId) {
    try {
      log.info(`Fetching survey data for session: ${sessionId}`);
      
      // Get main survey data
      const surveyRow = await this.db.getFirstAsync(
        'SELECT * FROM session_surveys WHERE session_id = ?',
        [sessionId]
      );
      
      // Get intra-session responses
      const responsesResult = await this.db.getAllAsync(
        'SELECT * FROM intra_session_responses WHERE session_id = ? ORDER BY phase_number ASC',
        [sessionId]
      );
      
      const surveyData = {
        sessionId,
        preSession: null,
        postSession: null,
        intraSessionResponses: []
      };
      
      // Process main survey data
      if (surveyRow) {
        if (surveyRow.clarity_pre !== null && surveyRow.energy_pre !== null) {
          surveyData.preSession = {
            clarity: surveyRow.clarity_pre,
            energy: surveyRow.energy_pre,
            stress: surveyRow.stress_pre
          };
        }
        
        if (surveyRow.clarity_post !== null && surveyRow.energy_post !== null && surveyRow.stress_post !== null) {
          surveyData.postSession = {
            clarity: surveyRow.clarity_post,
            energy: surveyRow.energy_post,
            stress: surveyRow.stress_post,
            notes: surveyRow.notes_post || undefined,
            symptoms: surveyRow.post_symptoms ? JSON.parse(surveyRow.post_symptoms) : [],
            overallRating: surveyRow.overall_rating || undefined
          };
        }
      }
      
      // Process intra-session responses
      for (const row of responsesResult) {
        surveyData.intraSessionResponses.push({
          clarity: row.clarity,
          energy: row.energy,
          stress: row.stress,
          stressPerception: row.stress_perception,
          phaseNumber: row.phase_number,
          timestamp: row.timestamp,
          sensations: row.sensations ? JSON.parse(row.sensations) : [],
          spo2: row.spo2_value,
          heartRate: row.hr_value
        });
      }
      
      log.info(`Survey data retrieved for ${sessionId}:`, {
        hasPreSession: !!surveyData.preSession,
        hasPostSession: !!surveyData.postSession,
        intraResponseCount: surveyData.intraSessionResponses.length
      });
      
      return surveyData;
    } catch (error) {
      log.error('❌ Failed to get survey data:', error);
      throw error;
    }
  }

  /**
   * Get survey completion status for a session
   */
  async getSurveyCompletionStatus(sessionId) {
    try {
      const row = await this.db.getFirstAsync(
        'SELECT clarity_pre, energy_pre, stress_pre, clarity_post, energy_post, stress_post FROM session_surveys WHERE session_id = ?',
        [sessionId]
      );
      
      if (!row) {
        return {
          hasPreSession: false,
          hasPostSession: false,
          isPreSessionComplete: false,
          isPostSessionComplete: false
        };
      }
      
      const hasPreSession = row.clarity_pre !== null && row.energy_pre !== null && row.stress_pre !== null;
      const hasPostSession = row.clarity_post !== null && row.energy_post !== null && row.stress_post !== null;
      
      return {
        hasPreSession,
        hasPostSession,
        isPreSessionComplete: hasPreSession,
        isPostSessionComplete: hasPostSession
      };
    } catch (error) {
      log.error('❌ Failed to check survey completion status:', error);
      throw error;
    }
  }

  /**
   * Validate survey scale value (1-5)
   */
  isValidSurveyScale(value) {
    return Number.isInteger(value) && value >= 1 && value <= 5;
  }

  /**
   * Delete all survey data for a session
   */
  async deleteSurveyData(sessionId) {
    try {
      log.info(`Deleting survey data for session: ${sessionId}`);
      
      await this.db.runAsync('DELETE FROM session_surveys WHERE session_id = ?', [sessionId]);
      await this.db.runAsync('DELETE FROM intra_session_responses WHERE session_id = ?', [sessionId]);
      
      log.info(`Survey data deleted for session: ${sessionId}`);
      return { success: true };
    } catch (error) {
      log.error('❌ Failed to delete survey data:', error);
      throw error;
    }
  }
}

export default SurveyDatabaseService;