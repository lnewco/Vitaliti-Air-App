/**
 * PacketParser - Abstract base class for packet parsers
 */

class PacketParser {
  constructor(name) {
    this.name = name;
    if (this.constructor === PacketParser) {
      throw new Error('PacketParser is abstract and cannot be instantiated directly');
    }
  }

  /**
   * Check if this parser can handle the given buffer
   * @abstract
   */
  canParse(buffer) {
    throw new Error('canParse() must be implemented by subclass');
  }

  /**
   * Parse the buffer into a reading object
   * @abstract
   */
  parse(buffer, rawData) {
    throw new Error('parse() must be implemented by subclass');
  }

  /**
   * Get parser name for debugging
   */
  getName() {
    return this.name;
  }

  /**
   * Convert buffer to hex string for debugging
   */
  bufferToHex(buffer, maxBytes = 20) {
    const bytes = Math.min(buffer.length, maxBytes);
    return Array.from(buffer.slice(0, bytes))
      .map(b => '0x' + b.toString(16).padStart(2, '0'))
      .join(' ');
  }
}

export default PacketParser;