#!/usr/bin/env ruby

# This script fixes the native module paths in the Xcode project

require 'xcodeproj'

project_path = File.join(__dir__, 'VitalitiAirApp.xcodeproj')
project = Xcodeproj::Project.open(project_path)

# Remove existing references
files_to_remove = []
project.files.each do |file|
  if file.path && file.path.include?('IHHTWorkoutModule')
    files_to_remove << file
    puts "Found existing reference: #{file.path}"
  end
end

files_to_remove.each do |file|
  file.remove_from_project
  puts "Removed: #{file.path}"
end

# Save after removal
project.save
puts "Cleaned project file"

# Now run the add script to re-add properly
system("ruby #{File.join(__dir__, 'add_native_modules.rb')}")