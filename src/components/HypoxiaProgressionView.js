import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import DatabaseService from '../services/DatabaseService';

const HypoxiaProgressionView = () => {
  const [progressionData, setProgressionData] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHypoxiaData();
  }, []);

  const loadHypoxiaData = async () => {
    try {
      setLoading(true);
      const [progression, hypoxiaStats] = await Promise.all([
        DatabaseService.getHypoxiaProgression(20),
        DatabaseService.getHypoxiaStats()
      ]);
      
      setProgressionData(progression);
      setStats(hypoxiaStats);
      console.log('📈 Loaded hypoxia progression data:', { progression: progression.length, stats: hypoxiaStats });
    } catch (error) {
      console.error('❌ Failed to load hypoxia data:', error);
      Alert.alert('Error', 'Failed to load hypoxia progression data');
    } finally {
      setLoading(false);
    }
  };

  const getHypoxiaColor = (level) => {
    if (level === 0) return '#4CAF50'; // Green for room air
    if (level <= 3) return '#8BC34A'; // Light green
    if (level <= 6) return '#FFC107'; // Yellow/orange
    if (level <= 8) return '#FF9800'; // Orange
    return '#F44336'; // Red for high hypoxia
  };

  const getProgressionTrend = () => {
    if (progressionData.length < 2) return 'No trend data';
    
    const recent = progressionData.slice(-5); // Last 5 sessions
    const older = progressionData.slice(-10, -5); // 5 sessions before that
    
    if (recent.length === 0 || older.length === 0) return 'Insufficient data';
    
    const recentAvg = recent.reduce((sum, s) => sum + s.hypoxiaLevel, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.hypoxiaLevel, 0) / older.length;
    
    if (recentAvg > olderAvg + 0.5) return '📈 Increasing intensity';
    if (recentAvg < olderAvg - 0.5) return '📉 Decreasing intensity';
    return '➡️ Stable training';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading hypoxia progression...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.title}>🌬️ Hypoxia Training Progress</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalSessions}</Text>
            <Text style={styles.statLabel}>Total Sessions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.avgHypoxiaLevel}</Text>
            <Text style={styles.statLabel}>Avg Level</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.maxHypoxiaLevel}</Text>
            <Text style={styles.statLabel}>Max Level</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.completedSessions}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.trendContainer}>
          <Text style={styles.trendText}>{getProgressionTrend()}</Text>
        </View>
      </View>

      {/* Session History */}
      <View style={styles.historyContainer}>
        <Text style={styles.historyTitle}>Recent Sessions</Text>
        
        {progressionData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hypoxia sessions recorded yet</Text>
            <Text style={styles.emptySubtext}>Start training to see your progression!</Text>
          </View>
        ) : (
          progressionData.map((session, index) => (
            <View key={session.id} style={styles.sessionItem}>
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionDate}>{session.date}</Text>
                <View style={[
                  styles.hypoxiaIndicator,
                  { backgroundColor: getHypoxiaColor(session.hypoxiaLevel) }
                ]}>
                  <Text style={styles.hypoxiaLevel}>{session.hypoxiaLevel}</Text>
                </View>
              </View>
              
              <View style={styles.sessionDetails}>
                <Text style={styles.sessionStat}>
                  📊 {session.totalReadings} readings
                </Text>
                {session.avgSpO2 && (
                  <Text style={styles.sessionStat}>
                    🩸 SpO2: {Math.round(session.avgSpO2)}%
                  </Text>
                )}
                {session.avgHeartRate && (
                  <Text style={styles.sessionStat}>
                    💓 HR: {Math.round(session.avgHeartRate)} bpm
                  </Text>
                )}
                <Text style={[
                  styles.sessionStatus,
                  { color: session.status === 'completed' ? '#4CAF50' : '#FF9800' }
                ]}>
                  {session.status === 'completed' ? '✅ Completed' : '⏳ ' + session.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.refreshButton} onPress={loadHypoxiaData}>
        <Text style={styles.refreshButtonText}>🔄 Refresh Data</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  trendContainer: {
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  historyContainer: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  sessionItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  hypoxiaIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hypoxiaLevel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  sessionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sessionStat: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sessionStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HypoxiaProgressionView; 