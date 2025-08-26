// Mock data for testing until backend integration is complete
// Remove this file once vitaliti-air-analytics is connected

export const getMockWhoopData = () => ({
  vendor: 'whoop',
  date: new Date().toISOString(),
  recovery: 66,
  strain: 5.1,
  sleepScore: 78,
  restingHR: 51,
  hrv: 96,
  respRate: 17.8
});

export const getMockOuraData = () => ({
  vendor: 'oura',
  date: new Date().toISOString(),
  recovery: 91, // Readiness
  strain: 71.0, // Activity
  sleepScore: 86,
  restingHR: 54,
  hrv: 20,
  respRate: 13.6
});

// Simulate fetching data with delay
export const getMockMetrics = (vendor = 'whoop') => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(vendor === 'whoop' ? getMockWhoopData() : getMockOuraData());
    }, 1000);
  });
};