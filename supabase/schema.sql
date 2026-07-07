-- Create the primary Organization (the MSP)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Extend default auth by linking users to an organization
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store short-lived credential connections
CREATE TABLE aws_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    iam_role_arn TEXT NOT NULL,
    external_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security audit trail for action attribution
CREATE TABLE optimization_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    resource_id TEXT NOT NULL,
    action_taken TEXT NOT NULL,
    estimated_savings NUMERIC(10, 2) NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE aws_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create basic RLS Policies 
CREATE POLICY "Users can view their own organization context"
    ON organizations FOR SELECT
    USING (id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage profiles within their organization"
    ON users FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can access their shared AWS connections"
    ON aws_connections FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can view and add logs inside their organization boundary"
    ON optimization_audit_logs FOR ALL
    USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
