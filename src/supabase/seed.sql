-- Sample seed data for Konekt Platform
-- Run this in Supabase SQL Editor after running schema.sql

-- Insert sample DSOs
INSERT INTO dsos (id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Smile Dental Group'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Bright Teeth Partners'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Dental Care Associates');

-- Insert sample doctors
INSERT INTO doctors (id, dso_id, name, email, phone, start_date, status, notes) VALUES
  (
    '650e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'Dr. Sarah Johnson',
    'sarah.johnson@example.com',
    '555-0101',
    '2024-01-15',
    'active',
    'New graduate, very enthusiastic'
  ),
  (
    '650e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'Dr. Michael Chen',
    'michael.chen@example.com',
    '555-0102',
    '2024-02-01',
    'active',
    'Experienced, transitioning from private practice'
  ),
  (
    '650e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440002',
    'Dr. Emily Rodriguez',
    'emily.rodriguez@example.com',
    '555-0103',
    '2024-03-10',
    'active',
    'Strong technical skills'
  ),
  (
    '650e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440002',
    'Dr. James Wilson',
    'james.wilson@example.com',
    '555-0104',
    '2023-11-01',
    'active',
    'Needs additional support with digital tools'
  ),
  (
    '650e8400-e29b-41d4-a716-446655440005',
    '550e8400-e29b-41d4-a716-446655440003',
    'Dr. Lisa Anderson',
    'lisa.anderson@example.com',
    '555-0105',
    '2024-04-20',
    'active',
    'Quick learner, proactive'
  );

-- Insert sample period progress for Dr. Sarah Johnson
INSERT INTO period_progress (doctor_id, period_number, start_date, end_date, cases_submitted, courses_completed) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 1, '2024-01-15', '2024-02-14', 5, 2),
  ('650e8400-e29b-41d4-a716-446655440001', 2, '2024-02-15', '2024-03-14', 8, 3),
  ('650e8400-e29b-41d4-a716-446655440001', 3, '2024-03-15', '2024-04-14', 12, 2),
  ('650e8400-e29b-41d4-a716-446655440001', 4, '2024-04-15', '2024-05-14', 10, 4),
  ('650e8400-e29b-41d4-a716-446655440001', 5, '2024-05-15', '2024-06-14', 15, 3),
  ('650e8400-e29b-41d4-a716-446655440001', 6, '2024-06-15', '2024-07-14', 14, 2),
  ('650e8400-e29b-41d4-a716-446655440001', 7, '2024-07-15', '2024-08-14', 18, 5),
  ('650e8400-e29b-41d4-a716-446655440001', 8, '2024-08-15', '2024-09-14', 16, 3),
  ('650e8400-e29b-41d4-a716-446655440001', 9, '2024-09-15', '2024-10-14', 20, 4),
  ('650e8400-e29b-41d4-a716-446655440001', 10, '2024-10-15', '2024-11-14', 22, 3),
  ('650e8400-e29b-41d4-a716-446655440001', 11, '2024-11-15', '2024-12-14', 5, 1),
  ('650e8400-e29b-41d4-a716-446655440001', 12, '2024-12-15', '2025-01-14', 0, 0);

-- Insert sample period progress for Dr. Michael Chen
INSERT INTO period_progress (doctor_id, period_number, start_date, end_date, cases_submitted, courses_completed) VALUES
  ('650e8400-e29b-41d4-a716-446655440002', 1, '2024-02-01', '2024-03-01', 3, 1),
  ('650e8400-e29b-41d4-a716-446655440002', 2, '2024-03-02', '2024-04-01', 6, 2),
  ('650e8400-e29b-41d4-a716-446655440002', 3, '2024-04-02', '2024-05-01', 8, 2),
  ('650e8400-e29b-41d4-a716-446655440002', 4, '2024-05-02', '2024-06-01', 10, 3),
  ('650e8400-e29b-41d4-a716-446655440002', 5, '2024-06-02', '2024-07-01', 12, 2),
  ('650e8400-e29b-41d4-a716-446655440002', 6, '2024-07-02', '2024-08-01', 14, 4),
  ('650e8400-e29b-41d4-a716-446655440002', 7, '2024-08-02', '2024-09-01', 16, 3),
  ('650e8400-e29b-41d4-a716-446655440002', 8, '2024-09-02', '2024-10-01', 18, 3),
  ('650e8400-e29b-41d4-a716-446655440002', 9, '2024-10-02', '2024-11-01', 20, 4),
  ('650e8400-e29b-41d4-a716-446655440002', 10, '2024-11-02', '2024-12-01', 8, 2),
  ('650e8400-e29b-41d4-a716-446655440002', 11, '2024-12-02', '2025-01-01', 0, 0),
  ('650e8400-e29b-41d4-a716-446655440002', 12, '2025-01-02', '2025-02-01', 0, 0);

-- Insert sample activities
INSERT INTO activities (doctor_id, activity_type, description, created_by, created_at) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'call', 'Initial onboarding call - discussed program expectations', 'admin@konekt.com', NOW() - INTERVAL '30 days'),
  ('650e8400-e29b-41d4-a716-446655440001', 'email', 'Sent welcome package and course materials', 'admin@konekt.com', NOW() - INTERVAL '28 days'),
  ('650e8400-e29b-41d4-a716-446655440001', 'meeting', 'Monthly check-in - progress review', 'admin@konekt.com', NOW() - INTERVAL '15 days'),
  ('650e8400-e29b-41d4-a716-446655440001', 'case_review', 'Reviewed first 5 cases - excellent quality', 'admin@konekt.com', NOW() - INTERVAL '10 days'),
  ('650e8400-e29b-41d4-a716-446655440001', 'email', 'Follow-up on course completion', 'admin@konekt.com', NOW() - INTERVAL '2 days'),
  
  ('650e8400-e29b-41d4-a716-446655440002', 'call', 'Onboarding call completed', 'admin@konekt.com', NOW() - INTERVAL '25 days'),
  ('650e8400-e29b-41d4-a716-446655440002', 'training', 'Digital workflow training session', 'admin@konekt.com', NOW() - INTERVAL '20 days'),
  ('650e8400-e29b-41d4-a716-446655440002', 'meeting', 'Monthly progress review', 'admin@konekt.com', NOW() - INTERVAL '12 days'),
  
  ('650e8400-e29b-41d4-a716-446655440003', 'call', 'Welcome call - very engaged', 'admin@konekt.com', NOW() - INTERVAL '5 days'),
  ('650e8400-e29b-41d4-a716-446655440003', 'email', 'Sent onboarding materials', 'admin@konekt.com', NOW() - INTERVAL '4 days'),
  
  ('650e8400-e29b-41d4-a716-446655440004', 'call', 'Initial contact', 'admin@konekt.com', NOW() - INTERVAL '45 days'),
  ('650e8400-e29b-41d4-a716-446655440004', 'email', 'Follow-up email - no response', 'admin@konekt.com', NOW() - INTERVAL '30 days'),
  
  ('650e8400-e29b-41d4-a716-446655440005', 'call', 'Onboarding call scheduled', 'admin@konekt.com', NOW() - INTERVAL '1 day'),
  ('650e8400-e29b-41d4-a716-446655440005', 'email', 'Welcome email sent', 'admin@konekt.com', NOW() - INTERVAL '1 day');

-- Insert task groups
INSERT INTO task_groups (id, name, description, order_index) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 'Week 1: Onboarding', 'Initial setup and orientation', 1),
  ('750e8400-e29b-41d4-a716-446655440002', 'Month 1-3: Foundation', 'Building core skills', 2),
  ('750e8400-e29b-41d4-a716-446655440003', 'Month 4-6: Development', 'Advanced training', 3),
  ('750e8400-e29b-41d4-a716-446655440004', 'Month 7-12: Mastery', 'Independent practice', 4);

-- Insert sample tasks
INSERT INTO tasks (task_group_id, title, description, status, order_index) VALUES
  ('750e8400-e29b-41d4-a716-446655440001', 'Complete welcome call', 'Initial orientation call with CS team', 'completed', 1),
  ('750e8400-e29b-41d4-a716-446655440001', 'Review program materials', 'Read through onboarding guide', 'completed', 2),
  ('750e8400-e29b-41d4-a716-446655440001', 'Set up digital tools', 'Configure practice management software', 'in_progress', 3),
  
  ('750e8400-e29b-41d4-a716-446655440002', 'Submit first 5 cases', 'Complete and submit initial cases', 'in_progress', 1),
  ('750e8400-e29b-41d4-a716-446655440002', 'Complete Course 101', 'Fundamentals of digital dentistry', 'completed', 2),
  ('750e8400-e29b-41d4-a716-446655440002', 'Monthly check-in meeting', 'Progress review with CS manager', 'pending', 3),
  
  ('750e8400-e29b-41d4-a716-446655440003', 'Advanced case training', 'Complex case management', 'pending', 1),
  ('750e8400-e29b-41d4-a716-446655440003', 'Peer collaboration session', 'Join monthly peer group', 'pending', 2),
  
  ('750e8400-e29b-41d4-a716-446655440004', 'Independent practice review', 'Self-assessment and reflection', 'pending', 1),
  ('750e8400-e29b-41d4-a716-446655440004', 'Graduation evaluation', 'Final program assessment', 'pending', 2);

-- Note: You'll need to manually create user_dso_access records after users sign up
-- Example:
-- INSERT INTO user_dso_access (user_id, dso_id, role) VALUES
--   ('your-user-id-from-auth', '550e8400-e29b-41d4-a716-446655440001', 'admin');
