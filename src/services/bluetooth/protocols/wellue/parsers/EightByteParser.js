/**
 * EightByteParser - Parses Wellue 8-byte packet format
 */

import PacketParser from '../../base/PacketParser';
import PulseOxReading from '../../base/PulseOxReading';
import DataValidator from '../../base/DataValidator';
import { WELLUE_PACKET_OFFSETS, WELLUE_STATUS_FLAGS } from '../WellueConstants';

class EightByteParser extends PacketParser {
  constructor() {
    super('Wellue8Byte');
  }

  canParse(buffer) {
    return buffer.length === 8;
  }

  parse(buffer, rawData) {
    // Extract bytes according to 8-byte packet format
    const statusByte = buffer[WELLUE_PACKET_OFFSETS.BYTE8_STATUS];
    const pleth = buffer[WELLUE_PACKET_OFFSETS.BYTE8_PLETH];
    const bargraph = buffer[WELLUE_PACKET_OFFSETS.BYTE8_BARGRAPH];
    const piRaw = buffer[WELLUE_PACKET_OFFSETS.BYTE8_PI];
    const spo2 = buffer[WELLUE_PACKET_OFFSETS.BYTE8_SPO2];
    const heartRate = buffer[WELLUE_PACKET_OFFSETS.BYTE8_PULSE];
    
    // Parse status flags
    const isFingerDetected = (statusByte & WELLUE_STATUS_FLAGS.FINGER_OUT) === 0;
    const isSearchingForPulse = DataValidator.getBit(statusByte, 3);
    const isLowPerfusion = DataValidator.getBit(statusByte, 1);
    const isMotionDetected = DataValidator.getBit(statusByte, 0);
    
    // Parse signal strength
    const signalStrength = bargraph & 0x0F;
    const perfusionIndex = piRaw / 10.0;
    
    if (!isFingerDetected) {
      return PulseOxReading.createNoFinger({
        rawData,
        protocol: 'wellue-8byte'
      });
    }
    
    if (isSearchingForPulse) {
      return PulseOxReading.createSearching({
        pleth,
        bargraph: signalStrength,
        rawData,
        protocol: 'wellue-8byte'
      });
    }
    
    const validation = DataValidator.validateReading(spo2, heartRate);
    
    if (validation.isValid) {
      return PulseOxReading.createValid(
        DataValidator.sanitizeSpO2(spo2),
        DataValidator.sanitizeHeartRate(heartRate),
        {
          perfusionIndex,
          signalStrength,
          isLowPerfusion,
          isMotionDetected,
          pleth,
          bargraph: signalStrength,
          rawData,
          protocol: 'wellue-8byte'
        }
      );
    }
    
    return null;
  }
}

export default EightByteParser;