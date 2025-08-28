/**
 * WellueConstants - Protocol constants for Wellue devices
 */

export const WELLUE_UUIDS = {
  SERVICE: '14839ac4-7d7e-415c-9a42-167340cf2339',
  TX_CHARACTERISTIC: '0734594a-a8e7-4b1a-a6b1-cd5243059a57', // Read/Notify
  RX_CHARACTERISTIC: '8b00ace7-eb0b-49b0-bbe9-9aee0a26e1a3'  // Write
};

export const WELLUE_HEADERS = {
  COMMAND: 0xAA,  // Command packet header
  ACK: 0x55       // Response packet header  
};

export const WELLUE_COMMANDS = {
  GET_FILE_START: 0x03,
  GET_FILE_DATA: 0x04,
  GET_FILE_END: 0x05,
  GET_DEVICE_INFO: 0x14,
  PING: 0x15,
  PARA_SYNC: 0x16,
  GET_RT_DATA: 0x17,    // Real-time data
  FACTORY_RESET: 0x18,
  GET_RT_WAVE: 0x1B,    // Real-time waveform
  GET_RT_PPG: 0x1C      // Raw PPG data
};

export const WELLUE_ACK_STATUS = {
  SUCCESS: 0x00,
  FAILURE: 0x01
};

export const WELLUE_PACKET_OFFSETS = {
  // Real-time data packet offsets (13-byte format)
  RT_SPO2: 0,
  RT_PULSE_LOW: 1,
  RT_PULSE_HIGH: 2,
  RT_STEPS: 3,      // 4 bytes
  RT_BATTERY: 7,
  RT_CHARGE_STATUS: 8,
  RT_ACCELERATION: 9,
  RT_PI: 10,
  RT_WEAR_STATUS: 11,
  
  // 8-byte packet offsets
  BYTE8_STATUS: 0,
  BYTE8_PLETH: 1,
  BYTE8_BARGRAPH: 2,
  BYTE8_PI: 3,
  BYTE8_SPO2: 4,
  BYTE8_PULSE: 5
};

export const WELLUE_STATUS_FLAGS = {
  // Status byte bit masks (8-byte format)
  FINGER_OUT: 0x10,      // Bit 4: 1=finger out
  SEARCHING: 0x08,        // Bit 3: 1=searching for pulse
  LOW_PERFUSION: 0x02,    // Bit 1: 1=low PI
  MOTION: 0x01,          // Bit 0: 1=motion detected
  
  // Wear status bit masks
  WEARING: 0x01          // Bit 0: 1=wearing device
};

export const WELLUE_CHARGE_STATUS = {
  NOT_CHARGING: 0,
  CHARGING: 1,
  FULLY_CHARGED: 2
};