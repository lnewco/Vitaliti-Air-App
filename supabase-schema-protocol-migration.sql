-- Vitaliti Air App - Protocol Configuration Migration
-- Add missing protocol configuration columns to sessions table
-- Run this in Supabase SQL Editor to fix the "hypoxic_duration" column error

-- Add IHHT protocol configuration fields to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'IHHT';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_phase TEXT; -- 'HYPOXIC' or 'HYPEROXIC' 
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_cycle INTEGER DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_cycles INTEGER DEFAULT 3;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hypoxic_duration INTEGER DEFAULT 420; -- 7 minutes in seconds (new default)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hyperoxic_duration INTEGER DEFAULT 180; -- 3 minutes in seconds (new default)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS default_hypoxia_level INTEGER DEFAULT 16; -- User's chosen hypoxia level for the session

-- Add FiO2 level tracking to readings table  
ALTER TABLE readings ADD COLUMN IF NOT EXISTS fio2_level INTEGER; -- 0-10 hypoxia level
ALTER TABLE readings ADD COLUMN IF NOT EXISTS phase_type TEXT; -- 'HYPOXIC' or 'HYPEROXIC'
ALTER TABLE readings ADD COLUMN IF NOT EXISTS cycle_number INTEGER; -- Which cycle this reading belongs to

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_sessions_session_type ON sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_sessions_current_phase ON sessions(current_phase);
CREATE INDEX IF NOT EXISTS idx_sessions_total_cycles ON sessions(total_cycles);
CREATE INDEX IF NOT EXISTS idx_readings_fio2_level ON readings(fio2_level);
CREATE INDEX IF NOT EXISTS idx_readings_phase_type ON readings(phase_type);
CREATE INDEX IF NOT EXISTS idx_readings_cycle_number ON readings(cycle_number);

-- Verify the columns were added successfully
DO $$
BEGIN
    -- Check if columns exist and report status
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'hypoxic_duration') THEN
        RAISE NOTICE '✅ Protocol configuration columns added successfully to sessions table';
    ELSE
        RAISE EXCEPTION '❌ Failed to add protocol configuration columns to sessions table';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'readings' AND column_name = 'fio2_level') THEN
        RAISE NOTICE '✅ FiO2 tracking columns added successfully to readings table';
    ELSE
        RAISE EXCEPTION '❌ Failed to add FiO2 tracking columns to readings table';
    END IF;
END $$; 