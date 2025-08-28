/**
 * BCIProtocol - Protocol handler for Berry Med BCI pulse oximeters
 */

import { Buffer } from 'buffer';
import PulseOxReading from '../base/PulseOxReading';
import DataValidator from '../base/DataValidator';
import logger from '../../../../utils/logger';
import { BCI_PACKET, BCI_PACKET_OFFSETS, BCI_STATUS_FLAGS } from './BCIConstants';

const log = logger.createModuleLogger('BCIProtocol');

class BCIProtocol {
  constructor() {
    this.packetBuffer = [];
    this.lastPacketTime = null;
  }

  /**
   * Parse incoming data from BCI device
   */
  parseData(base64Data) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Handle single byte streaming
      if (buffer.length === 1) {
        return this.handleStreamingByte(buffer[0], base64Data);
      }
      
      // Handle complete packet
      if (this.isValidPacket(buffer)) {
        return this.parsePacket(buffer, base64Data);
      }
      
      // Try to find valid packet within buffer
      const packet = this.findValidPacket(buffer);
      if (packet) {
        return this.parsePacket(packet, base64Data);
      }
      
      return null;
      
    } catch (error) {
      log.error('Error parsing BCI data:', error);
      return PulseOxReading.createError(base64Data);
    }
  }

  /**
   * Handle streaming byte-by-byte data
   */
  handleStreamingByte(byte, rawData) {
    // Reset if timeout
    if (this.lastPacketTime && Date.now() - this.lastPacketTime > 1000) {
      this.packetBuffer = [];
    }
    
    this.packetBuffer.push(byte);
    this.lastPacketTime = Date.now();
    
    // Check for complete packet
    if (this.packetBuffer.length >= BCI_PACKET.STANDARD_LENGTH) {
      // Find packet start
      const headerIndex = this.packetBuffer.indexOf(BCI_PACKET.HEADER);
      
      if (headerIndex >= 0 && 
          this.packetBuffer.length - headerIndex >= BCI_PACKET.STANDARD_LENGTH) {
        const packet = Buffer.from(
          this.packetBuffer.slice(headerIndex, headerIndex + BCI_PACKET.STANDARD_LENGTH)
        );
        
        // Clear used bytes
        this.packetBuffer = this.packetBuffer.slice(headerIndex + BCI_PACKET.STANDARD_LENGTH);
        
        return this.parsePacket(packet, rawData);
      }
    }
    
    return null;
  }

  /**
   * Check if buffer contains valid BCI packet
   */
  isValidPacket(buffer) {
    return buffer.length >= BCI_PACKET.MIN_LENGTH && 
           buffer[0] === BCI_PACKET.HEADER;
  }

  /**
   * Find valid packet within buffer
   */
  findValidPacket(buffer) {
    for (let i = 0; i <= buffer.length - BCI_PACKET.MIN_LENGTH; i++) {
      if (buffer[i] === BCI_PACKET.HEADER) {
        return buffer.slice(i, i + BCI_PACKET.MIN_LENGTH);
      }
    }
    return null;
  }

  /**
   * Parse BCI packet
   */
  parsePacket(buffer, rawData) {
    if (!this.isValidPacket(buffer)) {
      return null;
    }
    
    const status = buffer[BCI_PACKET_OFFSETS.STATUS];
    const pleth = buffer[BCI_PACKET_OFFSETS.PLETH];
    const spo2 = buffer[BCI_PACKET_OFFSETS.SPO2];
    const heartRate = buffer[BCI_PACKET_OFFSETS.PULSE];
    
    // Parse status flags
    const signalStrength = status & BCI_STATUS_FLAGS.SIGNAL_STRENGTH_MASK;
    const isProbeUnplugged = (status & BCI_STATUS_FLAGS.PROBE_UNPLUGGED) !== 0;
    const isPulseSearching = (status & BCI_STATUS_FLAGS.PULSE_SEARCHING) !== 0;
    const hasPulseBeep = (status & BCI_STATUS_FLAGS.PULSE_BEEP) !== 0;
    
    // Check probe status
    if (isProbeUnplugged || spo2 === 127 || heartRate === 255) {
      return PulseOxReading.createNoFinger({
        signalStrength,
        pleth,
        rawData,
        protocol: 'bci'
      });
    }
    
    // Check if searching
    if (isPulseSearching || heartRate === 0 || spo2 === 0) {
      return PulseOxReading.createSearching({
        signalStrength,
        pleth,
        rawData,
        protocol: 'bci'
      });
    }
    
    // Validate readings
    const validation = DataValidator.validateReading(spo2, heartRate);
    
    if (validation.isValid) {
      return PulseOxReading.createValid(
        DataValidator.sanitizeSpO2(spo2),
        DataValidator.sanitizeHeartRate(heartRate),
        {
          signalStrength,
          pleth,
          hasPulseBeep,
          rawData,
          protocol: 'bci'
        }
      );
    }
    
    return null;
  }

  /**
   * Reset parser state
   */
  reset() {
    this.packetBuffer = [];
    this.lastPacketTime = null;
  }
}

export default BCIProtocol;