import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  Linking,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Container, Card, Button } from '../components/base';
import { H2, Body, BodySmall, Caption } from '../components/base/Typography';
import SafeIcon from '../components/base/SafeIcon';
import { useAppTheme } from '../theme';
import { useAuth } from '../auth/AuthContext';
import OuraService from '../services/integrations/OuraService';
import WhoopService from '../services/integrations/WhoopService';

const IntegrationsScreen = ({ navigation }) => {
  const { colors, spacing, shadows } = useAppTheme();
  const { user } = useAuth();
  const [ouraConnected, setOuraConnected] = useState(false);
  const [whoopConnected, setWhoopConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  // Persist the manual input state so it survives navigation
  const [showManualInput, setShowManualInput] = useState(false);
  // Add Oura manual input state
  const [ouraManualCode, setOuraManualCode] = useState('');
  const [showOuraManualInput, setShowOuraManualInput] = useState(false);

  useEffect(() => {
    checkIntegrations();
    setupDeepLinking();
    // Check if we were in the middle of connecting Whoop or Oura
    checkPendingConnections();
  }, []);

  const checkPendingConnections = async () => {
    try {
      const pendingWhoop = await AsyncStorage.getItem('pendingWhoopConnection');
      const pendingOura = await AsyncStorage.getItem('pendingOuraConnection');
      
      if (pendingWhoop === 'true') {
        setShowManualInput(true);
        console.log('Restored pending Whoop connection state');
      }
      
      if (pendingOura === 'true') {
        setShowOuraManualInput(true);
        console.log('Restored pending Oura connection state');
      }
    } catch (error) {
      console.log('Error checking pending connections:', error);
    }
  };

  const checkIntegrations = async () => {
    if (!user?.id) return;
    
    const [ouraStatus, whoopStatus] = await Promise.all([
      OuraService.hasActiveIntegration(user.id),
      WhoopService.hasActiveIntegration(user.id)
    ]);

    setOuraConnected(ouraStatus);
    setWhoopConnected(whoopStatus);
  };

  const setupDeepLinking = () => {
    // Handle deep links for OAuth callbacks
    const handleUrl = (url) => {
      console.log('🔗 Deep link received:', url.url);
      
      // Check for new URL scheme format: vitalitiair://integrations/whoop or vitalitiair://integrations/oura
      if (url.url.includes('vitalitiair://integrations/oura')) {
        handleOuraCallback(url.url);
      } else if (url.url.includes('vitalitiair://integrations/whoop')) {
        handleWhoopCallback(url.url);
      }
      // Legacy URL format support
      else if (url.url.includes('oura-callback')) {
        handleOuraCallback(url.url);
      } else if (url.url.includes('whoop-callback')) {
        handleWhoopCallback(url.url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    
    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  };

  const handleOuraCallback = async (url) => {
    const code = new URL(url).searchParams.get('code');
    if (code && user?.id) {
      setLoading(true);
      const result = await OuraService.handleCallback(code, user.id);
      setLoading(false);
      
      if (result.success) {
        setOuraConnected(true);
        Alert.alert('Success', 'Oura Ring connected successfully!');
      } else {
        Alert.alert('Error', 'Failed to connect Oura Ring');
      }
    }
  };

  const handleWhoopCallback = async (url) => {
    const code = new URL(url).searchParams.get('code');
    if (code && user?.id) {
      setLoading(true);
      const result = await WhoopService.handleCallback(code, user.id);
      setLoading(false);
      
      if (result.success) {
        setWhoopConnected(true);
        Alert.alert('Success', 'Whoop connected successfully!');
      } else {
        Alert.alert('Error', 'Failed to connect Whoop');
      }
    }
  };

  // Manual code submission for Whoop
  const handleManualWhoopCode = async () => {
    if (!manualCode || !user?.id) {
      Alert.alert('Error', 'Please enter the authorization code');
      return;
    }

    setLoading(true);
    try {
      // Extract just the code if a full URL was pasted
      let code = manualCode;
      if (manualCode.includes('code=')) {
        const urlParams = new URLSearchParams(manualCode.split('?')[1]);
        code = urlParams.get('code');
      }

      const result = await WhoopService.handleCallback(code, user.id);
      
      if (result.success) {
        setWhoopConnected(true);
        setShowManualInput(false);
        setManualCode('');
        // Clear the pending state
        await AsyncStorage.removeItem('pendingWhoopConnection');
        Alert.alert('Success', 'Whoop connected successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to connect Whoop');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process authorization code');
      console.error('Manual Whoop auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual code submission for Oura
  const handleManualOuraCode = async () => {
    if (!ouraManualCode || !user?.id) {
      Alert.alert('Error', 'Please enter the authorization URL');
      return;
    }

    setLoading(true);
    try {
      // Extract just the code if a full URL was pasted
      let code = ouraManualCode;
      if (ouraManualCode.includes('code=')) {
        const urlParams = new URLSearchParams(ouraManualCode.split('?')[1]);
        code = urlParams.get('code');
      }

      const result = await OuraService.handleCallback(code, user.id);
      
      if (result.success) {
        setOuraConnected(true);
        setShowOuraManualInput(false);
        setOuraManualCode('');
        // Clear the pending state
        await AsyncStorage.removeItem('pendingOuraConnection');
        Alert.alert('Success', 'Oura connected successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to connect Oura');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to process authorization code');
      console.error('Manual Oura auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectOura = async () => {
    if (!user?.id) return;
    
    // Check if Oura credentials are configured
    if (!process.env.EXPO_PUBLIC_OURA_CLIENT_ID || !process.env.EXPO_PUBLIC_OURA_CLIENT_SECRET) {
      Alert.alert(
        'Configuration Required', 
        'Oura API credentials are not configured. Please set EXPO_PUBLIC_OURA_CLIENT_ID and EXPO_PUBLIC_OURA_CLIENT_SECRET in your .env file.'
      );
      return;
    }
    
    // Show the manual input field immediately and save state
    setShowOuraManualInput(true);
    await AsyncStorage.setItem('pendingOuraConnection', 'true');
    
    // Then show the instructions and open the browser
    setTimeout(() => {
      Alert.alert(
        'Connect Oura',
        'A text field has appeared below. After authorizing with Oura, copy the FULL URL from the redirect page and paste it in the text field to complete the connection.',
        [
          { text: 'Cancel', style: 'cancel', onPress: async () => {
            setShowOuraManualInput(false);
            setOuraManualCode('');
            await AsyncStorage.removeItem('pendingOuraConnection');
          }},
          {
            text: 'Open Oura Authorization',
            onPress: () => {
              const authUrl = OuraService.getAuthUrl(user.id);
              Linking.openURL(authUrl);
            }
          }
        ]
      );
    }, 100);
  };

  const connectWhoop = async () => {
    if (!user?.id) return;
    
    // Check if Whoop credentials are configured
    if (!process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID || !process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET) {
      Alert.alert(
        'Configuration Required', 
        'Whoop API credentials are not configured. Please set EXPO_PUBLIC_WHOOP_CLIENT_ID and EXPO_PUBLIC_WHOOP_CLIENT_SECRET in your .env file.'
      );
      return;
    }
    
    // Show the manual input field immediately and save state
    setShowManualInput(true);
    await AsyncStorage.setItem('pendingWhoopConnection', 'true');
    
    // Then show the instructions and open the browser
    setTimeout(() => {
      Alert.alert(
        'Connect Whoop',
        'A text field has appeared below. After authorizing with Whoop, you\'ll see a "Not Found" page. Copy the FULL URL from that page and paste it in the text field to complete the connection.',
        [
          { text: 'Cancel', style: 'cancel', onPress: async () => {
            setShowManualInput(false);
            setManualCode('');
            await AsyncStorage.removeItem('pendingWhoopConnection');
          }},
          {
            text: 'Open Whoop Authorization',
            onPress: () => {
              const authUrl = WhoopService.getAuthUrl(user.id);
              Linking.openURL(authUrl);
            }
          }
        ]
      );
    }, 100);
  };

  const disconnectOura = async () => {
    Alert.alert(
      'Disconnect Oura',
      'Are you sure you want to disconnect your Oura Ring?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await OuraService.disconnect(user.id);
            setOuraConnected(false);
            setShowOuraManualInput(false);
            setOuraManualCode('');
            // Clear any pending connection state
            await AsyncStorage.removeItem('pendingOuraConnection');
            setLoading(false);
          }
        }
      ]
    );
  };

  const disconnectWhoop = async () => {
    Alert.alert(
      'Disconnect Whoop',
      'Are you sure you want to disconnect your Whoop?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await WhoopService.disconnect(user.id);
            setWhoopConnected(false);
            setShowManualInput(false);
            setManualCode('');
            // Clear any pending connection state
            await AsyncStorage.removeItem('pendingWhoopConnection');
            setLoading(false);
          }
        }
      ]
    );
  };

  const syncOuraData = async () => {
    setLoading(true);
    try {
      const result = await OuraService.syncAllData(user.id, 14); // Sync last 14 days for stability
      
      if (result.success) {
        Alert.alert(
          '✅ Oura Sync Complete', 
          `Successfully synced ${result.data.totalRecords} records:\n\n` +
          `• Sleep: ${result.data.sleep}\n` +
          `• Activity: ${result.data.activity}\n` +
          `• Readiness: ${result.data.readiness}\n` +
          `• Heart Rate: ${result.data.heartRate}\n` +
          `• Workouts: ${result.data.workouts}\n` +
          `• SpO2: ${result.data.spo2}\n` +
          `• Sessions: ${result.data.sessions}\n` +
          `• Tags: ${result.data.tags}`
        );
      } else {
        Alert.alert('Sync Failed', result.error || 'Failed to sync Oura data');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while syncing Oura data');
      console.error('Oura sync error:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncWhoopData = async () => {
    setLoading(true);
    try {
      console.log('📱 Starting Whoop sync...');
      console.log('📱 User object:', user);
      console.log('📱 User ID:', user?.id);
      
      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated. Please login again.');
        return;
      }
      
      const result = await WhoopService.syncAllData(user.id, 500); // Sync last 500 days to ensure we get all historical data from July 10
      
      if (result.success) {
        Alert.alert(
          '✅ Whoop Sync Complete', 
          `Successfully synced ${result.data.totalRecords} records:\n\n` +
          `• Recovery: ${result.data.recovery}\n` +
          `• Sleep: ${result.data.sleep}\n` +
          `• Workouts: ${result.data.workouts}\n` +
          `• Cycles: ${result.data.cycles}\n` +
          `• Strain: ${result.data.strain}\n` +
          `• Physiological: ${result.data.physiological}\n` +
          `• Profile: ${result.data.profile}`
        );
      } else {
        Alert.alert('Sync Failed', result.error || 'Failed to sync Whoop data');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while syncing Whoop data');
      console.error('Whoop sync error:', error);
    } finally {
      setLoading(false);
    }
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
    content: {
      paddingHorizontal: spacing.screenPadding,
    },
    integrationCard: {
      marginBottom: spacing.md,
      padding: spacing.lg,
    },
    integrationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    integrationInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    integrationLogo: {
      width: 40,
      height: 40,
      marginRight: spacing.md,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    connectedBadge: {
      backgroundColor: colors.success[100],
    },
    disconnectedBadge: {
      backgroundColor: colors.text.secondary + '20',
    },
    statusText: {
      marginLeft: spacing.xs,
    },
    description: {
      marginBottom: spacing.lg,
      color: colors.text.secondary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    button: {
      flex: 1,
    },
    note: {
      padding: spacing.lg,
      backgroundColor: colors.info[50],
      borderRadius: 8,
      marginTop: spacing.lg,
    },
    noteText: {
      color: colors.info[700],
    },
    manualInput: {
      marginTop: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.surface.background,
      borderRadius: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: 8,
      padding: spacing.sm,
      marginBottom: spacing.sm,
      color: colors.text.primary,
      fontSize: 12,
    }
  });

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <Container safe scroll backgroundColor={colors.surface.background}>
        {/* Header */}
        <View style={styles.header}>
        <View style={styles.headerContent}>
          <SafeIcon name="link" size="lg" color={colors.primary[500]} />
          <H2 style={styles.title}>Integrations</H2>
        </View>
      </View>

      <View style={styles.content}>
        {/* Oura Integration */}
        <Card style={styles.integrationCard}>
          <View style={styles.integrationHeader}>
            <View style={styles.integrationInfo}>
              <SafeIcon name="ring" size="lg" color={colors.primary[500]} />
              <View>
                <Body weight="semibold">Oura Ring</Body>
                <Caption>Sleep & Recovery Tracking</Caption>
              </View>
            </View>
            <View style={[
              styles.statusBadge, 
              ouraConnected ? styles.connectedBadge : styles.disconnectedBadge
            ]}>
              <SafeIcon 
                name={ouraConnected ? "check-circle" : "x-circle"} 
                size="xs" 
                color={ouraConnected ? colors.success[600] : colors.text.secondary}
              />
              <Caption style={styles.statusText}>
                {ouraConnected ? 'Connected' : 'Not Connected'}
              </Caption>
            </View>
          </View>

          <BodySmall style={styles.description}>
            Connect your Oura Ring to sync sleep quality, HRV, body temperature, 
            and recovery data with your Vitaliti training sessions.
          </BodySmall>

          <View style={styles.buttonRow}>
            {ouraConnected ? (
              <>
                <Button
                  title="Sync Data"
                  variant="outline"
                  size="small"
                  onPress={syncOuraData}
                  disabled={loading}
                  style={styles.button}
                />
                <Button
                  title="Disconnect"
                  variant="outline"
                  size="small"
                  onPress={disconnectOura}
                  disabled={loading}
                  style={styles.button}
                  color="error"
                />
              </>
            ) : (
              <Button
                title="Connect Oura"
                variant="primary"
                size="small"
                onPress={connectOura}
                disabled={loading}
                style={styles.button}
              />
            )}
          </View>

          {/* Manual code input for Oura Expo Go limitation */}
          {!ouraConnected && showOuraManualInput && (
            <View style={styles.manualInput}>
              <Caption style={{ marginBottom: spacing.xs, fontWeight: 'bold' }}>
                Step 2: Complete Connection
              </Caption>
              <Caption style={{ marginBottom: spacing.sm, color: colors.text.secondary }}>
                After authorizing, copy the ENTIRE URL from the redirect page
              </Caption>
              <TextInput
                style={styles.input}
                placeholder="https://cloud.ouraring.com/..."
                placeholderTextColor={colors.text.tertiary}
                value={ouraManualCode}
                onChangeText={setOuraManualCode}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={true}
                numberOfLines={3}
              />
              <View style={styles.buttonRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  size="small"
                  onPress={async () => {
                    setShowOuraManualInput(false);
                    setOuraManualCode('');
                    // Clear the pending state
                    await AsyncStorage.removeItem('pendingOuraConnection');
                  }}
                  style={styles.button}
                />
                <Button
                  title="Complete Connection"
                  variant="primary"
                  size="small"
                  onPress={handleManualOuraCode}
                  disabled={loading || !ouraManualCode}
                  style={styles.button}
                />
              </View>
            </View>
          )}
        </Card>

        {/* Whoop Integration */}
        <Card style={styles.integrationCard}>
          <View style={styles.integrationHeader}>
            <View style={styles.integrationInfo}>
              <SafeIcon name="activity" size="lg" color={colors.primary[500]} />
              <View>
                <Body weight="semibold">Whoop</Body>
                <Caption>Performance & Strain Tracking</Caption>
              </View>
            </View>
            <View style={[
              styles.statusBadge, 
              whoopConnected ? styles.connectedBadge : styles.disconnectedBadge
            ]}>
              <SafeIcon 
                name={whoopConnected ? "check-circle" : "x-circle"} 
                size="xs" 
                color={whoopConnected ? colors.success[600] : colors.text.secondary}
              />
              <Caption style={styles.statusText}>
                {whoopConnected ? 'Connected' : 'Not Connected'}
              </Caption>
            </View>
          </View>

          {/* Manual code input for Expo Go limitation */}
          {!whoopConnected && showManualInput && (
            <View style={styles.manualInput}>
              <Caption style={{ marginBottom: spacing.xs, fontWeight: 'bold' }}>
                Step 2: Complete Connection
              </Caption>
              <Caption style={{ marginBottom: spacing.sm, color: colors.text.secondary }}>
                After authorizing, copy the ENTIRE URL from the error page (it starts with "http://localhost")
              </Caption>
              <TextInput
                style={styles.input}
                placeholder="http://localhost:19006/whoop-callback?code=..."
                placeholderTextColor={colors.text.tertiary}
                value={manualCode}
                onChangeText={setManualCode}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={true}
                numberOfLines={3}
              />
              <View style={styles.buttonRow}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  size="small"
                  onPress={async () => {
                    setShowManualInput(false);
                    setManualCode('');
                    // Clear the pending state
                    await AsyncStorage.removeItem('pendingWhoopConnection');
                  }}
                  style={styles.button}
                />
                <Button
                  title="Complete Connection"
                  variant="primary"
                  size="small"
                  onPress={handleManualWhoopCode}
                  disabled={loading || !manualCode}
                  style={styles.button}
                />
              </View>
            </View>
          )}

          <BodySmall style={styles.description}>
            Connect your Whoop to sync strain, recovery, sleep performance, 
            and HRV data with your Vitaliti training sessions.
          </BodySmall>

          <View style={styles.buttonRow}>
            {whoopConnected ? (
              <>
                <Button
                  title="Sync Data"
                  variant="outline"
                  size="small"
                  onPress={syncWhoopData}
                  disabled={loading}
                  style={styles.button}
                />
                <Button
                  title="Disconnect"
                  variant="outline"
                  size="small"
                  onPress={disconnectWhoop}
                  disabled={loading}
                  style={styles.button}
                  color="error"
                />
              </>
            ) : (
              <Button
                title="Connect Whoop"
                variant="primary"
                size="small"
                onPress={connectWhoop}
                disabled={loading}
                style={styles.button}
              />
            )}
          </View>
        </Card>

        {/* Note */}
        <View style={styles.note}>
          <BodySmall style={styles.noteText}>
            Note: Your health data is encrypted and stored securely. 
            We only access the data you explicitly authorize and never 
            share it with third parties.
          </BodySmall>
        </View>
      </View>
    </Container>
    </KeyboardAvoidingView>
  );
};

export default IntegrationsScreen;