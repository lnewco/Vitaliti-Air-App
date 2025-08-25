-- Create customer_integrations table for storing Oura and Whoop OAuth tokens
CREATE TABLE IF NOT EXISTS customer_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL CHECK (vendor IN ('oura', 'whoop')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  vendor_user_id TEXT, -- External user ID from Oura/Whoop
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, vendor)
);

-- Create health_metrics table for storing synced data
CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor TEXT NOT NULL CHECK (vendor IN ('oura', 'whoop')),
  metric_type TEXT NOT NULL,
  data JSONB NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_customer_integrations_user_vendor ON customer_integrations(user_id, vendor);
CREATE INDEX idx_health_metrics_user_vendor ON health_metrics(user_id, vendor);
CREATE INDEX idx_health_metrics_recorded_at ON health_metrics(recorded_at);
CREATE INDEX idx_health_metrics_metric_type ON health_metrics(metric_type);

-- Add RLS (Row Level Security) policies
ALTER TABLE customer_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own integrations
CREATE POLICY "Users can view own integrations" ON customer_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations" ON customer_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations" ON customer_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations" ON customer_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only see their own health metrics
CREATE POLICY "Users can view own health metrics" ON health_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health metrics" ON health_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_customer_integrations_updated_at
  BEFORE UPDATE ON customer_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();