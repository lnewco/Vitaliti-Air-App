import React from 'react';
import { 
  SafeAreaView, 
  ScrollView, 
  View, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  RefreshControl
} from 'react-native';
import { useAppTheme } from '../../theme';

const Container = ({
  children,
  safe = true,
  scroll = false,
  scrollable = false, // Alias for scroll
  keyboardAvoid = false,
  keyboardAvoiding = false, // Alias for keyboardAvoid
  style,
  contentStyle,
  refreshing = false,
  onRefresh,
  header,
  footer,
  padding = true,
  backgroundColor,
  ...props
}) => {
  const { colors, spacing } = useAppTheme();
  
  const shouldScroll = scroll || scrollable;
  const shouldAvoidKeyboard = keyboardAvoid || keyboardAvoiding;
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: backgroundColor || colors.surface.card,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    padding: {
      padding: spacing.screenPadding,
    },
    keyboardAvoid: {
      flex: 1,
    },
  });
  
  const containerStyles = [
    styles.container,
    style,
  ];

  const contentStyles = [
    padding && styles.padding,
    contentStyle,
  ];

  const content = (
    <>
      {header}
      {shouldScroll ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={contentStyles}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary[500]}
              />
            ) : undefined
          }
          {...props}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentStyles]} {...props}>
          {children}
        </View>
      )}
      {footer}
    </>
  );

  const wrappedContent = shouldAvoidKeyboard ? (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  if (safe) {
    return (
      <SafeAreaView style={containerStyles}>
        {wrappedContent}
      </SafeAreaView>
    );
  }

  return (
    <View style={containerStyles}>
      {wrappedContent}
    </View>
  );
};

// Screen Container - Combines common patterns
export const ScreenContainer = ({
  children,
  loading = false,
  error = null,
  empty = false,
  emptyMessage = 'No data available',
  ...props
}) => {
  // You could add loading, error, and empty states here
  // For now, just pass through to Container
  return (
    <Container safe scroll {...props}>
      {children}
    </Container>
  );
};

export default Container;