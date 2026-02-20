import React, { createContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './context/AuthContext'
import Header from './components/Header'
import BottomTabs from './components/BottomTabs'
import Feed from './components/Feed'
import CommunityFeed from './components/CommunityFeed'
import Groups from './components/Groups'
import Profile from './components/Profile'
import MenuView from './components/MenuView'
import Login from './components/Login'
import Signup from './components/Signup'
import Notifications from './components/Notifications'
import Settings from './components/Settings'
import UserSearch from './components/UserSearch'
import UserProfile from './components/UserProfile'
import { posts as seedPosts, users as seedUsers, restaurants as seedRestaurants } from './data'
import { HashRouter as Router, Routes, Route, useParams, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';

const COMMUNITY_POSTS_KEY = 'community-posts'
const CURRENT_USER = 'You'

export const LocationContext = createContext({ location: null, setLocation: () => {} })

function loadCommunityPosts() {
  try {
    const raw = localStorage.getItem(COMMUNITY_POSTS_KEY)
    if (!raw) return seedPosts
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : seedPosts
  } catch (e) {
    return seedPosts
  }
}

function App() {
  const { isAuthenticated, loading, login, signup } = useAuth()
  const [authView, setAuthView] = useState('login')
  const [activeTab, setActiveTab] = useState('restaurants')
  const [menuPost, setMenuPost] = useState(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [communityPosts, setCommunityPosts] = useState(() => loadCommunityPosts())
  // Default to Charlotte coordinates to avoid using the user's device location
  const [location, setLocation] = useState({ latitude: 35.2271, longitude: -80.8431 })

  useEffect(() => {
    // Only attempt to read the device geolocation if no location is already set
    if (location) return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [location])

  useEffect(() => {
    localStorage.setItem(COMMUNITY_POSTS_KEY, JSON.stringify(communityPosts))
  }, [communityPosts])

  useEffect(() => {
    const refreshPosts = () => setCommunityPosts(loadCommunityPosts())
    window.addEventListener('postsUpdated', refreshPosts)
    window.addEventListener('postsCleared', refreshPosts)
    return () => {
      window.removeEventListener('postsUpdated', refreshPosts)
      window.removeEventListener('postsCleared', refreshPosts)
    }
  }, [])

  const myPosts = useMemo(
    () => communityPosts.filter((p) => p?.user?.name === CURRENT_USER || p?.userId === 'user1'),
    [communityPosts]
  )

  const handleAddComment = (postId, text) => {
    setCommunityPosts((prev) => {
      const next = prev.map((post) => {
        if (post.id !== postId) return post
        const comment = {
          id: Date.now(),
          author: CURRENT_USER,
          userName: CURRENT_USER,
          userAvatar: 'https://i.pravatar.cc/64?img=1',
          text,
          timestamp: new Date().toISOString(),
          postAuthor: post?.user?.name || 'Unknown',
          read: false
        }
        const comments = [...(post.comments || []), comment]
        return {
          ...post,
          comments,
          commentCount: (post.commentCount || comments.length)
        }
      })

      try {
        const stored = JSON.parse(localStorage.getItem('taste-trails-comments') || '[]')
        const post = prev.find((p) => p.id === postId)
        if (post) {
          stored.push({
            id: Date.now(),
            author: CURRENT_USER,
            text,
            timestamp: new Date().toISOString(),
            postAuthor: post?.user?.name || 'Unknown',
            read: false
          })
          localStorage.setItem('taste-trails-comments', JSON.stringify(stored))
        }
      } catch (e) {}

      return next
    })
  }

  const handleEditPost = (postToEdit) => {
    setCommunityPosts((prev) => prev.map((p) => (p.id === postToEdit.id ? postToEdit : p)))
  }

  const handleDeletePost = (postToDelete) => {
    setCommunityPosts((prev) => prev.filter((p) => p.id !== postToDelete.id))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 shadow-lg text-gray-700">Loading…</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return authView === 'signup' ? (
      <Signup onSignup={signup} onSwitchToLogin={() => setAuthView('login')} />
    ) : (
      <Login onLogin={login} onSwitchToSignup={() => setAuthView('signup')} />
    )
  }

  const handleOpenProfile = (user) => {
    if (!user?.id) return
    try {
      localStorage.setItem('selectedUserProfile', JSON.stringify(user))
    } catch (e) {}
    setShowSearch(false)
    window.location.hash = `/profile/${user.id}`
  }

  const UserProfileRoute = () => {
    const { userId } = useParams()
    let selectedUser = null
    try {
      const raw = localStorage.getItem('selectedUserProfile')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.id === userId) selectedUser = parsed
      }
    } catch (e) {}

    if (!selectedUser) {
      selectedUser = seedUsers.find((u) => u.id === userId) || {
        id: userId,
        name: 'User',
        email: ''
      }
    }

    return <UserProfile user={selectedUser} onBack={() => window.history.back()} />
  }

  const AppShell = () => {
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
      if (location.pathname !== '/menu' || menuPost) return
      const defaultRestaurant = seedRestaurants.find(
        (restaurant) => (restaurant.name || '').toLowerCase() === 'culinary dropout'
      )
      if (!defaultRestaurant) return
      setMenuPost({
        ...defaultRestaurant,
        name: defaultRestaurant.name || 'Culinary Dropout'
      })
    }, [location.pathname, menuPost])

    const tabFromPath = (path) => {
      if (path.startsWith('/community')) return 'feed'
      if (path.startsWith('/groups')) return 'groups'
      if (path.startsWith('/profile')) return 'profile'
      return 'restaurants'
    }

    const pathFromTab = (tab) => {
      switch (tab) {
        case 'feed':
          return '/community'
        case 'groups':
          return '/groups'
        case 'profile':
          return '/profile'
        case 'restaurants':
        default:
          return '/'
      }
    }

    useEffect(() => {
      setActiveTab(tabFromPath(location.pathname))
    }, [location.pathname])

    const openMenu = (post) => {
      console.log('openMenu called with post:', post);
      if (!post) return;
      // Ensure the restaurant_id is set in the menuPost state
      setMenuPost({
        ...post,
        restaurant: post.restaurant || post.name,
        restaurant_id: post.restaurant_id || post.restaurant_id || '00000000-0000-0000-0000-000000000001'
      });
      navigate('/menu');
    }

    const closeMenu = () => {
      setMenuPost(null)
      navigate('/')
    }

    return (
      <LocationContext.Provider value={{ location, setLocation }}>
        <div className="app-shell">
          <Header
            title="TasteTrails"
            onNotificationsClick={() => setShowNotifications(true)}
            onSearchClick={() => setShowSearch(true)}
            onSettingsClick={() => setShowSettings(true)}
          />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Feed onOpen={openMenu} />} />
              <Route path="/community" element={<CommunityFeed posts={communityPosts} onAddComment={handleAddComment} onRestaurantClick={openMenu} />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/profile" element={<Profile userPosts={myPosts} onEditPost={handleEditPost} onDeletePost={handleDeletePost} />} />
              <Route path="/profile/:userId" element={<UserProfileRoute />} />
              <Route path="/menu" element={<MenuView post={menuPost} onBack={closeMenu} showAI />} />
            </Routes>
          </main>

          <BottomTabs
            active={activeTab}
            setActive={(tab) => {
              setActiveTab(tab)
              setMenuPost(null)
            }}
            onTabClick={(tab) => navigate(pathFromTab(tab))}
          />

          {showNotifications && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 max-w-3xl mx-auto bg-white rounded-b-3xl shadow-2xl">
                <div className="flex justify-end p-4">
                  <button
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                    onClick={() => setShowNotifications(false)}
                  >
                    Close
                  </button>
                </div>
                <Notifications />
              </div>
            </div>
          )}

          {showSettings && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm">
              <div className="absolute inset-0 overflow-y-auto">
                <Settings onClose={() => setShowSettings(false)} />
              </div>
            </div>
          )}

          {showSearch && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm">
              <div className="absolute inset-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                  <div className="flex justify-end p-4">
                    <button
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                      onClick={() => setShowSearch(false)}
                    >
                      Close
                    </button>
                  </div>
                  <UserSearch onFollowChange={() => {}} onOpenProfile={handleOpenProfile} />
                </div>
              </div>
            </div>
          )}
        </div>
      </LocationContext.Provider>
    )
  }

  return (
    <ErrorBoundary>
      <Router>
        <AppShell />
      </Router>
    </ErrorBoundary>
  )
}

export default App
