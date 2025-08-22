import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import EnhancedSessionManager from '../services/EnhancedSessionManager';
import { Container } from '../components/base';
import { Card } from '../components/base';
import { H2, Body, BodySmall, Caption } from '../components/base/Typography';
import SafeIcon from '../components/base/SafeIcon';
import { useAppTheme } from '../theme';

const DashboardScreen = ({ navigation }) => {
  const [sessionInfo, setSessionInfo] = useState(EnhancedSessionManager.getSessionInfo());
  const { colors, spacing, shadows } = useAppTheme();

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionInfo(EnhancedSessionManager.getSessionInfo());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
          <H2 style={styles.title}>Vitaliti Air</H2>
        </View>
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