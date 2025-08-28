/**
 * StreamingParser - Handles streaming byte-by-byte data assembly
 */

import PacketParser from '../../base/PacketParser';

class StreamingParser extends PacketParser {
  constructor() {
    super('WellueStreaming');
    this.streamingBuffer = [];
    this.streamingStartTime = null;
    this.TIMEOUT_MS = 5000;
    this.PACKET_SIZE = 8;
  }

  canParse(buffer) {
    return buffer.length === 1;
  }

  parse(buffer, rawData) {
    const byte = buffer[0];
    
    // Initialize streaming if needed
    if (this.streamingBuffer.length === 0) {
      this.streamingStartTime = Date.now();
    }
    
    // Check for timeout
    if (Date.now() - this.streamingStartTime > this.TIMEOUT_MS) {
      this.reset();
      this.streamingStartTime = Date.now();
    }
    
    // Add byte to buffer
    this.streamingBuffer.push(byte);
    
    // Check if we have a complete packet
    if (this.streamingBuffer.length >= this.PACKET_SIZE) {
      const assembledBuffer = Buffer.from(this.streamingBuffer.slice(0, this.PACKET_SIZE));
      this.reset();
      
      // Return assembled buffer for re-parsing
      return {
        type: 'assembled',
        buffer: assembledBuffer,
        needsReparse: true
      };
    }
    
    // Still assembling
    return {
      type: 'streaming',
      bytesCollected: this.streamingBuffer.length,
      bytesNeeded: this.PACKET_SIZE - this.streamingBuffer.length
    };
  }

  reset() {
    this.streamingBuffer = [];
    this.streamingStartTime = null;
  }
}

export default StreamingParser;