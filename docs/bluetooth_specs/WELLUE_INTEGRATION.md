# Wellue O2Ring / Checkme O2 Bluetooth Integration

## Overview
This document describes the Bluetooth integration for Wellue O2Ring and Checkme O2 pulse oximeter devices in the Vitaliti Air App.

## Supported Devices
- **Wellue O2Ring** - Ring-style continuous pulse oximeter
- **Checkme O2** - Fingertip pulse oximeter (Model 9560)
- Other Viatom/Wellue compatible devices

## Device Identification

### Bluetooth Name Pattern
Wellue devices broadcast with the name pattern: `Checkme O2 xxxx`
- Where `xxxx` represents the last 4 digits of the device serial number

### Service UUID
- **Primary Service**: `14839ac4-7d7e-415c-9a42-167340cf2339`

### Characteristics
- **TX (Read/Notify)**: `0734594a-a8e7-4b1a-a6b1-cd5243059a57`
  - Device sends data to app
  - Supports notifications for real-time data
  
- **RX (Write)**: `8b00ace7-eb0b-49b0-bbe9-9aee0a26e1a3`
  - App sends commands to device
  - Write without response

## Communication Protocol

### Command Structure
Commands sent to the device follow this format:
```
[Header(0xAA)] [CMD] [~CMD] [PKT_NR(2 bytes)] [DATA_SIZE(2 bytes)] [DATA] [CRC8]
```

### Response Structure
Responses from the device follow this format:
```
[Header(0x55)] [ACK_CMD] [~ACK_CMD] [PKT_NR(2 bytes)] [DATA_SIZE(2 bytes)] [DATA] [CRC8]
```

### Supported Commands
- `0x14` - Get device information
- `0x15` - PING (connection test)
- `0x17` - Get real-time data
- `0x18` - Factory reset

## Real-Time Data Format

The device returns 13 bytes of real-time data:

| Offset | Size | Description |
|--------|------|-------------|
| 0 | 1 | SpO2 (%) |
| 1-2 | 2 | Heart Rate (bpm, little-endian) |
| 3-6 | 4 | Step count (little-endian) |
| 7 | 1 | Battery level (%) |
| 8 | 1 | Charging status (0=not charging, 1=charging, 2=fully charged) |
| 9 | 1 | Acceleration/motion indicator |
| 10 | 1 | Perfusion Index (PI) in tenths |
| 11 | 1 | Wear status (bit 0: 1=wearing, 0=not wearing) |
| 12 | 1 | Reserved |

## Connection Process

1. **Device Discovery**
   - Scan for BLE devices
   - Filter by name pattern "Checkme O2" or service UUID

2. **Connection**
   - Connect to device
   - Discover services and characteristics
   - Enable notifications on TX characteristic

3. **Data Collection**
   - Send GET_RT_DATA command (0x17) periodically
   - Parse responses for SpO2, heart rate, and other metrics
   - Handle ACK responses with embedded data

## Implementation Details

### CRC8 Calculation
The protocol uses CRC8 with polynomial X^8 + X^2 + X + 1 for packet integrity.

### Data Polling
- Real-time data is requested every 2 seconds
- Device responds with current measurements in ACK packet
- Data is only valid when wear status indicates device is being worn

### Error Handling
- Verify CRC8 checksum on all packets
- Check wear status before using measurements
- Validate SpO2 (0-100%) and heart rate (30-250 bpm) ranges

## Troubleshooting

### Device Not Appearing in Scan
1. Ensure device is powered on
2. Check device is in pairing mode
3. Verify Bluetooth is enabled on phone
4. Device name should start with "Checkme O2"

### No Data Received
1. Verify device is properly worn (finger inserted)
2. Check battery level in device info
3. Ensure notifications are enabled on TX characteristic
4. Verify commands are being sent with correct CRC8

### Invalid Readings
1. Check wear status bit in data packet
2. Verify SpO2 and heart rate are within valid ranges
3. Ensure proper finger placement for accurate readings

## References
- Wellue O2 Product Bluetooth Communication Protocol v1.3
- Viatom Technology documentation