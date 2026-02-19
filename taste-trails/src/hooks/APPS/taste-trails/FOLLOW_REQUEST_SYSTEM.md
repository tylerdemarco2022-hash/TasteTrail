# Instagram-Style Follow Request System

Complete implementation of private accounts with follow requests, similar to Instagram.

## 🎯 Features

### Private Accounts
- Users can toggle their account to private in Settings
- Private accounts show a lock icon 🔒 on their profile
- Content is hidden from non-followers with "This account is private" message
- Admin role bypasses all privacy restrictions

### Follow Request Flow

#### For Public Accounts (is_private = false)
1. User clicks "Follow" button
2. Backend creates direct follow relationship in `follows` table
3. Follower immediately gains access to content
4. Button shows "Following" state

#### For Private Accounts (is_private = true)
1. User clicks "Follow" button → changes to "Request to Follow"
2. Backend creates `follow_request` with status='pending'
3. Target user sees request in Notifications tab
4. Target user can:
   - **Accept**: Creates follow relationship + updates request status to 'accepted'
   - **Decline**: Updates request status to 'declined' (no follow created)
5. Requester can send new request after decline (re-request allowed)

## 📊 Database Schema

### follows table
```sql
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES auth.users(id) NOT NULL,
  following_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);
```

### follow_requests table
```sql
CREATE TABLE follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users(id) NOT NULL,
  target_id UUID REFERENCES auth.users(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, target_id)
);
```

## 🔌 Backend Endpoints

### POST /api/users/:userId/follow
Send a follow request or create direct follow

**Request:**
```javascript
POST /api/users/123/follow
Authorization: Bearer <token>
```

**Response (Private Account):**
```json
{
  "status": "pending",
  "message": "Follow request sent",
  "requestId": "uuid-123"
}
```

**Response (Public Account):**
```json
{
  "status": "following",
  "message": "Now following user"
}
```

### DELETE /api/users/:userId/follow
Unfollow a user

**Request:**
```javascript
DELETE /api/users/123/follow
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Unfollowed successfully"
}
```

### GET /api/follow-requests/incoming
Get incoming follow requests for current user

**Request:**
```javascript
GET /api/follow-requests/incoming
Authorization: Bearer <token>
```

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid-123",
      "status": "pending",
      "created_at": "2025-01-15T10:00:00Z",
      "requester": {
        "id": "uuid-456",
        "name": "John Doe",
        "user_code": "johndoe123"
      }
    }
  ]
}
```

### PUT /api/follow-requests/:requestId/accept
Accept a follow request

**Request:**
```javascript
PUT /api/follow-requests/uuid-123/accept
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Follow request accepted",
  "status": "accepted"
}
```

**Effect:**
- Updates follow_request.status to 'accepted'
- Creates follow relationship in follows table
- Requester can now view target's content

### PUT /api/follow-requests/:requestId/decline
Decline a follow request

**Request:**
```javascript
PUT /api/follow-requests/uuid-123/decline
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Follow request declined",
  "status": "declined"
}
```

**Effect:**
- Updates follow_request.status to 'declined'
- NO follow relationship created
- Requester can send a new request later

## 🎨 Frontend Components

### UserProfile.jsx
Displays other users' profiles with privacy controls

**Key Features:**
- Shows lock icon for private accounts
- "Follow" button for public accounts → direct follow
- "Request to Follow" button for private accounts → sends request
- "Requested" state shows pending request status
- Hides content with "This account is private" message for unauthorized viewers

**States:**
```javascript
isFollowing: false/true
followRequestStatus: null/'pending'/'accepted'/'declined'
```

### Profile.jsx
User's own profile with privacy toggle

**Key Features:**
- Privacy toggle button with Lock/Unlock icons
- Visual feedback: green for public, gray for private
- Saves to backend: PUT /auth/profile with is_private flag

### Notifications.jsx
Shows incoming follow requests with Accept/Decline buttons

**Key Features:**
- Loads pending requests on mount
- Accept button → calls /api/follow-requests/:id/accept
- Decline button → calls /api/follow-requests/:id/decline
- Removes request from list after action
- Shows requester name, user_code, and timestamp

### FollowRequests.jsx (standalone component)
Dedicated component for managing follow requests

**Key Features:**
- Can be used in notifications tab or as separate page
- Shows empty state with UserPlus icon when no requests
- Accept/Decline buttons with loading states
- Removes processed requests from list
- Formats timestamps (e.g., "2 days ago")

## 🔐 Privacy Rules

### Content Visibility

| Viewer Role | Public Account | Private Account (Not Following) | Private Account (Following) | Private Account (Admin) |
|-------------|----------------|----------------------------------|----------------------------|------------------------|
| **Posts** | ✅ Visible | ❌ Hidden | ✅ Visible | ✅ Visible (bypass) |
| **Ratings** | ✅ Visible | ❌ Hidden | ✅ Visible | ✅ Visible (bypass) |
| **Bio** | ✅ Visible | ✅ Visible | ✅ Visible | ✅ Visible |
| **Name** | ✅ Visible | ✅ Visible | ✅ Visible | ✅ Visible |
| **Follow Button** | "Follow" | "Request to Follow" | "Following" | "Following" |

### Backend Authorization

```javascript
// Check if user can view private content
const isFollowing = await checkIfFollowing(viewerId, targetId)
const isPrivate = targetUser.is_private
const isAdmin = viewer.role === 'admin'

const canViewContent = !isPrivate || isFollowing || isAdmin
```

## 🔄 User Flow Examples

### Example 1: Following a Public Account
```
1. Alice visits Bob's profile (Bob is public)
2. Alice clicks "Follow" button
3. Backend creates follow in follows table
4. Button changes to "Following"
5. Alice can immediately see Bob's posts
```

### Example 2: Requesting to Follow Private Account
```
1. Alice visits Carol's profile (Carol is private)
2. Alice sees lock icon and "This account is private" message
3. Alice clicks "Request to Follow" button
4. Backend creates follow_request with status='pending'
5. Button changes to "Requested"
6. Carol sees request in Notifications tab
7. Carol clicks "Accept"
8. Backend creates follow relationship + updates request to 'accepted'
9. Alice can now see Carol's posts
```

### Example 3: Declining a Follow Request
```
1. Dave requests to follow Emily (Emily is private)
2. Emily sees request in Notifications
3. Emily clicks "Decline"
4. Backend updates request status to 'declined'
5. Dave still cannot see Emily's content
6. Dave can send a new request later (re-request allowed)
```

### Example 4: Making Account Private
```
1. Frank toggles privacy in Settings
2. Frontend sends PUT /auth/profile with is_private=true
3. Frank's existing followers keep access
4. New users must request to follow
5. Frank's profile shows lock icon to non-followers
```

## 🚀 Testing Checklist

- [ ] Public account: Direct follow works
- [ ] Private account: Request button appears
- [ ] Private account: Request creates pending status
- [ ] Notifications shows incoming requests
- [ ] Accept button creates follow relationship
- [ ] Decline button updates status without creating follow
- [ ] Declined requests allow re-request
- [ ] Privacy toggle updates backend
- [ ] Lock icon shows for private accounts
- [ ] Content hidden for non-followers of private accounts
- [ ] Admin role bypasses all privacy checks
- [ ] Unfollow button removes relationship
- [ ] Cannot follow self
- [ ] Cannot create duplicate follows

## 📝 TODO: Future Enhancements

- [ ] Push notifications when request sent/accepted/declined
- [ ] Email notifications for follow requests
- [ ] Blocked users system (prevent follow requests)
- [ ] Follower/following count on profile
- [ ] List of followers and following
- [ ] Remove follower (for private accounts)
- [ ] Close friends list (Instagram feature)
- [ ] Request expiration (auto-decline after X days)
