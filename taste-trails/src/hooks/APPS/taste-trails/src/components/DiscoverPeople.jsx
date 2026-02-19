import { useState } from "react";
import { Lock } from "lucide-react";

export default function DiscoverPeople() {
  const [query, setQuery] = useState("");
  const [allResults, setAllResults] = useState({ restaurants: [], users: [], groups: [] });
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [listFollowLoading, setListFollowLoading] = useState(null); // holds userId while requesting

  async function searchAll(q) {
    if (!q.trim()) {
      setAllResults({ restaurants: [], users: [], groups: [] });
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("sb-access-token") || localStorage.getItem("access_token");
      
      // Use unified search endpoint
      const res = await fetch(`http://localhost:8081/api/search?q=${encodeURIComponent(q)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (res.ok) {
        const data = await res.json();
        
        // Get local groups
        const localGroups = getLocalGroups(q);
        
        setAllResults({
          restaurants: data.restaurants || [],
          users: data.users || [],
          groups: localGroups
        });
      } else {
        setAllResults({ restaurants: [], users: [], groups: [] });
      }
    } catch (err) {
      console.error("Search failed", err);
      setAllResults({ restaurants: [], users: [], groups: [] });
    } finally {
      setLoading(false);
    }
  }

  function getLocalGroups(query) {
    try {
      const raw = localStorage.getItem('taste-trails-groups');
      if (!raw) return [];
      const groups = JSON.parse(raw);
      return groups
        .filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
        .map(g => ({
          id: g.id,
          name: g.name,
          desc: g.desc,
          memberCount: (g.members || []).length,
          type: 'group'
        }));
    } catch (e) {
      return [];
    }
  }

  async function viewUserProfile(userId) {
    setSelectedUser(userId);
    setLoadingProfile(true);
    try {
      const token = localStorage.getItem("sb-access-token");
      const res = await fetch(`http://localhost:8081/api/users/${userId}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      
      if (data.error) {
        alert(data.error);
        setSelectedUser(null);
      } else {
        setUserProfile(data);
      }
    } catch (err) {
      console.error("Failed to load profile", err);
      alert("Failed to load profile");
      setSelectedUser(null);
    } finally {
      setLoadingProfile(false);
    }
  }

  function handleSearch(e) {
    const value = e.target.value;
    setQuery(value);
    searchAll(value);
    setSelectedUser(null);
    setUserProfile(null);
  }

  function goBack() {

      async function handleFollow() {
        if (!selectedUser) return;
        setFollowLoading(true);
    
        try {
          const token = localStorage.getItem("sb-access-token");
          if (!token) {
            alert("Please log in to follow users");
            return;
          }

          const res = await fetch(`http://localhost:8081/api/users/${selectedUser}/follow`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
      
          const data = await res.json();
      
          if (res.ok) {
            alert(data.message);
            viewUserProfile(selectedUser);
          } else {
            alert(data.error || "Failed to follow");
          }
        } catch (err) {
          console.error("Follow error:", err);
          alert("Failed to follow user");
        } finally {
          setFollowLoading(false);
        }
      }

      async function handleUnfollow() {
        if (!selectedUser) return;
        setFollowLoading(true);
    
        try {
          const token = localStorage.getItem("sb-access-token");
          const res = await fetch(`http://localhost:8081/api/users/${selectedUser}/follow`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
      
          const data = await res.json();
      
          if (res.ok) {
            alert(data.message);
            viewUserProfile(selectedUser);
          } else {
            alert(data.error || "Failed to unfollow");
          }
        } catch (err) {
          console.error("Unfollow error:", err);
          alert("Failed to unfollow user");
        } finally {
          setFollowLoading(false);
        }
      }

      async function handleCancelRequest() {
        if (!selectedUser) return;
        setFollowLoading(true);
    
        try {
          const token = localStorage.getItem("sb-access-token");
          const res = await fetch(`http://localhost:8081/api/users/${selectedUser}/follow-request`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
      
          const data = await res.json();
      
          if (res.ok) {
            alert(data.message);
            viewUserProfile(selectedUser);
          } else {
            alert(data.error || "Failed to cancel request");
          }
        } catch (err) {
          console.error("Cancel request error:", err);
          alert("Failed to cancel request");
        } finally {
          setFollowLoading(false);
        }
      }

      function renderFollowButton() {
        if (!userProfile) return null;

        if (userProfile.isFollowing) {
          return (
            <button
              onClick={handleUnfollow}
              disabled={followLoading}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 disabled:opacity-50"
            >
              {followLoading ? "Loading..." : "Following"}
            </button>
          );
        }

        if (userProfile.followRequestStatus === "pending") {
          return (
            <button
              onClick={handleCancelRequest}
              disabled={followLoading}
              className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-xl hover:bg-yellow-200 disabled:opacity-50"
            >
              {followLoading ? "Loading..." : "Request Pending"}
            </button>
          );
        }

        const isPrivate = !!userProfile?.user?.is_private;
        const label = isPrivate ? "Request to Follow" : "Follow";

        return (
          <button
            onClick={handleFollow}
            disabled={followLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
          >
            {followLoading ? "Loading..." : label}
          </button>
        );
      }
    setSelectedUser(null);
    setUserProfile(null);
  }

  // Send follow request directly from list for private accounts
  async function handleFollowUser(userId) {
    setListFollowLoading(userId);
    try {
      const token = localStorage.getItem("sb-access-token") || localStorage.getItem("access_token");
      if (!token) {
        alert("Please log in to send a request");
        return;
      }
      const res = await fetch(`http://localhost:8081/api/users/${userId}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Request sent");
        // Refresh list to reflect 'Requested' status
        if (query.trim()) {
          await searchAll(query);
        }
      } else {
        alert(data.error || "Failed to send request");
      }
    } catch (err) {
      console.error("Follow request error:", err);
      alert("Failed to send request");
    } finally {
      setListFollowLoading(null);
    }
  }

  const totalResults = 
    allResults.restaurants.length + 
    allResults.users.length + 
    allResults.groups.length;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {!selectedUser ? (
        <>
          <h2 className="text-xl font-semibold mb-3">Discover</h2>

          <input
            type="text"
            placeholder="Search for restaurants, people, or groups..."
            value={query}
            onChange={handleSearch}
            className="w-full border rounded-xl p-3 shadow-sm"
          />

          {loading && <p className="mt-2 text-sm text-gray-500">Loading...</p>}

          {!loading && totalResults === 0 && query && (
            <p className="mt-4 text-sm text-gray-500">No results found.</p>
          )}

          {/* Restaurants Section */}
          {allResults.restaurants.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">🍽️ Restaurants</h3>
              <div className="space-y-2">
                {allResults.restaurants.map(r => (
                  <div
                    key={r.id}
                    onClick={() => window.location.href = `/#/restaurant/${r.id}`}
                    className="border rounded-2xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  >
                    {r.image && (
                      <img src={r.image} alt="" className="w-16 h-16 object-cover rounded-lg" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{r.name}</div>
                      {r.location && <div className="text-xs text-gray-500">{r.location}</div>}
                      {r.rating > 0 && (
                        <div className="text-xs text-gray-600">
                          ⭐ {r.rating} {r.reviewCount > 0 && `(${r.reviewCount} reviews)`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* People Section */}
          {allResults.users.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">👤 People</h3>
              <div className="space-y-2">
                {allResults.users.map(u => (
                  <div
                    key={u.id}
                    className="border rounded-2xl p-3 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium">{u.name}</span>
                        {u.isPrivate && (
                          <Lock className="w-4 h-4 text-gray-500" title="Private account" />
                        )}
                      </div>
                      {u.userCode && (
                        <span className="text-sm text-gray-500">#{u.userCode}</span>
                      )}
                    </div>
                    {u.isPrivate ? (
                      u.isFollowing ? (
                        <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-xl text-sm">Following</span>
                      ) : u.followRequestStatus === 'pending' ? (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-xl text-sm">Requested</span>
                      ) : (
                        <button
                          onClick={() => handleFollowUser(u.id)}
                          disabled={listFollowLoading === u.id}
                          className="px-3 py-1 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {listFollowLoading === u.id ? "Requesting..." : "Request"}
                        </button>
                      )
                    ) : (
                      u.isFollowing ? (
                        <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-xl text-sm">Following</span>
                      ) : (
                        <button
                          onClick={() => viewUserProfile(u.id)}
                          className="px-3 py-1 border rounded-xl text-sm hover:bg-gray-100 transition-colors"
                        >
                          View
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups Section */}
          {allResults.groups.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">👥 Groups</h3>
              <div className="space-y-2">
                {allResults.groups.map(g => (
                  <div
                    key={g.id}
                    onClick={() => window.location.href = '/#/groups'}
                    className="border rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="font-medium">{g.name}</div>
                    <div className="text-sm text-gray-500">
                      {g.desc} • {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={goBack}
            className="mb-4 text-blue-600 hover:underline"
          >
            ← Back to search
          </button>

          {loadingProfile ? (
            <p className="text-gray-500">Loading profile...</p>
          ) : userProfile ? (
            <>
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{userProfile.user.name}</h2>
                  <p className="text-gray-500">#{userProfile.user.user_code}</p>
                  {userProfile.user.is_private && (
                    <p className="text-sm text-gray-400 mt-1">🔒 Private Account</p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">
                    {userProfile.postCount} {userProfile.postCount === 1 ? 'post' : 'posts'}
                  </p>
                </div>
                {renderFollowButton()}
              </div>

              {userProfile.message ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">{userProfile.message}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {userProfile.followRequestStatus === "pending" 
                      ? "Your follow request is pending approval" 
                      : "Send a follow request to see their posts"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Recent Posts</h3>
                
                  {userProfile.posts.length === 0 ? (
                    <p className="text-gray-500">No posts yet.</p>
                  ) : (
                    userProfile.posts.map(post => (
                      <div key={post.id} className="border rounded-xl p-4 shadow-sm">
                        {post.image_url && (
                          <img
                            src={post.image_url}
                            alt="Post"
                            className="w-full h-48 object-cover rounded-lg mb-3"
                          />
                        )}
                      
                        <p className="text-gray-800 mb-2">{post.content}</p>
                      
                        {post.dish_name && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-medium">{post.dish_name}</span>
                            {post.rating && (
                              <span className="text-yellow-600">★ {post.rating}/10</span>
                            )}
                          </div>
                        )}
                        
                        {post.restaurants && (
                          <p className="text-sm text-gray-500 mt-1">
                            📍 {post.restaurants.name}
                          </p>
                        )}
                        
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
