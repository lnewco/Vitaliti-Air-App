import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import WearablesDataService from '../services/WearablesDataService';
import WearablesMetricsCard from '../components/WearablesMetricsCard';
import SpO2Display from '../components/SpO2Display';
import { Container } from '../components/base';
import { Card } from '../components/base';
import { H2, Body, BodySmall, Caption } from '../components/base/Typography';
import SafeIcon from '../components/base/SafeIcon';
import { useAppTheme } from '../theme';
import { useAuth } from '../auth/AuthContext';

const DashboardScreen = ({ navigation }) => {
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());
  const [wearableMetrics, setWearableMetrics] = useState(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [availableVendors, setAvailableVendors] = useState([]);
  const { colors, spacing, shadows } = useAppTheme();
  const { user } = useAuth();

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch wearable metrics
  useEffect(() => {
    if (user?.id) {
      loadWearableMetrics();
      checkAvailableVendors();

      // Refresh metrics every minute
      const metricsInterval = setInterval(() => {
        loadWearableMetrics();
      }, 60000);

      return () => clearInterval(metricsInterval);
    }
  }, [user, selectedVendor]);

  const loadWearableMetrics = async () => {
    try {
      setIsLoadingMetrics(true);
      const metrics = await WearablesDataService.getLatestMetrics(user?.id, selectedVendor);
      setWearableMetrics(metrics);
      
      if (metrics && !selectedVendor) {
        setSelectedVendor(metrics.vendor);
      }
    } catch (error) {
      console.error('Error loading wearable metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const checkAvailableVendors = async () => {
    try {
      const vendors = await WearablesDataService.getAvailableWearables(user?.id);
      setAvailableVendors(vendors);
      
      if (vendors.length > 0 && !selectedVendor) {
        const preferred = await WearablesDataService.getPreferredWearable(user?.id);
        setSelectedVendor(preferred || vendors[0]);
      }
    } catch (error) {
      console.error('Error checking available vendors:', error);
    }
  };

  const handleVendorToggle = async () => {
    if (availableVendors.length <= 1) return;
    
    const currentIndex = availableVendors.indexOf(selectedVendor);
    const nextIndex = (currentIndex + 1) % availableVendors.length;
    const nextVendor = availableVendors[nextIndex];
    
    setSelectedVendor(nextVendor);
    await WearablesDataService.setPreferredWearable(nextVendor);
  };

  const navigateToSessionSetup = () => {
    navigation.navigate('SessionSetup');
  };

  const styles = StyleSheet.create({
    header: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.screenPadding,
      backgroundColor: colors.surface.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      marginBottom: spacing.lg,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      marginLeft: spacing.sm,
    },
    metricsSection: {
      paddingHorizontal: spacing.screenPadding,
      marginBottom: spacing.lg,
    },
    sessionCards: {
      paddingHorizontal: spacing.screenPadding,
    },
    sessionCard: {
      marginBottom: spacing.md,
    },
    trainingCard: {
      borderColor: colors.primary[500],
      borderWidth: 2,
    },
    bottomSpacer: {
      height: spacing.lg,
    },
  });

  return (
    <Container safe scroll backgroundColor={colors.surface.background}>
      {/* Compact Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <SafeIcon name="lungs" size="lg" color={colors.primary[500]} />
          <H2 style={styles.title}>DANYAL'S BRANCH</H2>
        </View>
      </View>

      {/* Wearables Metrics Card */}
      {(availableVendors.length > 0 || isLoadingMetrics) && (
        <View style={styles.metricsSection}>
          <WearablesMetricsCard
            metrics={wearableMetrics}
            isLoading={isLoadingMetrics}
            vendor={selectedVendor}
            onVendorToggle={handleVendorToggle}
            availableVendors={availableVendors}
          />
        </View>
      )}

      {/* SPO2 Display */}
      <View style={styles.metricsSection}>
        <SpO2Display />
      </View>

      {/* Session Cards */}
      <View style={styles.sessionCards}>
        {/* Training Session Card */}
        <TouchableOpacity 
          onPress={navigateToSessionSetup}
          activeOpacity={0.8}
        >
          <Card style={[styles.sessionCard, styles.trainingCard]}>
            <Card.Header
              icon={<SafeIcon name="training" size="lg" color={colors.primary[500]} />}
              title="Training Session"
              subtitle="Start your IHHT training"
            />
            <Card.Body noPadding>
              <BodySmall color="secondary" numberOfLines={2}>
                Begin customized hypoxic-hyperoxic cycles for optimal performance
              </BodySmall>
            </Card.Body>
            <Card.Footer>
              <Caption color="tertiary">30-60 minutes</Caption>
              <SafeIcon name="chevron-right" size="sm" color={colors.text.tertiary} />
            </Card.Footer>
          </Card>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacer} />
    </Container>
  );
};

export default DashboardScreen;