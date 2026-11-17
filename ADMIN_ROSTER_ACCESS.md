# Admin Direct Roster & Photo Upload Access

## Summary
Added a direct button to the admin dashboard (`/admin`) that allows admins to access roster editing and player photo uploading without needing to generate temporary links.

## Changes Made

### 1. Admin Dashboard (`src/app/admin/page.tsx`)
- Added new button: **"Edit rosters & player photos"** that links to `/manager`
- Positioned after "Season rosters" button in the navigation menu
- Uses same styling as other admin buttons for consistency

### 2. Manager Layout (`src/app/manager/layout.tsx`)
- Enhanced authentication logic to allow both team managers AND admins
- Now checks for admin access via `/api/admin/teams` endpoint if team manager check fails
- Added an "Admin roster access" header bar with a "Back to admin" link when accessed by an admin
- This provides clear indication when an admin is using the manager features

### 3. Manager Page (`src/app/manager/page.tsx`)
- Updated team loading logic to handle both team managers and admins
- If `/api/manager/me` returns unauthorized, it falls back to `/api/admin/teams`
- Admins can now see all teams and edit rosters for any team
- Uses the same roster editing and photo upload functionality

## How It Works

### For Regular Team Managers
- Unchanged behavior - they access `/manager` via temporary links
- Only see teams they manage via `team_managers` table

### For Admins
1. Click "Edit rosters & player photos" button on admin dashboard
2. Redirected to `/manager` page with admin credentials
3. See all teams (via `/api/admin/teams` instead of `/api/manager/me`)
4. Can edit rosters and upload player photos for any team
5. Header bar indicates this is "Admin roster access" with link back to admin dashboard

## Technical Details

### Authentication Flow
```
Manager Layout checks:
├─ User has valid Supabase session? ✓
├─ Call /api/manager/me (checks team_managers table)
│  ├─ If OK → Regular team manager, proceed
│  └─ If Unauthorized → Check admin access
│      └─ Call /api/admin/teams (checks ADMIN_EMAILS env var)
│         ├─ If OK → Admin, set isAdmin=true, proceed
│         └─ If Unauthorized → Forbidden error
```

### API Endpoints Used
- `/api/manager/me` - Returns teams user manages
- `/api/admin/teams` - Returns all teams (admin only)
- `/api/manager/roster` - Edit roster (works for both admins and managers)
- `/api/manager/photo` - Upload player photos (works for both admins and managers)

## Configuration
No new environment variables needed. Uses existing:
- `ADMIN_EMAILS` - Comma-separated list of admin email addresses
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase credentials

## Testing
✅ ESLint validation passed on all modified files
✅ Build succeeded without errors
✅ Both `/admin` and `/manager` pages load successfully
✅ Existing team manager functionality preserved
✅ Admin access added without breaking existing features

## Backward Compatibility
- Fully backward compatible
- Temporary links still work as before
- Team managers can still use temporary links if preferred
- No database schema changes
- No breaking changes to existing APIs
