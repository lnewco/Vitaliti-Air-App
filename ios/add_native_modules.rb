#!/usr/bin/env ruby

# This script adds our native modules to the Xcode project
# It's called from Podfile post_install

require 'xcodeproj'

def add_native_modules_to_project
  project_path = File.join(__dir__, 'VitalitiAirApp.xcodeproj')
  project = Xcodeproj::Project.open(project_path)
  
  main_group = project.main_group['VitalitiAirApp']
  
  # Files to add
  files_to_add = [
    'IHHTWorkoutModule.swift',
    'IHHTWorkoutModule.m'
  ]
  
  # Get the main target
  target = project.targets.find { |t| t.name == 'VitalitiAirApp' }
  
  if target.nil?
    puts "❌ Could not find VitalitiAirApp target"
    return
  end
  
  files_to_add.each do |filename|
    file_path = File.join(__dir__, 'VitalitiAirApp', filename)
    
    # Check if file exists
    unless File.exist?(file_path)
      puts "⚠️  File not found: #{filename}"
      next
    end
    
    # Check if already in project (by display name)
    existing_file = main_group.files.find { |f| f.display_name == filename }
    
    if existing_file
      puts "✓ #{filename} already in project"
      # Make sure the path is correct
      existing_file.set_path(filename)
    else
      # Add file reference to project with correct path
      file_ref = main_group.new_reference(filename)
      file_ref.set_path(filename)
      
      # Add to target's compile sources
      if filename.end_with?('.swift', '.m')
        target.source_build_phase.add_file_reference(file_ref)
      end
      
      puts "✅ Added #{filename} to project with correct path"
    end
  end
  
  # Save the project
  project.save
  puts "✅ Project saved with native modules"
end

# Run the script
add_native_modules_to_project