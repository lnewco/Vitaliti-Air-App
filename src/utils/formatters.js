/**
 * Centralized formatting utilities for consistent data display
 */

/**
 * Format seconds to MM:SS display
 */
export const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format duration with flexible options
 */
export const formatDuration = (durationInSeconds, options = {}) => {
  const { format = 'mm:ss', includeHours = false } = options;
  
  if (!durationInSeconds || durationInSeconds < 0) return '0:00';
  
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = Math.floor(durationInSeconds % 60);
  
  if (includeHours || hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Format phone number for display (XXX) XXX-XXXX
 */
export const formatPhoneForDisplay = (phone) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

/**
 * Format phone number for API calls
 */
export const formatPhoneForApi = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  
  // Add country code if missing
  if (cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }
  
  return '+' + cleaned;
};

/**
 * Format date for display
 */
export const formatDate = (timestamp, options = {}) => {
  const { 
    format = 'short', // 'short', 'long', 'relative'
    includeTime = false 
  } = options;
  
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  
  if (format === 'relative') {
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  }
  
  if (format === 'long') {
    const dateStr = date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    if (includeTime) {
      const timeStr = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit' 
      });
      return `${dateStr} at ${timeStr}`;
    }
    return dateStr;
  }
  
  // Default 'short' format
  const dateStr = date.toLocaleDateString();
  if (includeTime) {
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    return `${dateStr} ${timeStr}`;
  }
  return dateStr;
};

/**
 * Format percentage for display
 */
export const formatPercentage = (value, decimals = 0) => {
  if (value == null || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format altitude for display
 */
export const formatAltitude = (meters) => {
  if (!meters && meters !== 0) return '0m';
  return `${Math.round(meters).toLocaleString()}m`;
};