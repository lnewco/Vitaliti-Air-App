import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import logger from '../utils/logger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    logger.error('ErrorBoundary', 'Component tree error caught', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.name || 'Root',
    });

    // Update state with error details
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // In production, you might want to send this to an error reporting service
    if (!__DEV__) {
      // TODO: Send to error reporting service (e.g., Sentry, Bugsnag)
    }
  }

  handleReset = () => {
    logger.info('ErrorBoundary', 'Resetting error boundary');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI when error occurs
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              
              <Text style={styles.errorMessage}>
                The app encountered an unexpected error. This has been logged for review.
              </Text>

              {__DEV__ && this.state.error && (
                <View style={styles.debugContainer}>
                  <Text style={styles.debugTitle}>Debug Information:</Text>
                  <Text style={styles.debugText}>
                    {this.state.error.toString()}
                  </Text>
                  
                  {this.state.errorInfo && (
                    <ScrollView style={styles.stackTrace}>
                      <Text style={styles.stackTraceText}>
                        {this.state.errorInfo.componentStack}
                      </Text>
                    </ScrollView>
                  )}
                </View>
              )}

              <TouchableOpacity 
                style={styles.resetButton}
                onPress={this.handleReset}
              >
                <Text style={styles.resetButtonText}>Try Again</Text>
              </TouchableOpacity>

              {this.state.errorCount > 2 && (
                <Text style={styles.persistentError}>
                  Multiple errors detected. Please restart the app if issues persist.
                </Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  debugContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  stackTrace: {
    maxHeight: 200,
    marginTop: 8,
  },
  stackTraceText: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
  resetButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  persistentError: {
    fontSize: 12,
    color: '#ff9800',
    marginTop: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ErrorBoundary;