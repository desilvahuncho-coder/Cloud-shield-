# CloudShield Production Infrastructure Variables

Add these exact environment keys to your Vercel Project Settings (under Environment Variables) to complete the security configuration for your secure cloud cost tool.

## 🔐 1. Internal Application Access Keys (AWS STS Handshake)
These credentials belong to the central application account. They only have permission to issue a server-side request to assume the short-lived 1-hour customer roles.

- `CLOUDSHIELD_INTERNAL_AWS_KEY`: The access key identifier string for your core application container.
- `CLOUDSHIELD_INTERNAL_AWS_SECRET`: The secret key matching your application container user.

## ⚡ 2. Shared Data Engine Identifiers (Supabase Client Access)
These connection values map your individual user seats to their Row Level Security (RLS) data models.

- `NEXT_PUBLIC_SUPABASE_URL`: The online web address code pointing to your Supabase project instance.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The public anonymous safe entry key used by the frontend to monitor active user sessions.
