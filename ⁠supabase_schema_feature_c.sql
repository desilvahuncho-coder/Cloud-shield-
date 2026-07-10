-- Create the Audit Log table to track historical savings actions
create table public.audit_logs (
    id uuid default gen_random_uuid() primary key,
    organization_id uuid references public.organizations(id) on delete cascade not null,
    user_id uuid references public.users(id) on delete cascade not null,
    resource_id text not null,
    action_taken text not null,
    estimated_savings numeric(10,2) default 0.00 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.audit_logs enable row level security;

-- RLS Policy: Ensure all 3 user seats can view logs belonging to their organization
create policy "Users can view audit logs for their organization"
    on public.audit_logs for select
    using (organization_id in (select organization_id from public.users where id = auth.uid()));
