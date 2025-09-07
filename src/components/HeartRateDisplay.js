import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useBluetooth } from '../context/BluetoothContext';
import HRV_CONFIG from '../config/hrvConfig';

// Helper function to get confidence color
const getConfidenceColor = (confidence) => {
  if (confidence >= 0.9) return HRV_CONFIG.UI.CONFIDENCE_COLORS.EXCELLENT;
  if (confidence >= 0.8) return HRV_CONFIG.UI.CONFIDENCE_COLORS.HIGH;
  if (confidence >= 0.6) return HRV_CONFIG.UI.CONFIDENCE_COLORS.MEDIUM;
  return HRV_CONFIG.UI.CONFIDENCE_COLORS.LOW;
};

const HeartRateDisplay = ({ size = 'large' }) => {
  const { 
    isPulseOxConnected, 
    isHRConnected, 
    pulseOximeterData, 
    heartRateData 
  } = useBluetooth();

  // Determine which HR data to display (prefer HR monitor if connected)
  const getHeartRateData = () => {
    if (isHRConnected && heartRateData?.heartRate) {
      return {
        heartRate: heartRateData.heartRate,
        source: 'HR Monitor',
        hasHRV: !!(heartRateData.quickHRV || heartRateData.realHRV || heartRateData.hrv),
        hrv: heartRateData.hrv, // Legacy field
        quickHRV: heartRateData.quickHRV,
        realHRV: heartRateData.realHRV,
        sessionDuration: heartRateData.sessionDuration,
        sensorContact: heartRateData.sensorContactDetected,
        isEnhanced: true
      };
    } else if (isPulseOxConnected && pulseOximeterData?.heartRate) {
      return {
        heartRate: pulseOximeterData.heartRate,
        source: 'Pulse Oximeter',
        hasHRV: false,
        hrv: null,
        sensorContact: pulseOximeterData.isFingerDetected,
        isEnhanced: false
      };
    }
    return null;
  };

  const hrData = getHeartRateData();

  if (!hrData || !hrData.heartRate) {
    return (
      <View style={[styles.container, styles[`${size}Container`]]}>
        <Text style={[styles.heartRate, styles[`${size}HeartRate`]]}>--</Text>
        <Text style={[styles.unit, styles[`${size}Unit`]]}>BPM</Text>
        <Text style={[styles.source, styles[`${size}Source`]]}>No Signal</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles[`${size}Container`]]}>
      <View style={styles.heartRateContainer}>
        <Text style={[styles.heartRate, styles[`${size}HeartRate`]]}>
          {hrData.heartRate}
        </Text>
        <Text style={[styles.unit, styles[`${size}Unit`]]}>BPM</Text>
      </View>
      
      <View style={styles.sourceContainer}>
        <Text style={[styles.source, styles[`${size}Source`]]}>
          {hrData.source}
          {hrData.isEnhanced && ' ⚡'}
        </Text>
        {hrData.sensorContact !== undefined && (
          <Text style={[styles.contactStatus, styles[`${size}ContactStatus`]]}>
            {hrData.sensorContact ? '✅' : '❌'}
          </Text>
        )}
      </View>

      {/* Dual-Timeframe HRV Display */}
      {hrData.isEnhanced && size === 'large' && (
        <View style={styles.hrvContainer}>
          <Text style={styles.hrvTitle}>Heart Rate Variability</Text>
          
          {/* Quick HRV */}
          {hrData.quickHRV && (
            <View style={styles.hrvMetricContainer}>
              <View style={styles.hrvHeader}>
                <Text style={styles.hrvTypeLabel}>
                  {HRV_CONFIG.UI.STAGE_ICONS.QUICK} Quick HRV
                </Text>
                <View style={[
                  styles.confidenceBadge, 
                  { backgroundColor: getConfidenceColor(hrData.quickHRV.confidence) }
                ]}>
                  <Text style={styles.confidenceText}>
                    {Math.round(hrData.quickHRV.confidence * 100)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.hrvMainValue}>{hrData.quickHRV.rmssd}ms</Text>
              <Text style={styles.hrvSubtext}>
                {hrData.quickHRV.stage.description} • {hrData.quickHRV.intervalCount} intervals
              </Text>
            </View>
          )}
          
          {/* Real HRV */}
          {hrData.realHRV && (
            <View style={styles.hrvMetricContainer}>
              <View style={styles.hrvHeader}>
                <Text style={styles.hrvTypeLabel}>
                  {HRV_CONFIG.UI.STAGE_ICONS.REAL} Real HRV
                </Text>
                <View style={[
                  styles.confidenceBadge, 
                  { backgroundColor: getConfidenceColor(hrData.realHRV.confidence) }
                ]}>
                  <Text style={styles.confidenceText}>
                    {Math.round(hrData.realHRV.confidence * 100)}%
                  </Text>
                </View>
              </View>
              <Text style={styles.hrvMainValue}>{hrData.realHRV.rmssd}ms</Text>
              <Text style={styles.hrvSubtext}>
                {hrData.realHRV.stage.description} • {hrData.realHRV.intervalCount} intervals
              </Text>
            </View>
          )}
          
          {/* Session Duration */}
          {hrData.sessionDuration && (
            <Text style={styles.sessionInfo}>
              Session: {Math.round(hrData.sessionDuration / 1000)}s
            </Text>
          )}
        </View>
      )}

      {/* Compact HRV for small size - Show best available */}
      {hrData.isEnhanced && size === 'small' && (
        <View style={styles.compactHrvContainer}>
          {hrData.realHRV ? (
            <Text style={styles.compactHrvText}>
              {HRV_CONFIG.UI.STAGE_ICONS.REAL} HRV: {hrData.realHRV.rmssd}ms
            </Text>
          ) : hrData.quickHRV ? (
            <Text style={styles.compactHrvText}>
              {HRV_CONFIG.UI.STAGE_ICONS.QUICK} HRV: {hrData.quickHRV.rmssd}ms
            </Text>
          ) : (
            <Text style={styles.compactHrvText}>
              {HRV_CONFIG.UI.STAGE_ICONS.QUICK} HRV: --
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 200,
  },
  mediumContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 150,
  },
  smallContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    minWidth: 100,
  },
  heartRateContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  heartRate: {
    fontWeight: 'bold',
    color: '#DC2626',
  },
  largeHeartRate: {
    fontSize: 48,
  },
  mediumHeartRate: {
    fontSize: 32,
  },
  smallHeartRate: {
    fontSize: 24,
  },
  unit: {
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 8,
  },
  largeUnit: {
    fontSize: 16,
  },
  mediumUnit: {
    fontSize: 14,
  },
  smallUnit: {
    fontSize: 12,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  source: {
    fontWeight: '500',
    color: '#374151',
  },
  largeSource: {
    fontSize: 14,
  },
  mediumSource: {
    fontSize: 12,
  },
  smallSource: {
    fontSize: 10,
  },
  contactStatus: {
    marginLeft: 8,
  },
  largeContactStatus: {
    fontSize: 14,
  },
  mediumContactStatus: {
    fontSize: 12,
  },
  smallContactStatus: {
    fontSize: 10,
  },
  // Dual-Timeframe HRV Styles
  hrvContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    width: '100%',
  },
  hrvTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  hrvMetricContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  hrvHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hrvTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 44,
    alignItems: 'center',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  hrvMainValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  hrvSubtext: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  sessionInfo: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  compactHrvContainer: {
    marginTop: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  compactHrvText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default HeartRateDisplay; 