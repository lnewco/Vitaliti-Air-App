/**
 * BCIConstants - Protocol constants for Berry Med BCI devices
 */

export const BCI_UUIDS = {
  SERVICE: '49535343-FE7D-4AE5-8FA9-9FAFD205E455',
  DATA_CHARACTERISTIC: '49535343-1E4D-4BD9-BA61-23C647249616',  // Device → App (notify)
  COMMAND_CHARACTERISTIC: '49535343-8841-43F4-A8D4-ECBE34729BB3' // App → Device
};

export const BCI_PACKET = {
  HEADER: 0xAA,        // Standard packet header
  MIN_LENGTH: 5,       // Minimum packet size
  STANDARD_LENGTH: 5   // Standard 5-byte packet
};

export const BCI_PACKET_OFFSETS = {
  HEADER: 0,
  STATUS: 1,
  PLETH: 2,
  SPO2: 3,
  PULSE: 4
};

export const BCI_STATUS_FLAGS = {
  SIGNAL_STRENGTH_MASK: 0x0F,  // Lower 4 bits
  PULSE_BEEP: 0x40,            // Bit 6
  PROBE_UNPLUGGED: 0x20,       // Bit 5
  PULSE_SEARCHING: 0x10        // Bit 4
};