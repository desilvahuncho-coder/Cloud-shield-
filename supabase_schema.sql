-- Create Organizations table (The MSP Account)
create table public.organizations (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create User Profiles table (Linked to Supabase Auth and an Organization)
create table public.users (
    id uuid references auth.users on delete cascade primary key,
    organization_id uuid references public.organizations(id) on delete cascade not null,
    email text not null,
    role text check (role in ('admin', 'member')) default 'member' not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.organizations enable row level security;
alter table public.users enable row level security;

-- RLS Policies for Organizations
create policy "Users can view their own organization" 
    on public.organizations for select 
    using (id in (select organization_id from public.users where id = auth.uid()));

-- RLS Policies for Users table
create policy "Users can view team members in the same organization" 
    on public.users for select 
    using (organization_id in (select organization_id from public.users where id = auth.uid()));

create policy "Admins can insert or update team members in their organization" 
    on public.users for all 
    using (
        organization_id in (select organization_id from public.users where id = auth.uid() and role = 'admin')
    );
