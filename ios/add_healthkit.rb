#!/usr/bin/env ruby

# This script adds HealthKit framework to the Xcode project

require 'xcodeproj'

project_path = File.join(__dir__, 'VitalitiAirApp.xcodeproj')
project = Xcodeproj::Project.open(project_path)

# Get the main target
target = project.targets.find { |t| t.name == 'VitalitiAirApp' }

if target.nil?
  puts "❌ Could not find VitalitiAirApp target"
  exit 1
end

# Check if HealthKit is already added
healthkit_ref = target.frameworks_build_phase.files.find { |f| 
  f.display_name == 'HealthKit.framework'
}

if healthkit_ref
  puts "✓ HealthKit.framework already linked"
else
  # Add HealthKit framework
  healthkit = project.frameworks_group.new_reference('System/Library/Frameworks/HealthKit.framework')
  healthkit.name = 'HealthKit.framework'
  healthkit.source_tree = 'SDKROOT'
  
  target.frameworks_build_phase.add_file_reference(healthkit)
  
  puts "✅ Added HealthKit.framework to project"
end

# Also add HealthKit to build settings if needed
target.build_configurations.each do |config|
  # Enable HealthKit capability
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] ||= 'com.sophiafay24.VitalitiAirApp'
  
  # Make sure entitlements file is set
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] ||= 'VitalitiAirApp/VitalitiAirApp.entitlements'
  
  puts "✅ Updated #{config.name} configuration"
end

# Save the project
project.save
puts "✅ Project saved with HealthKit framework"