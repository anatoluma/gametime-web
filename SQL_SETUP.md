# Database Setup for Visitor Tracking

Run this SQL in your Supabase dashboard (SQL Editor) to create the necessary tables:

```sql
-- Create page_visits table
CREATE TABLE page_visits (
  id BIGSERIAL PRIMARY KEY,
  page_path TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_page_visits_created_at ON page_visits(created_at DESC);
CREATE INDEX idx_page_visits_page_path ON page_visits(page_path);
CREATE INDEX idx_page_visits_user_id ON page_visits(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - only admins can read
CREATE POLICY "Admins can read page_visits"
  ON page_visits FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create RLS policy - anyone/system can insert
CREATE POLICY "Anyone can insert page_visits"
  ON page_visits FOR INSERT
  WITH CHECK (TRUE);

-- Create a view for daily stats
CREATE VIEW daily_visitor_stats AS
SELECT 
  DATE(created_at) as visit_date,
  COUNT(DISTINCT ip_address) as unique_visitors,
  COUNT(*) as total_visits,
  COUNT(DISTINCT page_path) as pages_visited
FROM page_visits
GROUP BY DATE(created_at)
ORDER BY visit_date DESC;

-- Create a view for page stats
CREATE VIEW page_visit_stats AS
SELECT 
  page_path,
  COUNT(*) as visit_count,
  COUNT(DISTINCT ip_address) as unique_visitors,
  MAX(created_at) as last_visited
FROM page_visits
GROUP BY page_path
ORDER BY visit_count DESC;
```

After running this SQL:
1. The tables and views will be created
2. You can start logging page visits through the API
3. The admin dashboard will query these views for statistics
