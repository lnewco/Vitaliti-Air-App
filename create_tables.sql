-- Run this in Supabase SQL Editor

-- Create customer_integrations table
CREATE TABLE IF NOT EXISTS customer_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL CHECK (vendor IN ('oura', 'whoop')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  vendor_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vendor)
);

-- Create health_metrics table
CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL CHECK (vendor IN ('oura', 'whoop')),
  metric_type TEXT NOT NULL,
  data JSONB NOT NULL,
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_integrations_user_vendor ON customer_integrations(user_id, vendor);
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_vendor ON health_metrics(user_id, vendor);
CREATE INDEX IF NOT EXISTS idx_health_metrics_recorded_at ON health_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_health_metrics_metric_type ON health_metrics(metric_type);

-- Enable RLS
ALTER TABLE customer_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_integrations
CREATE POLICY "Users can view own integrations" ON customer_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations" ON customer_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" ON customer_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations" ON customer_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for health_metrics
CREATE POLICY "Users can view own health metrics" ON health_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health metrics" ON health_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);