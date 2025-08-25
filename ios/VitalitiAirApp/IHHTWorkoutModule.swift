import Foundation
import HealthKit
import React
import BackgroundTasks
import CoreBluetooth

@objc(IHHTWorkoutModule)
class IHHTWorkoutModule: RCTEventEmitter {
  private var healthStore: HKHealthStore?
  private var workoutBuilder: HKWorkoutBuilder?
  private var backgroundTimer: Timer?
  private var elapsedSeconds: Int = 0
  private var isBackground: Bool = false
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
  private var centralManager: CBCentralManager?
  private var connectedPeripheral: CBPeripheral?
  private var isBluetoothConnected: Bool = false
  
  override init() {
    super.init()
    
    // Check if HealthKit is available
    if HKHealthStore.isHealthDataAvailable() {
      self.healthStore = HKHealthStore()
      print("✅ IHHTWorkoutModule: HealthKit is available")
    } else {
      print("❌ IHHTWorkoutModule: HealthKit is NOT available")
    }
    
    // Observe app state changes
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(appDidEnterBackground),
      name: UIApplication.didEnterBackgroundNotification,
      object: nil
    )
    
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(appDidBecomeActive),
      name: UIApplication.didBecomeActiveNotification,
      object: nil
    )
  }
  
  @objc func appDidEnterBackground() {
    isBackground = true
    print("📱 IHHTWorkoutModule: App entered background")
    
    // Request background time
    backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
      self?.endBackgroundTask()
    }
    
    sendEvent(withName: "onAppStateChange", body: ["state": "background"])
  }
  
  @objc func appDidBecomeActive() {
    isBackground = false
    print("📱 IHHTWorkoutModule: App became active")
    endBackgroundTask()
    sendEvent(withName: "onAppStateChange", body: ["state": "active"])
  }
  
  private func endBackgroundTask() {
    if backgroundTask != .invalid {
      UIApplication.shared.endBackgroundTask(backgroundTask)
      backgroundTask = .invalid
    }
  }
  
  override func supportedEvents() -> [String]! {
    return ["onWorkoutTick", "onWorkoutStateChange", "onAppStateChange", "onWorkoutError", "onBluetoothStateChange"]
  }
  
  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  @objc
  func startWorkout(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    print("🏃 IHHTWorkoutModule: Starting workout session...")
    
    guard let healthStore = self.healthStore else {
      reject("HEALTH_UNAVAILABLE", "HealthKit is not available", nil)
      return
    }
    
    // Initialize CoreBluetooth for background mode
    if centralManager == nil {
      centralManager = CBCentralManager(delegate: self, queue: nil, options: [
        CBCentralManagerOptionRestoreIdentifierKey: "com.vitaliti.ihht.bluetooth"
      ])
    }
    
    // Request authorization
    let typesToShare: Set<HKSampleType> = [HKObjectType.workoutType()]
    let typesToRead: Set<HKObjectType> = [HKObjectType.workoutType()]
    
    healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { success, error in
      if !success {
        print("❌ IHHTWorkoutModule: HealthKit authorization failed")
        reject("AUTH_FAILED", "HealthKit authorization failed", error)
        return
      }
      
      print("✅ IHHTWorkoutModule: HealthKit authorized")
      
      // Create workout configuration
      let configuration = HKWorkoutConfiguration()
      configuration.activityType = .mindAndBody  // Appropriate for breathing exercises
      configuration.locationType = .unknown
      
      // Create workout builder for iOS
      let builder = HKWorkoutBuilder(healthStore: healthStore, configuration: configuration, device: nil)
      self.workoutBuilder = builder
      
      // Start collecting workout data
      let startDate = Date()
      builder.beginCollection(withStart: startDate) { success, error in
        if success {
          print("✅ IHHTWorkoutModule: Workout collection started successfully")
          
          // Start background timer
          DispatchQueue.main.async {
            self.elapsedSeconds = 0
            self.startBackgroundTimer()
            resolve(["status": "started", "message": "Workout started"])
          }
        } else {
          print("❌ IHHTWorkoutModule: Failed to start workout collection")
          reject("START_FAILED", "Failed to start workout", error)
        }
      }
    }
  }
  
  @objc
  func stopWorkout(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    print("🛑 IHHTWorkoutModule: Stopping workout...")
    
    guard let builder = self.workoutBuilder else {
      reject("NO_SESSION", "No active workout", nil)
      return
    }
    
    // Stop the timer
    self.stopBackgroundTimer()
    
    // End the workout
    let endDate = Date()
    builder.endCollection(withEnd: endDate) { success, error in
      if success {
        builder.finishWorkout { workout, error in
          if let workout = workout {
            print("✅ IHHTWorkoutModule: Workout saved successfully")
            resolve(["status": "stopped", "duration": self.elapsedSeconds])
          } else {
            print("⚠️ IHHTWorkoutModule: Workout ended but not saved")
            resolve(["status": "stopped", "duration": self.elapsedSeconds])
          }
          
          // Clean up
          self.workoutBuilder = nil
          self.elapsedSeconds = 0
          self.endBackgroundTask()
        }
      } else {
        print("❌ IHHTWorkoutModule: Failed to end workout collection")
        reject("STOP_FAILED", "Failed to stop workout", error)
      }
    }
  }
  
  private func startBackgroundTimer() {
    print("⏱️ IHHTWorkoutModule: Starting background timer")
    
    // Cancel existing timer if any
    self.stopBackgroundTimer()
    
    // Create new timer that fires every 5 seconds
    self.backgroundTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
      self.elapsedSeconds += 5
      
      let statusEmoji = self.isBackground ? "🌙" : "☀️"
      print("\(statusEmoji) IHHTWorkoutModule Timer: \(self.elapsedSeconds)s (Background: \(self.isBackground))")
      
      // Send event to JavaScript
      self.sendEvent(withName: "onWorkoutTick", body: [
        "elapsedSeconds": self.elapsedSeconds,
        "isBackground": self.isBackground,
        "timestamp": Date().timeIntervalSince1970
      ])
    }
  }
  
  private func stopBackgroundTimer() {
    self.backgroundTimer?.invalidate()
    self.backgroundTimer = nil
    print("⏹️ IHHTWorkoutModule: Stopped background timer")
  }
  
  @objc
  func setBluetoothDevice(_ deviceId: String, resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    print("📱 IHHTWorkoutModule: Setting Bluetooth device ID: \(deviceId)")
    // Store device ID for reconnection in background
    UserDefaults.standard.set(deviceId, forKey: "com.vitaliti.lastConnectedDevice")
    resolve(["success": true])
  }
  
  @objc
  func notifyBluetoothConnected(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    print("✅ IHHTWorkoutModule: Bluetooth device connected")
    isBluetoothConnected = true
    sendEvent(withName: "onBluetoothStateChange", body: ["connected": true])
    resolve(["success": true])
  }
  
  @objc
  func notifyBluetoothDisconnected(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    print("❌ IHHTWorkoutModule: Bluetooth device disconnected")
    isBluetoothConnected = false
    sendEvent(withName: "onBluetoothStateChange", body: ["connected": false])
    resolve(["success": true])
  }
}

// MARK: - CBCentralManagerDelegate
extension IHHTWorkoutModule: CBCentralManagerDelegate {
  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    switch central.state {
    case .poweredOn:
      print("✅ IHHTWorkoutModule: Bluetooth powered on")
      // Attempt to restore connection if needed
      if isBackground && workoutBuilder != nil {
        restoreBluetoothConnection()
      }
    case .poweredOff:
      print("❌ IHHTWorkoutModule: Bluetooth powered off")
    case .unauthorized:
      print("❌ IHHTWorkoutModule: Bluetooth unauthorized")
    default:
      print("⚠️ IHHTWorkoutModule: Bluetooth state: \(central.state.rawValue)")
    }
  }
  
  func centralManager(_ central: CBCentralManager, willRestoreState dict: [String : Any]) {
    print("📱 IHHTWorkoutModule: Restoring Bluetooth state in background")
    if let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] {
      for peripheral in peripherals {
        print("📱 Restored peripheral: \(peripheral.identifier)")
        connectedPeripheral = peripheral
        isBluetoothConnected = true
      }
    }
  }
  
  private func restoreBluetoothConnection() {
    // This would be called to restore connection in background
    // The actual connection is managed by the JavaScript BluetoothService
    print("🔄 IHHTWorkoutModule: Attempting to restore Bluetooth connection")
    
    if let deviceId = UserDefaults.standard.string(forKey: "com.vitaliti.lastConnectedDevice") {
      print("📱 Last connected device: \(deviceId)")
      // Send event to JavaScript to restore connection
      sendEvent(withName: "onBluetoothStateChange", body: [
        "needsReconnection": true,
        "deviceId": deviceId
      ])
    }
  }
}