import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  Dimensions,
  SafeAreaView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import DatabaseService from '../services/DatabaseService';
import { useAuth } from '../auth/AuthContext';
import { useAppTheme } from '../theme';

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 60; // Account for container padding

const SessionHistoryScreen = ({ route, navigation }) => {
  const { user } = useAuth();
  const { colors, theme } = useAppTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  // Refresh sessions when screen comes into focus (e.g., after ending a session)
  useFocusEffect(
    React.useCallback(() => {
      loadSessions();
    }, [])
  );

  // Check if we should auto-show a session modal (from post-session survey)
  useEffect(() => {
    const showSessionId = route?.params?.showSessionId;
    
    if (showSessionId) {
      
              if (sessions.length > 0) {
          // Find the session in our loaded sessions (by ID or local_session_id)
          const targetSession = sessions.find(session => 
            session.id === showSessionId || 
            session.local_session_id === showSessionId
          );
          if (targetSession) {
            loadSessionDetails(targetSession.id); // Use the actual session ID, not the search ID
            // Clear the navigation param to prevent re-triggering
            navigation.setParams({ showSessionId: null });
          } else {
            // Wait a bit longer for sessions to sync, then try direct lookup
            setTimeout(() => {
              loadSessionDetails(showSessionId);
            }, 1000);
            // Clear the navigation param to prevent re-triggering
            navigation.setParams({ showSessionId: null });
          }
        } else if (!loading) {
          // Sessions list is empty but we're not loading, try direct lookup
          loadSessionDetails(showSessionId);
          // Clear the navigation param to prevent re-triggering
          navigation.setParams({ showSessionId: null });
        }
        // If still loading, wait for next effect cycle
    }
  }, [sessions, route?.params?.showSessionId, loading]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      
      // Initialize database if not already initialized
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }
      
      // Get sessions from local database
      const localSessions = await DatabaseService.getAllSessions();
      
      // Get sessions from Supabase as backup/supplement
      let supabaseSessions = [];
      try {
        const SupabaseService = require('../services/SupabaseService').default;
        await SupabaseService.initialize();
        
        // Get recent sessions from Supabase (last 24 hours)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        // Import supabase client directly
        const supabase = require('../config/supabase').default;
        
        const { data: supabaseData, error } = await supabase
          .from('sessions')
          .select('*')
          .gte('start_time', yesterday.toISOString())
          .order('start_time', { ascending: false })
          .limit(20);
          
        if (supabaseData && !error) {
          // Convert Supabase format to match local format
          supabaseSessions = supabaseData.map(session => ({
            ...session,
            start_time: new Date(session.start_time).getTime(),
            end_time: session.end_time ? new Date(session.end_time).getTime() : null,
            total_readings: session.total_readings || 0,
            avg_spo2: session.avg_spo2,
            avg_heart_rate: session.avg_heart_rate
          }));
        }
      } catch (supabaseError) {
        console.warn('⚠️ Could not load Supabase sessions:', supabaseError.message);
      }
      
      // Merge and deduplicate sessions (local takes priority for conflicts)
      const sessionMap = new Map();
      
      // Add local sessions first (priority)
      localSessions.forEach(session => {
        sessionMap.set(session.id, { ...session, source: 'local' });
      });
      
      // Add Supabase sessions that aren't already in local
      supabaseSessions.forEach(session => {
        if (!sessionMap.has(session.id)) {
          sessionMap.set(session.id, { ...session, source: 'supabase' });
        }
      });
      
      const allSessions = Array.from(sessionMap.values())
        .sort((a, b) => b.start_time - a.start_time); // Sort by newest first
      
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      Alert.alert('Error', 'Failed to load session history');
    } finally {
      setLoading(false);
    }
  };


  const loadSessionDetails = async (sessionId) => {
    try {
      // Show modal immediately with loading state
      setSelectedSession(sessionId);
      setSessionData(null); // Clear previous data
      setModalVisible(true);
      
      // Initialize database if not already initialized
      if (!DatabaseService.db) {
        await DatabaseService.init();
      }
      
      // Try to get data from local database first
      let sessionData = await DatabaseService.getSessionWithData(sessionId);
      
      // Check if we have complete data
      const hasLocalData = sessionData !== null;
      const hasReadings = sessionData?.readings?.length > 0;
      const hasStats = sessionData?.total_readings > 0 || 
                       sessionData?.stats?.totalReadings > 0;
      
      // If local data is incomplete, try to supplement with Supabase
      if (!hasLocalData || !hasReadings || !hasStats) {
        try {
          const SupabaseService = require('../services/SupabaseService').default;
          const { supabase } = require('../config/supabase');
          
          // Ensure SupabaseService is initialized
          await SupabaseService.initialize();
          
          // Get session from Supabase using direct client
          const supabaseSessionData = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
          
                    if (supabaseSessionData.data) {
            // Try to get readings using both the Supabase ID and local session ID
            const possibleSessionIds = [
              sessionId, // Current session ID (might be Supabase UUID)
              supabaseSessionData.data.local_session_id // Original local session ID
            ].filter(Boolean);
            
            let supabaseReadings = null;
            for (const trySessionId of possibleSessionIds) {
              const readingsResult = await supabase
                .from('readings')
                .select('*')
                .eq('session_id', trySessionId)
                .eq('is_valid', true)
                .order('timestamp', { ascending: true });
              
              if (readingsResult.data && readingsResult.data.length > 0) {
                supabaseReadings = readingsResult;
                break;
              }
            }
            
            // Format Supabase data to match local format
            const session = supabaseSessionData.data;
            const rawReadings = supabaseReadings.data || [];
            
            // Convert timestamps from ISO strings to milliseconds
            const readings = rawReadings.map(r => ({
              ...r,
              timestamp: typeof r.timestamp === 'string' 
                ? new Date(r.timestamp).getTime()
                : r.timestamp
            }));
            
            // Calculate stats from readings
            const validSpo2Readings = readings.filter(r => r.spo2 && r.spo2 > 0).map(r => r.spo2);
            const validHRReadings = readings.filter(r => r.heart_rate && r.heart_rate > 0).map(r => r.heart_rate);
            
            // Ensure local readings also have proper timestamp format
            const localReadings = sessionData?.readings?.map(r => ({
              ...r,
              timestamp: typeof r.timestamp === 'string' 
                ? new Date(r.timestamp).getTime()
                : r.timestamp
            })) || [];
            
            // Merge local and Supabase data, preferring whichever has more complete information
            const mergedReadings = readings.length > localReadings.length ? 
                                   readings : (localReadings.length > 0 ? localReadings : readings);
            
            // Use Supabase stats if they're more complete
            const useSupabaseStats = session.total_readings > (sessionData?.total_readings || 0);
            
            sessionData = {
              id: session.id,
              start_time: session.start_time ? new Date(session.start_time).getTime() : null,
              end_time: session.end_time ? new Date(session.end_time).getTime() : null,
              status: session.status || sessionData?.status || 'unknown',
              total_readings: Math.max(
                session.total_readings || 0,
                sessionData?.total_readings || 0,
                mergedReadings.length || 0
              ),
              readings: mergedReadings,
              // Use stored stats if available, otherwise calculate from readings
              min_spo2: useSupabaseStats && session.min_spo2 ? session.min_spo2 : 
                       (validSpo2Readings.length > 0 ? Math.min(...validSpo2Readings) : 
                        sessionData?.min_spo2 || null),
              max_spo2: useSupabaseStats && session.max_spo2 ? session.max_spo2 : 
                       (validSpo2Readings.length > 0 ? Math.max(...validSpo2Readings) : 
                        sessionData?.max_spo2 || null),
              avg_spo2: useSupabaseStats && session.avg_spo2 ? session.avg_spo2 :
                       (validSpo2Readings.length > 0 ? 
                        validSpo2Readings.reduce((a, b) => a + b, 0) / validSpo2Readings.length :
                        sessionData?.avg_spo2 || null),
              min_heart_rate: useSupabaseStats && session.min_heart_rate ? session.min_heart_rate :
                             (validHRReadings.length > 0 ? Math.min(...validHRReadings) : 
                              sessionData?.min_heart_rate || null),
              max_heart_rate: useSupabaseStats && session.max_heart_rate ? session.max_heart_rate :
                             (validHRReadings.length > 0 ? Math.max(...validHRReadings) : 
                              sessionData?.max_heart_rate || null),
              avg_heart_rate: useSupabaseStats && session.avg_heart_rate ? session.avg_heart_rate :
                             (validHRReadings.length > 0 ? 
                              validHRReadings.reduce((a, b) => a + b, 0) / validHRReadings.length :
                              sessionData?.avg_heart_rate || null),
              source: readings.length > 0 ? 'merged' : 'supabase'
            };
          }
        } catch (supabaseError) {
          console.warn('⚠️ Failed to load from Supabase:', supabaseError.message);
        }
      }
      
      if (sessionData) {
        // Ensure all readings have proper timestamps before setting data
        if (sessionData.readings && Array.isArray(sessionData.readings)) {
          sessionData.readings = sessionData.readings.map(r => ({
            ...r,
            timestamp: typeof r.timestamp === 'string' 
              ? new Date(r.timestamp).getTime()
              : r.timestamp
          }));
          
          // Debug: Log phase data availability
          console.log('Debug - Session data loaded:', {
            sessionId: sessionData.id,
            totalReadings: sessionData.readings.length,
            firstReading: sessionData.readings[0] ? {
              timestamp: sessionData.readings[0].timestamp,
              phase_type: sessionData.readings[0].phase_type,
              cycle_number: sessionData.readings[0].cycle_number
            } : null,
            hasPhaseData: sessionData.readings.some(r => r.phase_type),
            phaseTypes: [...new Set(sessionData.readings.map(r => r.phase_type).filter(Boolean))]
          });
        }
        setSessionData(sessionData); // Update modal with data
      } else {
        setModalVisible(false); // Hide modal on error
        Alert.alert('Error', 'Session data not found');
      }
    } catch (error) {
      console.error('Failed to load session details:', error);
      Alert.alert('Error', 'Failed to load session details');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown Date';
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp for date formatting:', timestamp);
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'In Progress';
    
    const duration = endTime - startTime;
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'active': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const renderSessionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.sessionItem}
      onPress={() => loadSessionDetails(item.id)}
    >
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionDate}>
          {formatDate(item.start_time)}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      
      <View style={styles.sessionStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Duration</Text>
          <Text style={styles.statValue}>
            {formatDuration(item.start_time, item.end_time)}
          </Text>
        </View>
        
        {item.default_hypoxia_level !== null && item.default_hypoxia_level !== undefined && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Hypoxia Level</Text>
            <Text style={styles.statValue}>{item.default_hypoxia_level}</Text>
          </View>
        )}
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg SpO2</Text>
          <Text style={styles.statValue}>
            {item.avg_spo2 ? `${Math.round(item.avg_spo2)}%` : '-'}
          </Text>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg HR</Text>
          <Text style={styles.statValue}>
            {item.avg_heart_rate ? Math.round(item.avg_heart_rate) : '-'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Helper function to format time labels based on elapsed time
  const formatTimeLabel = (elapsedMs, totalDurationMs) => {
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    // Format based on total duration
    if (totalDurationMs < 60000) { // Less than 1 minute - show seconds
      return `${seconds}s`;
    } else if (totalDurationMs < 3600000) { // Less than 1 hour - show mm:ss
      const displayMinutes = minutes;
      const displaySeconds = seconds % 60;
      if (displayMinutes === 0) {
        return `${displaySeconds}s`;
      }
      return `${displayMinutes}:${displaySeconds.toString().padStart(2, '0')}`;
    } else { // 1 hour or more - show hh:mm
      const displayHours = hours;
      const displayMinutes = minutes % 60;
      return `${displayHours}:${displayMinutes.toString().padStart(2, '0')}`;
    }
  };

  // Helper function to sample readings based on time intervals
  const sampleReadingsByTime = (readings, targetPoints) => {
    if (readings.length <= targetPoints) return readings;
    
    const firstTime = readings[0].timestamp;
    const lastTime = readings[readings.length - 1].timestamp;
    const timeRange = lastTime - firstTime;
    const timeStep = timeRange / (targetPoints - 1);
    
    const sampled = [readings[0]]; // Always include first reading
    let targetTime = firstTime + timeStep;
    let lastIndex = 0;
    
    for (let i = 1; i < targetPoints - 1; i++) {
      // Find reading closest to target time
      let closestIndex = lastIndex;
      let closestDiff = Math.abs(readings[lastIndex].timestamp - targetTime);
      
      for (let j = lastIndex + 1; j < readings.length; j++) {
        const diff = Math.abs(readings[j].timestamp - targetTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = j;
        } else {
          break; // Readings are sorted, so we've passed the closest point
        }
      }
      
      sampled.push(readings[closestIndex]);
      lastIndex = closestIndex;
      targetTime += timeStep;
    }
    
    sampled.push(readings[readings.length - 1]); // Always include last reading
    
    // Debug: Check if phase data is preserved in sampling
    console.log('Debug - Sampled readings phase check:', {
      originalCount: readings.length,
      sampledCount: sampled.length,
      firstPhase: sampled[0]?.phase_type,
      lastPhase: sampled[sampled.length - 1]?.phase_type,
      hasPhaseData: sampled.some(r => r.phase_type !== null && r.phase_type !== undefined)
    });
    
    return sampled;
  };

  // Helper function to calculate phase zones for background visualization
  const calculatePhaseZones = (readings) => {
    if (!readings || readings.length === 0) return [];
    
    // Debug: Check what fields are available
    if (readings.length > 0) {
      console.log('Debug - First reading fields:', Object.keys(readings[0]));
      console.log('Debug - Sample reading data:', {
        reading1: {
          phase_type: readings[0].phase_type,
          phaseType: readings[0].phaseType,
          cycle_number: readings[0].cycle_number,
          cycleNumber: readings[0].cycleNumber,
          timestamp: readings[0].timestamp
        },
        reading10: readings[9] ? {
          phase_type: readings[9].phase_type,
          phaseType: readings[9].phaseType,
          cycle_number: readings[9].cycle_number,
          cycleNumber: readings[9].cycleNumber,
          timestamp: readings[9].timestamp
        } : null,
        totalReadings: readings.length
      });
    }
    
    const zones = [];
    let currentPhase = null;
    let currentCycle = null;
    let zoneStart = 0;
    
    readings.forEach((reading, index) => {
      // Check both snake_case and camelCase versions
      const phase = reading.phase_type || reading.phaseType;
      const cycle = reading.cycle_number || reading.cycleNumber;
      
      // Skip readings without phase data or with COMPLETED phase
      if (!phase || phase === 'COMPLETED') {
        if (!phase) {
          console.log(`Debug - Reading ${index} has no phase data:`, {
            phase_type: reading.phase_type,
            phaseType: reading.phaseType,
            timestamp: reading.timestamp
          });
        }
        return; // Skip this reading
      }
      
      // Check if phase changed
      if (phase !== currentPhase || cycle !== currentCycle) {
        if (currentPhase !== null && index > 0) {
          // End current zone
          zones.push({
            phase: currentPhase,
            cycle: currentCycle,
            startIndex: zoneStart,
            endIndex: index - 1,
            startPercent: (zoneStart / readings.length) * 100,
            widthPercent: ((index - zoneStart) / readings.length) * 100
          });
        }
        // Start new zone
        currentPhase = phase;
        currentCycle = cycle;
        zoneStart = index;
      }
    });
    
    // Add final zone
    if (currentPhase !== null) {
      zones.push({
        phase: currentPhase,
        cycle: currentCycle,
        startIndex: zoneStart,
        endIndex: readings.length - 1,
        startPercent: (zoneStart / readings.length) * 100,
        widthPercent: ((readings.length - zoneStart) / readings.length) * 100
      });
    }
    
    console.log('Debug - Phase zones calculated:', zones);
    return zones;
  };

  const prepareChartData = (readings, field, startTime) => {
    if (!readings || readings.length === 0) return null;

    // Ensure readings have timestamps and are sorted
    const validReadings = readings
      .filter(r => r[field] !== null && r[field] !== undefined && r.timestamp)
      .sort((a, b) => {
        const timeA = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp;
        const timeB = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp;
        return timeA - timeB;
      });

    if (validReadings.length === 0) return null;

    // Sample data points for performance
    const maxPoints = Math.min(30, validReadings.length);
    const sampledReadings = sampleReadingsByTime(validReadings, maxPoints);

    // Calculate reference time
    const firstTimestamp = sampledReadings[0].timestamp;
    const lastTimestamp = sampledReadings[sampledReadings.length - 1].timestamp;
    const sessionDuration = lastTimestamp - firstTimestamp;
    const referenceTime = startTime ? 
      (typeof startTime === 'string' ? new Date(startTime).getTime() : startTime) : 
      firstTimestamp;

    // Generate labels
    const labelCount = 5;
    const labelInterval = Math.max(1, Math.floor(sampledReadings.length / labelCount));
    const labels = sampledReadings.map((reading, index) => {
      if (index === 0 || index === sampledReadings.length - 1 || 
          (index > 0 && index % labelInterval === 0)) {
        const elapsedMs = reading.timestamp - referenceTime;
        return formatTimeLabel(elapsedMs, sessionDuration);
      }
      return '';
    });

    // Extract data values and phase data
    const data = sampledReadings.map(reading => reading[field]);
    const phaseData = sampledReadings.map(reading => {
      const phase = reading.phase_type || reading.phaseType;
      return phase; // Return the raw phase value for each data point
    });
    
    // Debug: Log phase data
    const phaseGroups = [];
    let currentPhase = null;
    let currentGroup = null;
    
    phaseData.forEach((phase, index) => {
      if (phase !== currentPhase) {
        if (currentGroup) {
          phaseGroups.push(currentGroup);
        }
        currentPhase = phase;
        currentGroup = {
          phase: phase,
          startIndex: index,
          endIndex: index,
          count: 1
        };
      } else if (currentGroup) {
        currentGroup.endIndex = index;
        currentGroup.count++;
      }
    });
    if (currentGroup) {
      phaseGroups.push(currentGroup);
    }
    
    console.log('Phase data for chart:', {
      field: field,
      totalReadings: sampledReadings.length,
      phaseGroups: phaseGroups,
      uniquePhases: [...new Set(phaseData.filter(p => p))],
      hasPhaseData: phaseData.some(p => p && p !== 'COMPLETED')
    });

    return {
      labels,
      datasets: [{
        data,
        color: (opacity = 1) => field === 'spo2' ? `rgba(33, 150, 243, ${opacity})` : `rgba(244, 67, 54, ${opacity})`,
        strokeWidth: 2
      }],
      phaseData // Include phase data for dot coloring
    };
  };


  const renderSessionModal = () => {
    const spo2ChartData = sessionData ? prepareChartData(sessionData.readings, 'spo2', sessionData.start_time) : null;
    const hrChartData = sessionData ? prepareChartData(sessionData.readings, 'heart_rate', sessionData.start_time) : null;
    const hrvChartData = sessionData ? prepareChartData(sessionData.readings, 'hrv_rmssd', sessionData.start_time) : null;

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <ScrollView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Session Details</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Session Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.sectionTitle}>Session Summary</Text>
            
            {sessionData ? (
              <>
                <Text style={styles.sessionId}>ID: {sessionData.id}</Text>
                <Text style={styles.sessionTimestamp}>
                  {formatDate(sessionData.start_time)}
                </Text>
                
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Duration</Text>
                    <Text style={styles.summaryValue}>
                      {formatDuration(sessionData.start_time, sessionData.end_time)}
                    </Text>
                  </View>
                  
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Readings</Text>
                    <Text style={styles.summaryValue}>{sessionData.total_readings}</Text>
                  </View>
                  
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>SpO2 Range</Text>
                    <Text style={styles.summaryValue}>
                      {sessionData.min_spo2 && sessionData.max_spo2 
                        ? `${Math.round(sessionData.min_spo2)}-${Math.round(sessionData.max_spo2)}%` 
                        : 'No data'
                      }
                    </Text>
                  </View>
                  
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>HR Range</Text>
                    <Text style={styles.summaryValue}>
                      {sessionData.min_heart_rate && sessionData.max_heart_rate 
                        ? `${Math.round(sessionData.min_heart_rate)}-${Math.round(sessionData.max_heart_rate)} bpm`
                        : 'No data'
                      }
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading session data...</Text>
              </View>
            )}
          </View>

          {/* Charts with phase-colored dots */}
          {spo2ChartData && (
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>SpO2 Over Time</Text>
              <LineChart
                data={spo2ChartData}
                width={CHART_WIDTH}
                height={220}
                chartConfig={{
                  backgroundColor: colors.surface.card,
                  backgroundGradientFrom: colors.surface.card,
                  backgroundGradientTo: colors.surface.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                  labelColor: (opacity = 1) => theme === 'dark' ? `rgba(200, 200, 200, ${opacity})` : `rgba(102, 102, 102, ${opacity})`,
                  style: {
                    borderRadius: 8
                  },
                  propsForLabels: {
                    fontSize: 10
                  }
                }}
                getDotColor={(dataPoint, dataPointIndex) => {
                  // Get the phase for this data point
                  const phase = spo2ChartData.phaseData?.[dataPointIndex];
                  if (phase === 'HYPOXIC') return '#FF9800'; // Orange
                  if (phase === 'HYPEROXIC') return '#4CAF50'; // Green
                  return '#999999'; // Gray for no phase/completed
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 8
                }}
                withInnerLines={true}
                withOuterLines={true}
                withVerticalLines={false}
                withHorizontalLines={true}
                withDots={true}
                dotSize={4}
                segments={4}
                formatYLabel={(value) => `${value}%`}
              />
              {/* Phase legend */}
              <View style={styles.phaseLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning[500] }]} />
                  <Text style={styles.legendText}>Hypoxic</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success[500] }]} />
                  <Text style={styles.legendText}>Hyperoxic</Text>
                </View>
              </View>
            </View>
          )}

          {hrChartData && (
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>Heart Rate Over Time</Text>
              <LineChart
                data={hrChartData}
                width={CHART_WIDTH}
                height={220}
                chartConfig={{
                  backgroundColor: colors.surface.card,
                  backgroundGradientFrom: colors.surface.card,
                  backgroundGradientTo: colors.surface.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
                  labelColor: (opacity = 1) => theme === 'dark' ? `rgba(200, 200, 200, ${opacity})` : `rgba(102, 102, 102, ${opacity})`,
                  style: {
                    borderRadius: 8
                  },
                  propsForLabels: {
                    fontSize: 10
                  }
                }}
                getDotColor={(dataPoint, dataPointIndex) => {
                  // Get the phase for this data point
                  const phase = hrChartData.phaseData?.[dataPointIndex];
                  if (phase === 'HYPOXIC') return '#FF9800'; // Orange
                  if (phase === 'HYPEROXIC') return '#4CAF50'; // Green
                  return '#999999'; // Gray for no phase/completed
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 8
                }}
                withInnerLines={true}
                withOuterLines={true}
                withVerticalLines={false}
                withHorizontalLines={true}
                withDots={true}
                dotSize={4}
                segments={4}
                formatYLabel={(value) => `${value}`}
              />
              {/* Phase legend */}
              <View style={styles.phaseLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning[500] }]} />
                  <Text style={styles.legendText}>Hypoxic</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success[500] }]} />
                  <Text style={styles.legendText}>Hyperoxic</Text>
                </View>
              </View>
            </View>
          )}

          {hrvChartData && (
            <View style={styles.chartSection}>
              <Text style={styles.chartTitle}>Heart Rate Variability Over Time</Text>
              <LineChart
                data={hrvChartData}
                width={CHART_WIDTH}
                height={220}
                chartConfig={{
                  backgroundColor: colors.surface.card,
                  backgroundGradientFrom: colors.surface.card,
                  backgroundGradientTo: colors.surface.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => theme === 'dark' ? `rgba(200, 200, 200, ${opacity})` : `rgba(102, 102, 102, ${opacity})`,
                  style: {
                    borderRadius: 8
                  },
                  propsForLabels: {
                    fontSize: 10
                  }
                }}
                getDotColor={(dataPoint, dataPointIndex) => {
                  // Get the phase for this data point
                  const phase = hrvChartData.phaseData?.[dataPointIndex];
                  if (phase === 'HYPOXIC') return '#FF9800'; // Orange
                  if (phase === 'HYPEROXIC') return '#4CAF50'; // Green
                  return '#999999'; // Gray for no phase/completed
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 8
                }}
                withInnerLines={true}
                withOuterLines={true}
                withVerticalLines={false}
                withHorizontalLines={true}
                withDots={true}
                dotSize={4}
                segments={4}
                formatYLabel={(value) => `${value}ms`}
              />
              {/* Baseline reference if available */}
              {sessionData?.baseline_hrv_rmssd && (
                <View style={styles.baselineReference}>
                  <Text style={styles.baselineText}>
                    Baseline HRV: {Math.round(sessionData.baseline_hrv_rmssd)}ms
                  </Text>
                </View>
              )}
              {/* Phase legend */}
              <View style={styles.phaseLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.warning[500] }]} />
                  <Text style={styles.legendText}>Hypoxic</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success[500] }]} />
                  <Text style={styles.legendText}>Hyperoxic</Text>
                </View>
              </View>
            </View>
          )}

        </ScrollView>
      </Modal>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface.background,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.surface.card,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      marginHorizontal: 4,
    },
    activeTab: {
      backgroundColor: colors.primary[500],
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.secondary,
    },
    activeTabText: {
      color: colors.white,
    },
    listContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    sessionCard: {
      backgroundColor: colors.surface.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
      shadowColor: theme === 'dark' ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'dark' ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    sessionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
      flex: 1,
    },
    sessionDate: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 2,
    },
    sessionDuration: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginLeft: 8,
    },
    statusCompleted: {
      backgroundColor: colors.success[100],
    },
    statusCompletedText: {
      color: colors.success[700],
      fontSize: 11,
      fontWeight: '600',
    },
    statusIncomplete: {
      backgroundColor: colors.warning[100],
    },
    statusIncompleteText: {
      color: colors.warning[700],
      fontSize: 11,
      fontWeight: '600',
    },
    metricsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    metricItem: {
      alignItems: 'center',
    },
    metricValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: 2,
    },
    metricLabel: {
      fontSize: 11,
      color: colors.text.secondary,
      textTransform: 'uppercase',
    },
    chartContainer: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    chartTitle: {
      fontSize: 12,
      color: colors.text.secondary,
      marginBottom: 8,
      textAlign: 'center',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface.background,
    },
    emptyContainer: {
      flex: 1,
      backgroundColor: colors.surface.background,
    },
    emptyContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
      marginTop: 8,
      paddingHorizontal: 40,
    },
    loadingText: {
      fontSize: 16,
      color: colors.text.secondary,
      marginTop: 10,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.surface.card,
      borderRadius: 16,
      maxWidth: 400,
      width: '100%',
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    closeButton: {
      padding: 4,
    },
    closeButtonText: {
      fontSize: 24,
      color: colors.text.secondary,
    },
    modalBody: {
      padding: 20,
    },
    detailSection: {
      marginBottom: 24,
    },
    detailSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    detailLabel: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text.primary,
    },
    chartSection: {
      marginTop: 8,
    },
    syncIndicator: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    syncedDot: {
      backgroundColor: colors.success[500],
    },
    unsyncedDot: {
      backgroundColor: colors.warning[500],
    },
    // Session list item styles
    sessionItem: {
      backgroundColor: colors.surface.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border.light,
      shadowColor: theme === 'dark' ? '#000' : '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'dark' ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sessionStats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    statItem: {
      width: '33.33%',
      paddingVertical: 8,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 11,
      color: colors.text.secondary,
      textTransform: 'uppercase',
      marginBottom: 4,
      letterSpacing: 0.5,
    },
    statValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.white,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // Chart legend styles
    phaseLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 12,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 6,
    },
    legendText: {
      fontSize: 12,
      color: colors.text.secondary,
    },
    baselineReference: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      alignItems: 'center',
    },
    baselineText: {
      fontSize: 12,
      color: colors.text.secondary,
      fontStyle: 'italic',
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </SafeAreaView>
    );
  }

  if (sessions.length === 0 && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>
            No Training Sessions
          </Text>
          <Text style={styles.emptySubtitle}>
            Start your first training session from the dashboard
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={sessions}
        renderItem={renderSessionItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={loadSessions} 
          />
        }
      />
      {renderSessionModal()}
    </SafeAreaView>
  );
};

export default SessionHistoryScreen;
