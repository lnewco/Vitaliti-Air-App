/**
 * ACKPacketParser - Parses Wellue ACK response packets
 */

import PacketParser from '../../base/PacketParser';
import PulseOxReading from '../../base/PulseOxReading';
import DataValidator from '../../base/DataValidator';
import { WELLUE_HEADERS, WELLUE_COMMANDS, WELLUE_PACKET_OFFSETS } from '../WellueConstants';

class ACKPacketParser extends PacketParser {
  constructor() {
    super('WellueACK');
  }

  canParse(buffer) {
    return buffer[0] === WELLUE_HEADERS.ACK && 
           buffer.length >= 13 &&
           buffer[2] === 0xff;
  }

  parse(buffer, rawData) {
    const ackCommand = buffer[1];
    
    // Check for real-time data ACK
    if (ackCommand === WELLUE_COMMANDS.GET_RT_DATA || 
        (ackCommand === 0x00 && buffer.length >= 20)) {
      return this.parseRealTimeData(buffer, rawData);
    }
    
    // Handle other ACK types
    switch(ackCommand) {
      case WELLUE_COMMANDS.GET_DEVICE_INFO:
        return this.parseDeviceInfo(buffer);
      case WELLUE_COMMANDS.PING:
        return { type: 'ping', status: 'ok' };
      default:
        return null;
    }
  }

  parseRealTimeData(buffer, rawData) {
    const dataSize = DataValidator.combine16Bit(buffer[5], buffer[6]);
    
    if (dataSize !== 13 || buffer.length < 20) {
      return null;
    }
    
    const offset = 7;
    const spo2 = buffer[offset + WELLUE_PACKET_OFFSETS.RT_SPO2];
    const pulseRate = DataValidator.combine16Bit(
      buffer[offset + WELLUE_PACKET_OFFSETS.RT_PULSE_LOW],
      buffer[offset + WELLUE_PACKET_OFFSETS.RT_PULSE_HIGH]
    );
    
    const battery = buffer[offset + WELLUE_PACKET_OFFSETS.RT_BATTERY];
    const chargeStatus = buffer[offset + WELLUE_PACKET_OFFSETS.RT_CHARGE_STATUS];
    const acceleration = buffer[offset + WELLUE_PACKET_OFFSETS.RT_ACCELERATION];
    const pi = buffer[offset + WELLUE_PACKET_OFFSETS.RT_PI] / 10.0;
    const wearStatus = buffer[offset + WELLUE_PACKET_OFFSETS.RT_WEAR_STATUS];
    const isWearing = (wearStatus & 0x01) === 1;
    
    if (!isWearing) {
      return PulseOxReading.createNoFinger({
        battery,
        chargeStatus,
        rawData,
        protocol: 'wellue-ack'
      });
    }
    
    const validation = DataValidator.validateReading(spo2, pulseRate);
    
    if (validation.isValid) {
      return PulseOxReading.createValid(
        DataValidator.sanitizeSpO2(spo2),
        DataValidator.sanitizeHeartRate(pulseRate),
        {
          perfusionIndex: pi,
          signalStrength: acceleration,
          isLowPerfusion: pi < 1.0,
          isMotionDetected: acceleration > 50,
          battery,
          chargeStatus,
          rawData,
          protocol: 'wellue-ack'
        }
      );
    }
    
    return null;
  }

  parseDeviceInfo(buffer) {
    const dataSize = DataValidator.combine16Bit(buffer[5], buffer[6]);
    
    if (dataSize > 0 && buffer.length > 7) {
      try {
        const jsonData = buffer.slice(7, 7 + dataSize).toString('utf8');
        const deviceInfo = JSON.parse(jsonData);
        
        return {
          type: 'device_info',
          data: deviceInfo
        };
      } catch (error) {
        return null;
      }
    }
    
    return null;
  }
}

export default ACKPacketParser;