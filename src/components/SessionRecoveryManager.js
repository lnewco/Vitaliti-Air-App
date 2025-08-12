/**
 * SessionRecoveryManager - Handles session recovery with navigation
 */

import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import SessionRecoveryModal from './SessionRecoveryModal';
import EnhancedSessionManager from '../services/EnhancedSessionManager';

const SessionRecoveryManager = () => {
  const navigation = useNavigation();
  const [recoveryData, setRecoveryData] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Check for recoverable session on mount
  useEffect(() => {
    checkForRecoverableSession();
  }, []);

  const checkForRecoverableSession = async () => {
    try {
      const recovery = await EnhancedSessionManager.getRecoverableSession();
      if (recovery) {
        console.log('🔄 Found recoverable session:', recovery);
        setRecoveryData(recovery);
        setShowRecoveryModal(true);
      }
    } catch (error) {
      console.error('❌ Error checking for recoverable session:', error);
    }
  };

  const handleResumeSession = async () => {
    if (!recoveryData) return;

    try {
      setIsRecovering(true);
      console.log('🔄 User chose to resume session');
      
      await EnhancedSessionManager.resumeSession(recoveryData);
      
      setShowRecoveryModal(false);
      setRecoveryData(null);
      
      // Navigate to the session screen
      console.log('🔄 Navigating to session screen after recovery');
      navigation.navigate('AirSession');
      
      console.log('✅ Session resumed and navigated successfully');
      
    } catch (error) {
      console.error('❌ Failed to resume session:', error);
      setShowRecoveryModal(false);
      setRecoveryData(null);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleDeclineRecovery = async () => {
    try {
      console.log('🗑️ User declined session recovery');
      
      await EnhancedSessionManager.declineSessionRecovery();
      
      setShowRecoveryModal(false);
      setRecoveryData(null);
      
    } catch (error) {
      console.error('❌ Error declining session recovery:', error);
    }
  };

  return (
    <SessionRecoveryModal
      visible={showRecoveryModal}
      recoveryData={recoveryData}
      onResume={handleResumeSession}
      onDecline={handleDeclineRecovery}
      isLoading={isRecovering}
    />
  );
};

export default SessionRecoveryManager;
