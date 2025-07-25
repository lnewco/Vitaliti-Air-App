/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = config => ({
  type: "widget",
  name: "IHHT Live Activity",
  icon: 'https://github.com/expo.png',
  frameworks: ['SwiftUI', 'ActivityKit'],
  entitlements: { /* Add entitlements */ },
});