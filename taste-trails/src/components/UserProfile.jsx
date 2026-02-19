import { API_BASE_URL } from '../config/api'
import React, { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import StarRating from './StarRating'
import { useAuth } from '../context/AuthContext'
import { posts as seedPosts } from '../data'

/**
 * UserProfile Component - Instagram-style Private Account Behavior
 * 
 * This component displays a user's profile with privacy controls similar to Instagram:
 * 
 * 1. Private Account Detection:
 *    - When a user visits a profile, we fetch from /api/users/:userId/profile
 *    - The backend checks if the profile is marked as private (is_private = true)
 * 
 * 2. Visibility Rules:
 *    - If account is PUBLIC: Show full profile with posts, ratings, and stats
 *    - If account is PRIVATE and viewer is NOT following: Show lock icon, "This account is private" message, and "Request to Follow" button
 *    - If account is PRIVATE and viewer IS following: Show full profile content (posts, ratings)
 *    - If viewer is the ADMIN: Always show full profile regardless of privacy setting
 *    - If viewer is viewing their OWN profile: Always show full content
 * 
 * 3. Follow Request Flow:
 *    - User clicks "Request to Follow" on a private profile
 *    - Backend creates a follow_request record with status "pending"
 *    - Button changes to "Requested" (disabled state)
 *    - Profile owner can accept/reject the request
 *    - If accepted: follow relationship is created and viewer can see content
 * 
 * 4. Search Behavior:
 *    - Private accounts still appear in search results (users can find them by name)
 *    - Search shows the user's name and profile picture, but not their content
 *    - Clicking on a private user in search results opens this profile view with restricted access
 */
const UserProfile = ({ user, onBack, onFollowToggle, isFollowing }) => {
  const { profile: currentUserProfile, token, user: authUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestingFollow, setRequestingFollow] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [myRatings, setMyRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState('');
  // Load profile data with privacy checks from backend
  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('access_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const url = `${API_BASE_URL}/api/users/${encodeURIComponent(user.id)}/profile`;
        const res = await fetch(url, { headers });
        if (res.status === 404) {
          if (!cancelled) {
            setProfileData({
              user: {
                id: user?.id,
                name: user?.name || 'User',
                email: user?.email || '',
                is_private: false
              },
              posts: [],
              isLocal: true,
              isFollowing: false,
              followRequestStatus: null
            });
          }
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load profile (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setProfileData(data);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (user?.id) loadProfile();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Fetch "My Rated Dishes" for own profile
  useEffect(() => {
    if (!currentUserProfile || !authUser || currentUserProfile.id !== user?.id) return;
    if (!token) return;
    setRatingsLoading(true);
    setRatingsError('');
    fetch(`${API_BASE_URL}/users/me/ratings`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch ratings');
        return res.json();
      })
      .then(data => {
        setMyRatings(Array.isArray(data) ? data : []);
        setRatingsLoading(false);
      })
      .catch(e => {
        setRatingsError(e.message || 'Failed to load ratings');
        setRatingsLoading(false);
      });
  }, [currentUserProfile, authUser, user?.id, token]);

  // Handle follow/request to follow action
  const handleFollowAction = async () => {
    // If already following or can toggle, use existing function
    if (isFollowing && typeof isFollowing === 'function' && isFollowing(user.id)) {
      onFollowToggle && onFollowToggle(user.id)
      return
    }

    // Send follow request for private accounts
    setRequestingFollow(true)
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${API_BASE_URL}/api/users/${user.id}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Reload profile to get updated follow status
        window.location.reload()
      } else {
        const text = await response.text()
        console.log("RAW FETCH RESPONSE:", text.slice(0, 200))
        let data
        try {
          data = JSON.parse(text)
        } catch (e) {
          console.error("NOT JSON RESPONSE:", text.slice(0, 200))
          throw e
        }
        alert(data.error || 'Failed to send follow request')
      }
    } catch (e) {
      alert('Error sending follow request')
    } finally {
      setRequestingFollow(false)
    }
  }

  const displayName = user?.name || 'User'
  const email = user?.email || ''
  const isPrivate = profileData?.user?.is_private
  const isFollowingUser = profileData?.isFollowing
  const followRequestStatus = profileData?.followRequestStatus
  const posts = profileData?.posts || []
  const isOwnProfile = currentUserProfile?.id === user?.id
  const isAdmin = currentUserProfile?.role === 'admin'
  const isLocalProfile = !!profileData?.isLocal
  const bio = profileData?.user?.bio || localStorage.getItem(`user_bio_${user?.id}`) || 'Food explorer sharing favorite bites.'

  // Determine if we should show content
  // Show content if: public account, OR following, OR own profile, OR admin
  const canViewContent = !isPrivate || isFollowingUser || isOwnProfile || isAdmin || isLocalProfile

  const loadLocalPosts = () => {
    try {
      const raw = localStorage.getItem('community-posts')
      const list = raw ? JSON.parse(raw) : seedPosts
      if (!Array.isArray(list)) return []
      return list.filter((p) => {
        if (user?.id && p.userId) return p.userId === user.id
        if (user?.name && p.user?.name) return p.user.name === user.name
        return false
      })
    } catch (e) {
      return []
    }
  }

  const displayPosts = posts.length ? posts : loadLocalPosts()
  const ratedCount = isOwnProfile ? myRatings.length : (profileData?.ratings?.length || 0)

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-gray-600 hover:text-gray-900 text-xl font-semibold">← Back</button>
        <h2 className="text-lg font-bold">Profile</h2>
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-3xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold">{displayName}</div>
              {isPrivate && <Lock className="w-4 h-4 text-gray-500" />}
            </div>
            {email && <div className="text-sm text-gray-500">{email}</div>}
            <p className="mt-2 text-gray-700">{bio}</p>
            {!canViewContent && (
              <div className="text-sm text-gray-500 mt-1">This account is private</div>
            )}
          </div>
          {!isOwnProfile && (
            <button
              onClick={handleFollowAction}
              disabled={requestingFollow || followRequestStatus === 'pending'}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                followRequestStatus === 'pending'
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : isFollowingUser
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {requestingFollow ? 'Sending...' : 
               followRequestStatus === 'pending' ? 'Requested' :
               isFollowingUser ? 'Following' : 
               isPrivate ? 'Request to Follow' : 'Follow'}
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-6">
          <div><div className="font-semibold">{displayPosts.length}</div><div className="text-sm text-gray-500">Posts</div></div>
          <div><div className="font-semibold">{ratedCount}</div><div className="text-sm text-gray-500">Rated Dishes</div></div>
          <div><div className="font-semibold">0</div><div className="text-sm text-gray-500">Following</div></div>
        </div>
      </div>

      {/* Content Area - Conditional based on privacy */}
      {loading && (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-gray-500">
          Loading profile...
        </div>
      )}

      {error && (
        <div className="bg-white rounded-xl p-8 shadow-sm text-center text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && !canViewContent && (
        /* Private Account Message - Similar to Instagram */
        <div className="bg-white rounded-xl p-12 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-gray-300 flex items-center justify-center">
              <Lock className="w-12 h-12 text-gray-400" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">This Account is Private</h3>
          <p className="text-gray-600 mb-4">
            Follow this account to see their posts and ratings.
          </p>
          {followRequestStatus === 'pending' && (
            <p className="text-sm text-amber-600">
              Your follow request is pending approval.
            </p>
          )}
        </div>
      )}

      {/* Tab Switcher */}
      {canViewContent && (
        <div className="bg-white rounded-xl shadow-sm mb-4 p-1 flex gap-1">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors text-sm ${
              activeTab === 'posts'
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab('ratings')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-colors text-sm ${
              activeTab === 'ratings'
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Rated Dishes
          </button>
        </div>
      )}

      {/* Content Area */}
      {canViewContent && activeTab === 'posts' && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-lg mb-3">Posts</h3>
          {displayPosts.length === 0 ? (
            <div className="text-gray-500">No posts yet.</div>
          ) : (
            <div className="space-y-4">
              {displayPosts.map((post) => (
                <div key={post.id} className="rounded-xl border border-gray-100 overflow-hidden">
                  {post.image && (
                    <img src={post.image} alt="" className="w-full h-48 object-cover" />
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-gray-900">{post.dish || 'Dish'}</div>
                      {post.rating ? <StarRating value={post.rating} /> : null}
                    </div>
                    <div className="text-sm text-gray-600">{post.restaurant || 'Restaurant'}</div>
                    {post.caption && <div className="text-sm text-gray-700">{post.caption}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {canViewContent && activeTab === 'ratings' && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-lg mb-3">Rated Dishes</h3>
          {isOwnProfile ? (
            ratingsLoading ? (
              <div className="text-gray-500">Loading your ratings…</div>
            ) : ratingsError ? (
              <div className="text-red-500">{ratingsError}</div>
            ) : myRatings.length === 0 ? (
              <div className="text-gray-500">You haven’t rated any dishes yet.</div>
            ) : (
              <div className="divide-y">
                {myRatings.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{r.dish_name}</div>
                      <div className="text-sm text-gray-600 truncate">{r.restaurant_name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating value={r.rating * 2} />
                    </div>
                    <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">{r.rated_at ? new Date(r.rated_at).toLocaleDateString() : ''}</div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-gray-500">No ratings to show yet.</div>
          )}
        </div>
      )}

      {/* Prompt login if not authenticated and own profile */}
      {currentUserProfile?.id === user?.id && !token && (
        <div className="bg-white rounded-xl p-4 shadow-sm mt-6 text-center">
          <div className="text-gray-500 mb-2">Please log in to see your rated dishes.</div>
          {/* Optionally, add a login button here */}
        </div>
      )}
    </div>
  )
};
export default UserProfile;
