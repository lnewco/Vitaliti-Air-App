import ExpoModulesCore
import ActivityKit
import SwiftUI

// IHHT Live Activity Attributes - shared with widget target
struct IHHTAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var startedAt: Date
        var pausedAt: Date?
        var currentPhase: String // "HYPOXIC" or "HYPEROXIC"
        var currentCycle: Int
        var totalCycles: Int
        var phaseTimeRemaining: Int // seconds remaining in current phase
        
        // Helper functions
        func isRunning() -> Bool {
            return pausedAt == nil
        }
        
        func getElapsedTime() -> TimeInterval {
            if let pausedAt = pausedAt {
                return pausedAt.timeIntervalSince(startedAt)
            }
            return Date().timeIntervalSince(startedAt)
        }
        
        func getFutureDate() -> Date {
            // Return a date far in the future for Text(timerInterval:)
            return Date().addingTimeInterval(365 * 24 * 60 * 60) // 1 year out
        }
        
        func getFormattedElapsedTime() -> String {
            let elapsed = getElapsedTime()
            let totalSeconds = Int(elapsed)
            let hours = totalSeconds / 3600
            let minutes = (totalSeconds % 3600) / 60
            let seconds = totalSeconds % 60
            
            if hours > 0 {
                return String(format: "%d:%02d:%02d", hours, minutes, seconds)
            } else {
                return String(format: "%d:%02d", minutes, seconds)
            }
        }
        
        func getFormattedPhaseTime() -> String {
            let minutes = phaseTimeRemaining / 60
            let seconds = phaseTimeRemaining % 60
            return String(format: "%d:%02d", minutes, seconds)
        }
        
        func getPhaseColor() -> Color {
            switch currentPhase {
            case "HYPOXIC":
                return .blue
            case "HYPEROXIC":
                return .green
            default:
                return .gray
            }
        }
        
        func getPhaseIcon() -> String {
            switch currentPhase {
            case "HYPOXIC":
                return "lungs.fill"
            case "HYPEROXIC":
                return "leaf.fill"
            default:
                return "heart.fill"
            }
        }
    }
    
    // Static attributes that don't change during the activity
    var sessionType: String
    var sessionId: String
    var startTime: Date
}

public class LiveActivityModule: Module {
  // Reference to the current Live Activity (stored as Any to avoid iOS version issues)
  private var currentActivity: Any?
  
  public func definition() -> ModuleDefinition {
    Name("LiveActivityModule")

    // Constants for availability check
    Constants([
      "isLiveActivitySupported": {
        if #available(iOS 16.2, *) {
          return ActivityAuthorizationInfo().areActivitiesEnabled
        } else {
          return false
        }
      }()
    ])

    // Events that can be sent to JavaScript
    Events("onActivityStateChanged")

    // Check if Live Activities are supported and enabled
    AsyncFunction("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      } else {
        return false
      }
    }

    // Start a new Live Activity for IHHT session
    AsyncFunction("startActivity") { (sessionData: [String: Any]) -> [String: Any] in
      guard #available(iOS 16.2, *) else {
        throw LiveActivityError.notSupported
      }
      
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        throw LiveActivityError.notSupported
      }

      // Stop any existing activity first
      await self.internalStopActivity()

      do {
        // Parse session data
        guard let sessionId = sessionData["sessionId"] as? String,
              let sessionType = sessionData["sessionType"] as? String,
              let startTimeInterval = sessionData["startTime"] as? Double else {
          throw LiveActivityError.invalidData
        }

        let startTime = Date(timeIntervalSince1970: startTimeInterval / 1000.0)
        
        // Create activity attributes
        let attributes = IHHTAttributes(
          sessionType: sessionType,
          sessionId: sessionId,
          startTime: startTime
        )

        // Create initial content state
        let initialContentState = IHHTAttributes.ContentState(
          startedAt: startTime,
          pausedAt: nil,
          currentPhase: "HYPOXIC",
          currentCycle: 1,
          totalCycles: sessionData["totalCycles"] as? Int ?? 5,
          phaseTimeRemaining: 300 // 5 minutes for hypoxic phase
        )

        // Request the Live Activity
        let activity = try Activity.request(
          attributes: attributes,
          content: ActivityContent(state: initialContentState, staleDate: nil),
          pushType: nil
        )

        self.currentActivity = activity
        
        // Send event to JavaScript
        self.sendEvent("onActivityStateChanged", [
          "state": "started",
          "activityId": activity.id
        ])

        return [
          "success": true,
          "activityId": activity.id
        ]
        
      } catch {
        throw LiveActivityError.startFailed(error.localizedDescription)
      }
    }

    // Update the Live Activity state
    AsyncFunction("updateActivity") { (updateData: [String: Any]) -> [String: Any] in
      guard #available(iOS 16.2, *) else {
        throw LiveActivityError.notSupported
      }
      
      guard let activity = self.currentActivity as? Activity<IHHTAttributes> else {
        throw LiveActivityError.noActiveActivity
      }

      do {
        // Parse update data
        guard let currentPhase = updateData["currentPhase"] as? String,
              let currentCycle = updateData["currentCycle"] as? Int,
              let phaseTimeRemaining = updateData["phaseTimeRemaining"] as? Int else {
          throw LiveActivityError.invalidData
        }

        let pausedAt: Date? = {
          if let pausedAtInterval = updateData["pausedAt"] as? Double {
            return Date(timeIntervalSince1970: pausedAtInterval / 1000.0)
          }
          return nil
        }()

        // Create updated content state
        let updatedContentState = IHHTAttributes.ContentState(
          startedAt: activity.content.state.startedAt,
          pausedAt: pausedAt,
          currentPhase: currentPhase,
          currentCycle: currentCycle,
          totalCycles: activity.content.state.totalCycles,
          phaseTimeRemaining: phaseTimeRemaining
        )

        // Update the activity
        await activity.update(
          ActivityContent(state: updatedContentState, staleDate: nil)
        )

        return [
          "success": true,
          "updated": true
        ]
        
      } catch {
        throw LiveActivityError.updateFailed(error.localizedDescription)
      }
    }

    // End the Live Activity
    AsyncFunction("stopActivity") { () async -> [String: Any] in
      return await self.internalStopActivity()
    }

    // Get current activity status
    Function("getActivityStatus") { () -> [String: Any] in
      if #available(iOS 16.2, *), 
         let activity = self.currentActivity as? Activity<IHHTAttributes> {
        return [
          "hasActiveActivity": true,
          "activityId": activity.id,
          "activityState": String(describing: activity.activityState)
        ]
      } else {
        return [
          "hasActiveActivity": false
        ]
      }
    }
  }

  // Internal method to stop Live Activity
  private func internalStopActivity() async -> [String: Any] {
    guard #available(iOS 16.2, *) else {
      return [
        "success": true,
        "message": "Live Activities not supported on this iOS version"
      ]
    }
    
    guard let activity = self.currentActivity as? Activity<IHHTAttributes> else {
      return [
        "success": true,
        "message": "No active activity to stop"
      ]
    }

    do {
      // End the activity with completion state
      let finalContentState = IHHTAttributes.ContentState(
        startedAt: activity.content.state.startedAt,
        pausedAt: Date(), // Mark as completed
        currentPhase: "COMPLETED",
        currentCycle: activity.content.state.totalCycles,
        totalCycles: activity.content.state.totalCycles,
        phaseTimeRemaining: 0
      )

      await activity.end(
        ActivityContent(state: finalContentState, staleDate: nil),
        dismissalPolicy: .after(.now + 30) // Keep visible for 30 seconds
      )

      self.currentActivity = nil
      
      // Send event to JavaScript
      self.sendEvent("onActivityStateChanged", [
        "state": "ended",
        "activityId": activity.id
      ])

      return [
        "success": true,
        "ended": true
      ]
      
    } catch {
      return [
        "success": false,
        "error": error.localizedDescription
      ]
    }
  }
}

// Custom error types for Live Activity operations
enum LiveActivityError: Error, CustomStringConvertible {
  case notSupported
  case invalidData
  case noActiveActivity
  case startFailed(String)
  case updateFailed(String)
  case stopFailed(String)

  var description: String {
    switch self {
    case .notSupported:
      return "Live Activities are not supported or enabled on this device"
    case .invalidData:
      return "Invalid data provided for Live Activity operation"
    case .noActiveActivity:
      return "No active Live Activity found"
    case .startFailed(let message):
      return "Failed to start Live Activity: \(message)"
    case .updateFailed(let message):
      return "Failed to update Live Activity: \(message)"
    case .stopFailed(let message):
      return "Failed to stop Live Activity: \(message)"
    }
  }
} 