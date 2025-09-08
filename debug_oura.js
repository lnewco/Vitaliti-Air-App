const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://nklaxqedgufqjojrmbpr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rbGF4cWVkZ3VmcWpvanJtYnByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ4NzgzNzgsImV4cCI6MjA0MDQ1NDM3OH0.Lg4DZyMXKtZgYNrsrJdNTtuwxHGfmqjsY-qRk7Wv7hg'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugOuraData() {
  console.log('🔍 Checking Oura data...')
  
  // Get sample Oura sleep record
  const { data: sleepData, error: sleepError } = await supabase
    .from('health_metrics')
    .select('recorded_at, data')
    .eq('user_id', 'da754dc4-e0bb-45f3-8547-71c2a6f2786c')
    .eq('vendor', 'oura')
    .eq('metric_type', 'sleep')
    .limit(1)
  
  if (sleepError) {
    console.error('Sleep query error:', sleepError)
    return
  }
  
  console.log('📊 Sample Oura sleep data:')
  console.log(JSON.stringify(sleepData[0], null, 2))
  
  // Get all Oura data count and date range
  const { data: allOura, error: allError } = await supabase
    .from('health_metrics')
    .select('recorded_at, metric_type')
    .eq('user_id', 'da754dc4-e0bb-45f3-8547-71c2a6f2786c')
    .eq('vendor', 'oura')
    .order('recorded_at', { ascending: true })
  
  if (allError) {
    console.error('All data query error:', allError)
    return
  }
  
  console.log(`\n📅 Total Oura records: ${allOura.length}`)
  console.log(`📅 Date range: ${allOura[0]?.recorded_at} to ${allOura[allOura.length - 1]?.recorded_at}`)
  
  // Group by metric type
  const grouped = allOura.reduce((acc, record) => {
    acc[record.metric_type] = (acc[record.metric_type] || 0) + 1
    return acc
  }, {})
  
  console.log('📊 Records by type:', grouped)
}

debugOuraData().catch(console.error)