# Setup Instructions

## Database Setup Required

Before the follow request and private profile features will work, you need to run the following SQL scripts in your Supabase SQL Editor:

### Step 1: Go to your Supabase Dashboard
1. Open https://supabase.com/dashboard
2. Select your project: `civeujuggufkpdlennuq`
3. Click on "SQL Editor" in the left sidebar

### Step 2: Run SQL Scripts (in order)

Run these scripts one at a time by copying their content and executing in the SQL Editor:

1. **backend/sql/create_users_table.sql** - Creates users table with roles
2. **backend/sql/create_restaurants_table.sql** - Creates restaurants menu cache
3. **backend/sql/create_ratings_table.sql** - Creates ratings system (1-10 scale)
4. **backend/sql/create_admin_logs_table.sql** - Creates admin action logs
5. **backend/sql/create_posts_table.sql** - Creates user posts system
6. **backend/sql/create_follow_system.sql** - ⭐ NEW! Creates follow requests and private profile system

### Step 3: Verify Setup

After running all scripts, verify:
- Go to "Table Editor" in Supabase
- You should see tables: `users`, `restaurants`, `ratings`, `admin_logs`, `posts`, `follow_requests`, `follows`

## Features Now Available

### ✅ Display Name Changes
- Go to Settings → Account tab
- Change your display name
- Click "Save Changes"
- Your name will update everywhere in the app and be visible to others

### ✅ Private Profile System
- Go to Settings → Privacy tab
- Toggle "Make My Profile Private"
- When private:
  - People need to request to view your profile
  - You approve/decline requests in the Notifications tab (heart icon)
  - Only approved followers can see your posts and ratings

### ✅ Follow Requests
- When someone tries to follow your private profile, you'll get a notification
- Click the heart icon in the header
- You'll see "Follow Requests" section at the top
- Click "Approve" or "Decline" for each request
- Approved followers can view your private content

## Backend Endpoints Added

- `PUT /auth/profile` - Update display name, email, or privacy settings
- `POST /api/follow-requests` - Send a follow request
- `GET /api/follow-requests` - Get pending follow requests
- `PUT /api/follow-requests/:id` - Approve or reject a request
- `POST /api/follows` - Follow a user (auto-created when request approved)

## Notes

- Your backend is running on port 8787
- Your frontend is running on port 5173
- Make sure both servers stay running
- The "Hide my ratings from public" toggle was removed because private profile accomplishes the same goal
