import ActivityKit
import WidgetKit
import SwiftUI

struct IHHTLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: IHHTAttributes.self) { context in
            // Lock Screen/Banner UI
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: context.state.getPhaseIcon())
                            .foregroundColor(context.state.getPhaseColor())
                            .font(.headline)
                        
                        Text("IHHT Training")
                            .font(.headline)
                            .foregroundColor(.white)
                    }
                    
                    Text("Cycle \(context.state.currentCycle)/\(context.state.totalCycles)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    // Timer display - use native SwiftUI timer for efficiency
                    if context.state.isRunning() {
                        Text(timerInterval: context.state.startedAt...context.state.getFutureDate(),
                             pauseTime: nil,
                             countsDown: false,
                             showsHours: false)
                            .font(.title2)
                            .foregroundColor(.white)
                            .monospacedDigit()
                    } else {
                        Text(context.state.getFormattedElapsedTime())
                            .font(.title2)
                            .foregroundColor(.white)
                            .monospacedDigit()
                    }
                }
                
                Spacer()
                
                VStack(spacing: 8) {
                    Circle()
                        .fill(context.state.getPhaseColor())
                        .frame(width: 24, height: 24)
                    
                    Text(context.state.currentPhase)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                    
                    Text(context.state.getFormattedPhaseTime())
                        .font(.caption)
                        .foregroundColor(.white)
                        .monospacedDigit()
                }
            }
            .padding(16)
            .background(Color.black.opacity(0.8))
            .cornerRadius(16)
            .activitySystemActionForegroundColor(Color.white)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded Dynamic Island UI
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            Image(systemName: context.state.getPhaseIcon())
                                .foregroundColor(context.state.getPhaseColor())
                                .font(.caption)
                            
                            Text("IHHT")
                                .font(.caption)
                                .foregroundColor(.white)
                        }
                        
                        if context.state.isRunning() {
                            Text(timerInterval: context.state.startedAt...context.state.getFutureDate(),
                                 pauseTime: nil,
                                 countsDown: false,
                                 showsHours: false)
                                .font(.title3)
                                .foregroundColor(.white)
                                .monospacedDigit()
                        } else {
                            Text("PAUSED")
                                .font(.title3)
                                .foregroundColor(.orange)
                        }
                    }
                }
                
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(spacing: 4) {
                        Text("Cycle \(context.state.currentCycle)/\(context.state.totalCycles)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Circle()
                            .fill(context.state.getPhaseColor())
                            .frame(width: 20, height: 20)
                        
                        Text(context.state.currentPhase)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text("Phase Time:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text(context.state.getFormattedPhaseTime())
                            .font(.caption)
                            .foregroundColor(.white)
                            .monospacedDigit()
                    }
                    .padding(.horizontal, 8)
                }
                
            } compactLeading: {
                HStack(spacing: 4) {
                    Image(systemName: context.state.getPhaseIcon())
                        .foregroundColor(context.state.getPhaseColor())
                        .font(.caption2)
                    
                    Text("IHHT")
                        .font(.caption2)
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
                
            } compactTrailing: {
                if context.state.isRunning() {
                    Text(timerInterval: context.state.startedAt...context.state.getFutureDate(),
                         pauseTime: nil,
                         countsDown: false,
                         showsHours: false)
                        .font(.caption2)
                        .foregroundColor(.white)
                        .monospacedDigit()
                } else {
                    Text("⏸️")
                        .font(.caption2)
                }
                
            } minimal: {
                Circle()
                    .fill(context.state.getPhaseColor())
                    .frame(width: 16, height: 16)
            }
        }
    }
}

// Preview support
extension IHHTAttributes {
    fileprivate static var preview: IHHTAttributes {
        IHHTAttributes(
            sessionType: "IHHT",
            sessionId: "preview-session",
            startTime: Date()
        )
    }
}

extension IHHTAttributes.ContentState {
    fileprivate static var hypoxic: IHHTAttributes.ContentState {
        IHHTAttributes.ContentState(
            startedAt: Date().addingTimeInterval(-180), // 3 minutes ago
            pausedAt: nil,
            currentPhase: "HYPOXIC",
            currentCycle: 2,
            totalCycles: 5,
            phaseTimeRemaining: 120 // 2 minutes left
        )
    }
    
    fileprivate static var hyperoxic: IHHTAttributes.ContentState {
        IHHTAttributes.ContentState(
            startedAt: Date().addingTimeInterval(-480), // 8 minutes ago
            pausedAt: nil,
            currentPhase: "HYPEROXIC",
            currentCycle: 3,
            totalCycles: 5,
            phaseTimeRemaining: 30 // 30 seconds left
        )
    }
    
    fileprivate static var paused: IHHTAttributes.ContentState {
        IHHTAttributes.ContentState(
            startedAt: Date().addingTimeInterval(-300), // 5 minutes ago
            pausedAt: Date(), // paused now
            currentPhase: "HYPOXIC",
            currentCycle: 1,
            totalCycles: 5,
            phaseTimeRemaining: 180 // 3 minutes left when paused
        )
    }
}

#Preview("Notification", as: .content, using: IHHTAttributes.preview) {
   IHHTLiveActivity()
} contentStates: {
    IHHTAttributes.ContentState.hypoxic
    IHHTAttributes.ContentState.hyperoxic
    IHHTAttributes.ContentState.paused
}
