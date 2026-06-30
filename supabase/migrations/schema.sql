-- 1. Create Organizations Table (The Pilot MSP)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Users Profile Table (Tied directly to Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create AWS Connections Table (Shared across all 3 user seats)
CREATE TABLE aws_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    iam_role_arn TEXT NOT NULL,
    external_id TEXT NOT NULL, -- Prevents the confused deputy exploit
    status TEXT DEFAULT 'active',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Audit Logs Table (Individual Seat Attribution)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL, -- Tracks exactly who clicked confirm
    resource_id TEXT NOT NULL,
    action_taken TEXT NOT NULL DEFAULT 'ec2:StopInstances',
    estimated_savings NUMERIC(10, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENFORCE SECURITY: Enable Row Level Security (RLS) on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- HELPER SECURITY FUNCTION: Extract user's organization context from JWT
CREATE OR REPLACE FUNCTION get_user_org()
RETURNS UUID AS $$
    SELECT organization_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- APPLY ISOLATION POLICIES
CREATE POLICY org_isolation ON organizations 
    FOR ALL USING (id = get_user_org());

CREATE POLICY user_isolation ON users 
    FOR ALL USING (organization_id = get_user_org());

CREATE POLICY aws_conn_isolation ON aws_connections 
    FOR ALL USING (organization_id = get_user_org());

CREATE POLICY audit_isolation ON audit_logs 
    FOR ALL USING (organization_id = get_user_org());
