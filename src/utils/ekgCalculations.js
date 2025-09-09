/**
 * EKG animation calculation utilities
 */

/**
 * Calculate distance between two points
 * @param {Object} point1 - First point with x and y coordinates
 * @param {Object} point2 - Second point with x and y coordinates
 * @returns {number} Distance between points
 */
export const calculateDistance = (point1, point2) => {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) + 
    Math.pow(point2.y - point1.y, 2)
  );
};

/**
 * Calculate angle between two points
 * @param {Object} point1 - First point with x and y coordinates
 * @param {Object} point2 - Second point with x and y coordinates
 * @returns {number} Angle in radians
 */
export const calculateAngle = (point1, point2) => {
  return Math.atan2(point2.y - point1.y, point2.x - point1.x);
};

/**
 * Get SpO2 color based on value
 * @param {number} spo2 - SpO2 percentage value
 * @returns {string} Hex color code
 */
export const getSpO2Color = (spo2) => {
  if (spo2 > 90) return '#4ADE80'; // Green
  if (spo2 > 85) return '#FFA500'; // Orange
  return '#FF6B6B'; // Red
};