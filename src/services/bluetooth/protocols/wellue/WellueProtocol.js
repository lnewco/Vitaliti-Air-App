/**
 * WellueProtocol - Main protocol handler for Wellue devices
 */

import { Buffer } from 'buffer';
import ACKPacketParser from './parsers/ACKPacketParser';
import EightByteParser from './parsers/EightByteParser';
import StreamingParser from './parsers/StreamingParser';
import PulseOxReading from '../base/PulseOxReading';
import logger from '../../../../utils/logger';
import { WELLUE_HEADERS, WELLUE_COMMANDS } from './WellueConstants';

const log = logger.createModuleLogger('WellueProtocol');

class WellueProtocol {
  constructor() {
    this.parsers = [
      new ACKPacketParser(),
      new EightByteParser(),
      new StreamingParser()
    ];
    
    this.packetNumber = 0;
    this.deviceInfo = null;
  }

  /**
   * Parse incoming data from Wellue device
   */
  parseData(base64Data) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Try each parser
      for (const parser of this.parsers) {
        if (parser.canParse(buffer)) {
          const result = parser.parse(buffer, base64Data);
          
          // Handle streaming assembly
          if (result?.needsReparse && result.buffer) {
            return this.parseData(result.buffer.toString('base64'));
          }
          
          // Store device info if received
          if (result?.type === 'device_info') {
            this.deviceInfo = result.data;
            log.info('Device info stored:', this.deviceInfo);
          }
          
          return result;
        }
      }
      
      // No parser matched - try alternative fallback
      if (buffer.length >= 7) {
        return this.tryAlternativeParsing(buffer, base64Data);
      }
      
      return null;
      
    } catch (error) {
      log.error('Error parsing Wellue data:', error);
      return PulseOxReading.createError(base64Data);
    }
  }

  /**
   * Try alternative parsing for non-standard packets
   */
  tryAlternativeParsing(buffer, rawData) {
    // Common byte positions to check
    const attempts = [
      { spo2: 0, hr: 1 },
      { spo2: 4, hr: 5 },
      { spo2: 5, hr: 6 }
    ];
    
    for (const { spo2: spo2Idx, hr: hrIdx } of attempts) {
      if (buffer.length > Math.max(spo2Idx, hrIdx)) {
        const spo2 = buffer[spo2Idx];
        const hr = buffer[hrIdx];
        
        if (spo2 >= 70 && spo2 <= 100 && hr >= 30 && hr <= 250) {
          log.debug(`Alternative parsing found valid data at positions ${spo2Idx},${hrIdx}`);
          
          return PulseOxReading.createValid(spo2, hr, {
            rawData,
            protocol: 'wellue-alternative'
          });
        }
      }
    }
    
    return null;
  }

  /**
   * Create command packet for Wellue device
   */
  createCommand(command, data = null) {
    let dataLen = data ? data.length : 0;
    let packet = Buffer.alloc(7 + dataLen);
    
    packet[0] = WELLUE_HEADERS.COMMAND;
    packet[1] = command;
    packet[2] = 0xFF;
    packet[3] = this.packetNumber++ & 0xFF;
    packet[4] = ~packet[3] & 0xFF;
    packet[5] = dataLen & 0xFF;
    packet[6] = (dataLen >> 8) & 0xFF;
    
    if (data) {
      data.copy(packet, 7);
    }
    
    // Calculate and append CRC
    const crc = this.calculateCRC8(packet.slice(0, 7 + dataLen));
    const finalPacket = Buffer.concat([packet, Buffer.from([crc])]);
    
    log.debug(`Created command 0x${command.toString(16)} packet (${finalPacket.length} bytes)`);
    return finalPacket;
  }

  /**
   * Calculate CRC8 for Wellue protocol
   */
  calculateCRC8(buffer) {
    const polynomial = 0x8C;
    let crc = 0x00;
    
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 0x80) {
          crc = ((crc << 1) ^ polynomial) & 0xFF;
        } else {
          crc = (crc << 1) & 0xFF;
        }
      }
    }
    
    return crc & 0xFF;
  }

  /**
   * Get real-time data command
   */
  getRealTimeDataCommand() {
    return this.createCommand(WELLUE_COMMANDS.GET_RT_DATA);
  }

  /**
   * Get device info command
   */
  getDeviceInfoCommand() {
    return this.createCommand(WELLUE_COMMANDS.GET_DEVICE_INFO);
  }

  /**
   * Get ping command for connection test
   */
  getPingCommand() {
    return this.createCommand(WELLUE_COMMANDS.PING);
  }

  /**
   * Reset packet counter
   */
  reset() {
    this.packetNumber = 0;
    this.deviceInfo = null;
  }
}

export default WellueProtocol;