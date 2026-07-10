-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Organizations Table (Multi-tenant boundary)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Users Table (Custom profiles linking to Supabase Auth)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create AWS Connections Table (Secure STS connection parameters)
CREATE TABLE public.aws_connections (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    iam_role_arn TEXT NOT NULL,
    external_id TEXT NOT NULL UNIQUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Audit Logs Table (Full seat attribution tracking)
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL, -- e.g., 'stop_instance'
    target_resource_id TEXT NOT NULL, -- e.g., 'i-0abc123'
    savings_reclaimed NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable Row-Level Security (RLS) across all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aws_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 7. Define Security Policies (Ensuring users only see data within their shared org)
CREATE POLICY "Users can view their own organization" 
    ON public.organizations FOR SELECT 
    USING (id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can read fellow team members in their organization" 
    ON public.users FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can invite or modify users in their organization" 
    ON public.users FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can read connection credentials for their organization" 
    ON public.aws_connections FOR SELECT 
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Admins can manage connections for their organization" 
    ON public.aws_connections FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can read/write audit logs for their organization" 
    ON public.audit_logs FOR ALL 
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));
