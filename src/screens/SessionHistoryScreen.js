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
import { LineChart } from 'react-native-chart-kit';
import SessionManager from '../services/SessionManager';

const { width: screenWidth } = Dimensions.get('window');

const SessionHistoryScreen = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const allSessions = await SessionManager.getAllSessions();
      

      
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
      const data = await SessionManager.getSessionWithData(sessionId);
      setSessionData(data);
      setSelectedSession(sessionId);
      setModalVisible(true);
    } catch (error) {
      console.error('Failed to load session details:', error);
      Alert.alert('Error', 'Failed to load session data');
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
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
        
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Readings</Text>
          <Text style={styles.statValue}>{item.total_readings || 0}</Text>
        </View>
        
        {item.default_hypoxia_level !== null && item.default_hypoxia_level !== undefined && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Hypoxia Level</Text>
            <Text style={styles.statValue}>{item.default_hypoxia_level}</Text>
          </View>
        )}
        
        {item.avg_spo2 && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg SpO2</Text>
            <Text style={styles.statValue}>{Math.round(item.avg_spo2)}%</Text>
          </View>
        )}
        
        {item.avg_heart_rate && (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Avg HR</Text>
            <Text style={styles.statValue}>{Math.round(item.avg_heart_rate)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const prepareChartData = (readings, field) => {
    if (!readings || readings.length === 0) return null;

    // Sample data points if we have too many (for performance)
    const maxPoints = 50;
    const sampledReadings = readings.length > maxPoints
      ? readings.filter((_, index) => index % Math.ceil(readings.length / maxPoints) === 0)
      : readings;

    const data = sampledReadings
      .filter(reading => reading[field] !== null)
      .map(reading => reading[field]);

    if (data.length === 0) return null;

    return {
      labels: sampledReadings
        .filter(reading => reading[field] !== null)
        .map((_, index) => {
          if (index % Math.ceil(data.length / 6) === 0) {
            const minutes = Math.floor(index * (readings.length / data.length) / 20); // Assuming ~20 readings per minute
            return `${minutes}m`;
          }
          return '';
        }),
      datasets: [{
        data,
        color: (opacity = 1) => field === 'spo2' ? `rgba(33, 150, 243, ${opacity})` : `rgba(244, 67, 54, ${opacity})`,
        strokeWidth: 2
      }]
    };
  };

  const renderSessionModal = () => {
    if (!sessionData) return null;

    const spo2ChartData = prepareChartData(sessionData.readings, 'spo2');
    const hrChartData = prepareChartData(sessionData.readings, 'heart_rate');

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
                  {sessionData.min_spo2}-{sessionData.max_spo2}%
                </Text>
              </View>
              
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>HR Range</Text>
                <Text style={styles.summaryValue}>
                  {sessionData.min_heart_rate}-{sessionData.max_heart_rate} bpm
                </Text>
              </View>
            </View>
          </View>

          {/* SpO2 Chart */}
          {spo2ChartData && (
            <View style={styles.chartContainer}>
              <Text style={styles.sectionTitle}>SpO2 Over Time</Text>
              <LineChart
                data={spo2ChartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: "3",
                    strokeWidth: "1",
                    stroke: "#2196F3"
                  }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

          {/* Heart Rate Chart */}
          {hrChartData && (
            <View style={styles.chartContainer}>
              <Text style={styles.sectionTitle}>Heart Rate Over Time</Text>
              <LineChart
                data={hrChartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  style: {
                    borderRadius: 16
                  },
                  propsForDots: {
                    r: "3",
                    strokeWidth: "1",
                    stroke: "#F44336"
                  }
                }}
                bezier
                style={styles.chart}
              />
            </View>
          )}

        </ScrollView>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </SafeAreaView>
    );
  }

  if (sessions.length === 0) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No Training Sessions</Text>
        <Text style={styles.emptySubtitle}>
          Start your first training session from the dashboard
        </Text>
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
          <RefreshControl refreshing={loading} onRefresh={loadSessions} />
        }
      />
      {renderSessionModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#666666',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  listContainer: {
    padding: 20,
  },
  sessionItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666666',
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  sessionId: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  sessionTimestamp: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  chartContainer: {
    backgroundColor: '#ffffff',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});

export default SessionHistoryScreen; 