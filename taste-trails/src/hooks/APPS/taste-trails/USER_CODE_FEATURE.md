# User Code Feature - Discover People by 5-Digit Code

## Overview
Each user now has a unique 5-digit code (e.g., `12345`) that makes it easy to find and connect with friends.

## Features
- ✅ Unique 5-digit code for every user
- ✅ Search by name OR code in Discover People
- ✅ Auto-generated on signup
- ✅ Display code in user profiles
- ✅ Privacy-aware (respects private profiles)

## Database Setup

### For New Installations
Run the updated schema:
```sql
-- Use sql/create_users_table.sql
```

### For Existing Databases
Run the migration to add codes to existing users:
```sql
-- In Supabase SQL Editor, run:
-- sql/add_user_code_column.sql
```

This will:
1. Add the `user_code` column
2. Create an index for fast searches
3. Generate unique codes for all existing users

## API Changes

### Discover Endpoint Enhanced
**GET** `/discover/users?name=<searchTerm>`

Now searches by:
- **Name** (partial match): `/discover/users?name=john`
- **5-digit code** (exact match): `/discover/users?name=12345`

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "user_code": "12345"
  }
]
```

### Profile Endpoints Updated
All profile endpoints now include `user_code`:
- `GET /auth/me` - Returns your profile with code
- `PUT /auth/profile` - View code in response
- Auto-generated on signup

## Frontend Component

### DiscoverPeople.jsx
Located in: `src/components/DiscoverPeople.jsx`

Features:
- Search by name or code
- Live search as you type
- Displays user code next to name
- "View" button for profile navigation

Example display:
```
John Doe #12345    [View]
```

## Usage

### Share Your Code
Users can share their 5-digit code to be easily found:
- "Add me: **12345**"
- Quick friend discovery
- No need to remember full usernames

### Search for Friends
1. Open Discover People
2. Type name: `john` → Shows all Johns
3. Type code: `12345` → Shows exact match

## Technical Details

### Code Generation
- **Format:** 5 digits (10000-99999)
- **Uniqueness:** Checked against database
- **Fallback:** Timestamp-based if collision
- **Index:** Fast searches via `users_code_idx`

### Privacy
- Private profiles excluded from search
- Code remains private if profile is private
- Only public users discoverable

## Testing

### Test the API
```powershell
# Search by name
Invoke-RestMethod "http://localhost:8081/discover/users?name=john"

# Search by code (5 digits)
Invoke-RestMethod "http://localhost:8081/discover/users?name=12345"
```

### Expected Response
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "user_code": "12345"
  }
]
```

## Files Modified
- ✅ `server/index.js` - Added code generation & search
- ✅ `sql/create_users_table.sql` - Schema with user_code
- ✅ `sql/add_user_code_column.sql` - Migration script
- ✅ `src/components/DiscoverPeople.jsx` - UI component

## Next Steps
1. Run migration: `sql/add_user_code_column.sql`
2. Restart server: `npm run server`
3. Test discover endpoint
4. Add DiscoverPeople component to your app
5. Display user code in profiles
