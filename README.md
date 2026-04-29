# Cozy Concierge Starter

This is a starter scaffold for **Cozy Concierge powered by Cozy Adventure Vacations**.

## Quick start

1. Copy `.env.example` to `.env.local`
2. Add your Supabase project URL and anon key
3. Run:
   - `npm install`
   - `npm run dev`

## Important
This scaffold includes:
- route structure
- shared layouts
- placeholder screens
- basic Supabase client utilities
- simple role guard placeholders

It does **not** yet include:
- full auth flow wiring
- row-level security policies
- production styling system
- full CRUD forms
- API/server actions for all writes

## Route summary

### Public
- `/login`
- `/forgot-password`
- `/reset-password`

### Client
- `/dashboard`
- `/profile`
- `/traveler-information`
- `/trips`
- `/trips/[tripId]`
- `/trips/[tripId]/request-payment`
- `/request-quote`

### Admin
- `/admin/dashboard`
- `/admin/clients`
- `/admin/clients/[clientId]`
- `/admin/trips`
- `/admin/trips/new`
- `/admin/trips/[tripId]`
- `/admin/quote-requests`
- `/admin/quote-requests/[requestId]`
- `/admin/payment-requests`
- `/admin/payment-requests/[requestId]`
- `/admin/email-automations`
