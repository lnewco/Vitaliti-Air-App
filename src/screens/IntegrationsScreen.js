import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert
} from 'react-native';
import { Container, Card, Button } from '../components/base';
import { H2, Body, BodySmall, Caption } from '../components/base/Typography';
import SafeIcon from '../components/base/SafeIcon';
import { useAppTheme } from '../theme';
import { useAuth } from '../auth/AuthContext';
import IntegrationManager from '../services/integrations/IntegrationManager';

const IntegrationsScreen = ({ navigation }) => {
  const { colors, spacing, shadows } = useAppTheme();
  const { user } = useAuth();
  const [ouraConnected, setOuraConnected] = useState(false);
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState({ oura: null, whoop: null });

  useEffect(() => {
    if (user?.id) {
      initializeAndCheckStatus();
    }
  }, [user?.id]);

  const initializeAndCheckStatus = async () => {
    try {
      // Initialize integration manager
      await IntegrationManager.initialize(user.id);
      
      // Check current status
      await refreshIntegrationStatus();
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  const refreshIntegrationStatus = async () => {
    if (!user?.id) return;
    
    try {
      const statuses = await IntegrationManager.getIntegrationStatuses(user.id);
      setOuraConnected(statuses.oura.connected);
      setWhoopConnected(statuses.whoop.connected);
      setLastSync({
        oura: statuses.oura.lastSync,
        whoop: statuses.whoop.lastSync
      });
    } catch (error) {
      console.error('Status check error:', error);
    }
  };

  const connectOura = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      setLoading(true);
      const result = await IntegrationManager.startOuraAuth(user.id);
      
      if (result.success) {
        Alert.alert(
          'Opening Oura Authorization',
          'You will be redirected to Oura to authorize access. After authorization, you will be automatically returned to the app.',
          [{ text: 'OK' }]
        );
        // Refresh status after a few seconds to catch the callback
        setTimeout(refreshIntegrationStatus, 3000);
      } else {
        Alert.alert('Error', result.error || 'Failed to start Oura connection');
      }
    } catch (error) {
      console.error('Oura connection error:', error);
      Alert.alert('Error', 'Failed to connect to Oura');
    } finally {
      setLoading(false);
    }
  };

  const connectWhoop = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in first');
      return;
    }

    try {
      setLoading(true);
      const result = await IntegrationManager.startWhoopAuth(user.id);
      
      if (result.success) {
        Alert.alert('Success', result.message || 'Whoop connected successfully!');
        await refreshIntegrationStatus();
      } else {
        Alert.alert('Error', result.error || 'Failed to connect to Whoop');
      }
    } catch (error) {
      console.error('Whoop connection error:', error);
      Alert.alert('Error', 'Failed to connect to Whoop');
    } finally {
      setLoading(false);
    }
  };

  const disconnectOura = async () => {
    if (!user?.id) return;
    
    Alert.alert(
      'Disconnect Oura',
      'Are you sure you want to disconnect your Oura Ring?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: async () => {
          try {
            setLoading(true);
            const result = await IntegrationManager.disconnectIntegration(user.id, 'oura');
            if (result.success) {
              setOuraConnected(false);
              setLastSync(prev => ({ ...prev, oura: null }));
              Alert.alert('Success', 'Oura Ring disconnected');
            } else {
              Alert.alert('Error', result.error || 'Failed to disconnect Oura');
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to disconnect Oura Ring');
          } finally {
            setLoading(false);
          }
        }}
      ]
    );
  };

  const disconnectWhoop = async () => {
    if (!user?.id) return;
    
    Alert.alert(
      'Disconnect Whoop',
      'Are you sure you want to disconnect your Whoop device?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: async () => {
          try {
            setLoading(true);
            const result = await IntegrationManager.disconnectIntegration(user.id, 'whoop');
            if (result.success) {
              setWhoopConnected(false);
              setLastSync(prev => ({ ...prev, whoop: null }));
              Alert.alert('Success', 'Whoop disconnected');
            } else {
              Alert.alert('Error', result.error || 'Failed to disconnect Whoop');
            }
          } catch (error) {
            Alert.alert('Error', 'Failed to disconnect Whoop');
          } finally {
            setLoading(false);
          }
        }}
      ]
    );
  };

  const syncData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const result = await IntegrationManager.syncAllIntegrations(user.id);
      
      if (result.success) {
        const { summary } = result;
        const message = `Sync completed successfully!\n\nOura: ${summary.ouraRecords} records\nWhoop: ${summary.whoopRecords} records\nTotal: ${summary.totalRecords} records`;
        Alert.alert('Sync Complete', message);
        await refreshIntegrationStatus(); // Update last sync times
      } else {
        Alert.alert('Sync Failed', result.error || 'Unable to sync data');
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync data');
    } finally {
      setLoading(false);
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    content: {
      paddingHorizontal: spacing.lg,
    },
    integrationCard: {
      marginBottom: spacing.md,
    },
    integrationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    integrationInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    integrationIcon: {
      marginRight: spacing.sm,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: spacing.sm,
    },
    connectedDot: {
      backgroundColor: colors.success[500],
    },
    disconnectedDot: {
      backgroundColor: colors.neutral[400],
    },
    integrationDetails: {
      marginTop: spacing.sm,
    },
    lastSyncText: {
      color: colors.text.secondary,
      fontSize: 12,
      marginTop: spacing.xs,
    },
    actionButton: {
      marginTop: spacing.sm,
    },
    syncSection: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.neutral[200],
    },
    syncDescription: {
      textAlign: 'center',
      marginBottom: spacing.md,
      color: colors.text.secondary,
    },
  });

  return (
    <Container safe backgroundColor={colors.surface.background}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <H2>Integrations</H2>
          <Caption color="secondary" style={{ marginTop: spacing.xs }}>
            Connect your wearable devices to sync health data automatically
          </Caption>
        </View>

        <View style={styles.content}>
          {/* Oura Ring Integration */}
          <Card style={styles.integrationCard}>
            <Card.Body>
              <View style={styles.integrationHeader}>
                <View style={styles.integrationInfo}>
                  <SafeIcon 
                    name="radio" 
                    size="md" 
                    color={ouraConnected ? colors.success[500] : colors.neutral[400]}
                    style={styles.integrationIcon} 
                  />
                  <Body weight="semibold">Oura Ring</Body>
                  <View style={[
                    styles.statusDot, 
                    ouraConnected ? styles.connectedDot : styles.disconnectedDot
                  ]} />
                </View>
              </View>
              
              <View style={styles.integrationDetails}>
                <BodySmall color="secondary">
                  {ouraConnected ? 
                    'Connected - Syncing sleep, activity, and readiness data' :
                    'Connect your Oura Ring to track sleep quality, recovery, and daily activity'
                  }
                </BodySmall>
                
                {ouraConnected && (
                  <Caption style={styles.lastSyncText}>
                    Last sync: {formatLastSync(lastSync.oura)}
                  </Caption>
                )}
              </View>
              
              <View style={styles.actionButton}>
                {ouraConnected ? (
                  <Button 
                    title="Disconnect"
                    variant="secondary"
                    size="sm"
                    onPress={disconnectOura}
                    loading={loading}
                    disabled={loading}
                  />
                ) : (
                  <Button 
                    title="Connect Oura Ring"
                    variant="primary"
                    size="sm"
                    onPress={connectOura}
                    loading={loading}
                    disabled={loading}
                  />
                )}
              </View>
            </Card.Body>
          </Card>

          {/* Whoop Integration */}
          <Card style={styles.integrationCard}>
            <Card.Body>
              <View style={styles.integrationHeader}>
                <View style={styles.integrationInfo}>
                  <SafeIcon 
                    name="activity" 
                    size="md" 
                    color={whoopConnected ? colors.success[500] : colors.neutral[400]}
                    style={styles.integrationIcon} 
                  />
                  <Body weight="semibold">Whoop</Body>
                  <View style={[
                    styles.statusDot, 
                    whoopConnected ? styles.connectedDot : styles.disconnectedDot
                  ]} />
                </View>
              </View>
              
              <View style={styles.integrationDetails}>
                <BodySmall color="secondary">
                  {whoopConnected ? 
                    'Connected - Syncing recovery, strain, and sleep data' :
                    'Connect your Whoop device to track recovery, strain, and detailed sleep metrics'
                  }
                </BodySmall>
                
                {whoopConnected && (
                  <Caption style={styles.lastSyncText}>
                    Last sync: {formatLastSync(lastSync.whoop)}
                  </Caption>
                )}
              </View>
              
              <View style={styles.actionButton}>
                {whoopConnected ? (
                  <Button 
                    title="Disconnect"
                    variant="secondary"
                    size="sm"
                    onPress={disconnectWhoop}
                    loading={loading}
                    disabled={loading}
                  />
                ) : (
                  <Button 
                    title="Connect Whoop"
                    variant="primary"
                    size="sm"
                    onPress={connectWhoop}
                    loading={loading}
                    disabled={loading}
                  />
                )}
              </View>
            </Card.Body>
          </Card>

          {/* Manual Sync Section */}
          {(ouraConnected || whoopConnected) && (
            <View style={styles.syncSection}>
              <Body weight="semibold" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
                Data Synchronization
              </Body>
              <BodySmall style={styles.syncDescription}>
                Data syncs automatically every 6 hours. You can also manually sync your latest data.
              </BodySmall>
              <Button 
                title="Sync Now"
                variant="secondary"
                onPress={syncData}
                loading={loading}
                disabled={loading}
              />
            </View>
          )}

          {/* Information Section */}
          <Card style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
            <Card.Body>
              <Body weight="semibold" style={{ marginBottom: spacing.sm }}>
                How It Works
              </Body>
              <BodySmall color="secondary" style={{ lineHeight: 18 }}>
                • Connect your devices using secure OAuth authentication{'\n'}
                • Data syncs automatically in the background{'\n'}
                • View your metrics in the Vitaliti Air analytics dashboard{'\n'}
                • All data is encrypted and stored securely
              </BodySmall>
            </Card.Body>
          </Card>
        </View>
      </ScrollView>
    </Container>
  );
};

export default IntegrationsScreen;