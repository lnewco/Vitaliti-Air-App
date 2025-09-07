import ActivityKit
import SwiftUI

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