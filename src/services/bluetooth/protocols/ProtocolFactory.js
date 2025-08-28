/**
 * ProtocolFactory - Factory for selecting appropriate protocol handler
 */

import WellueProtocol from './wellue/WellueProtocol';
import BCIProtocol from './bci/BCIProtocol';
import { WELLUE_UUIDS } from './wellue/WellueConstants';
import { BCI_UUIDS } from './bci/BCIConstants';

class ProtocolFactory {
  constructor() {
    this.protocols = new Map();
  }

  /**
   * Get or create protocol handler for device
   */
  getProtocolHandler(device) {
    const protocolType = this.identifyProtocol(device);
    
    if (!protocolType) {
      return null;
    }
    
    // Check cache
    const deviceId = device.id;
    if (this.protocols.has(deviceId)) {
      return this.protocols.get(deviceId);
    }
    
    // Create new handler
    let handler = null;
    switch (protocolType) {
      case 'wellue':
        handler = new WellueProtocol();
        break;
      case 'bci':
        handler = new BCIProtocol();
        break;
    }
    
    if (handler) {
      this.protocols.set(deviceId, handler);
    }
    
    return handler;
  }

  /**
   * Identify protocol type from device
   */
  identifyProtocol(device) {
    // Check by name patterns
    const name = device.name?.toLowerCase() || '';
    
    if (name.includes('oximeter') || 
        name.includes('o2ring') || 
        name.includes('checkme')) {
      return 'wellue';
    }
    
    if (name.includes('berry') || 
        name.includes('bci') || 
        name.includes('cms50')) {
      return 'bci';
    }
    
    // Check by service UUIDs
    if (device.serviceUUIDs) {
      const serviceUUIDs = device.serviceUUIDs.map(uuid => uuid.toLowerCase());
      
      if (serviceUUIDs.includes(WELLUE_UUIDS.SERVICE.toLowerCase())) {
        return 'wellue';
      }
      
      if (serviceUUIDs.includes(BCI_UUIDS.SERVICE.toLowerCase())) {
        return 'bci';
      }
    }
    
    // Default to Wellue for generic oximeters
    if (name.includes('oximeter') || name.includes('spo2')) {
      return 'wellue';
    }
    
    return null;
  }

  /**
   * Clear protocol handler for device
   */
  clearProtocol(deviceId) {
    if (this.protocols.has(deviceId)) {
      const handler = this.protocols.get(deviceId);
      if (handler.reset) {
        handler.reset();
      }
      this.protocols.delete(deviceId);
    }
  }

  /**
   * Clear all protocol handlers
   */
  clearAll() {
    for (const handler of this.protocols.values()) {
      if (handler.reset) {
        handler.reset();
      }
    }
    this.protocols.clear();
  }
}

export default new ProtocolFactory();