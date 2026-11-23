import React, { createContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './context/AuthContext'
import Header from './components/Header'
import BottomTabs from './components/BottomTabs'
import Home from './components/Home'
import CommunityFeed from './components/CommunityFeed'
import Groups from './components/Groups'
import Profile from './components/Profile'
import RestaurantPage from './components/RestaurantPage'
import Login from './components/Login'
import Signup from './components/Signup'
import Notifications from './components/Notifications'
import Settings from './components/Settings'
import UserSearch from './components/UserSearch'
import RateScreen from './components/RateScreen'
import Onboarding from './components/Onboarding'
import UserProfile from './components/UserProfile'
import { posts as seedPosts, users as seedUsers, restaurants as seedRestaurants } from './data'
import { HashRouter as Router, Routes, Route, useParams, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import {
  applyThemeToDocument,
  getActiveProfileId,
  loadUserScopedValue
} from './utils/accountStorage'

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
  const { isAuthenticated, loading, login, signup, profile } = useAuth()
  const activeProfileId = profile?.id || getActiveProfileId()
  const [authView, setAuthView] = useState('login')
  const [showIntro, setShowIntro] = useState(() => {
    try { return localStorage.getItem('tastetrails-intro-seen') !== '1' } catch { return false }
  })
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

  useEffect(() => {
    const applyCurrentTheme = () => {
      const pref = loadUserScopedValue('taste-trails-theme', 'light', activeProfileId)
      applyThemeToDocument(pref)
    }
    applyCurrentTheme()
    window.addEventListener('themeChanged', applyCurrentTheme)
    return () => window.removeEventListener('themeChanged', applyCurrentTheme)
  }, [activeProfileId])

  const myPosts = useMemo(
    () => communityPosts.filter((p) => p?.userId === activeProfileId || p?.user_id === activeProfileId),
    [communityPosts, activeProfileId]
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
      <div className="screen pt-16">
        <div className="skeleton mb-4 h-8 w-40" />
        <div className="skeleton mb-3 h-24 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    if (showIntro) {
      return <Onboarding onDone={(view) => { setShowIntro(false); setAuthView(view === 'signup' ? 'signup' : 'login') }} />
    }
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
      if (path.startsWith('/search')) return 'search'
      if (path.startsWith('/rate')) return 'rate'
      if (path.startsWith('/profile')) return 'profile'
      if (path.startsWith('/community') || path.startsWith('/groups')) return 'discover'
      return 'discover'
    }

    const pathFromTab = (tab) => {
      switch (tab) {
        case 'search':
          return '/search'
        case 'rate':
          return '/rate'
        case 'profile':
          return '/profile'
        case 'discover':
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
      const isUuidLike = (value) =>
        typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      const inferredRestaurantId = isUuidLike(post.restaurant_id)
        ? post.restaurant_id
        : (isUuidLike(post.id) ? post.id : null);
      setMenuPost({
        ...post,
        restaurant: post.restaurant || post.name,
        restaurant_id: inferredRestaurantId
      });
      navigate('/menu');
    }

    const closeMenu = () => {
      setMenuPost(null)
      navigate('/')
    }

    const detail = location.pathname.startsWith('/menu')

    return (
      <LocationContext.Provider value={{ location, setLocation }}>
        <div className="app-shell">
          {!detail && (
            <Header
              title="TasteTrails"
              onNotificationsClick={() => setShowNotifications(true)}
              onSearchClick={() => navigate('/search')}
              onSettingsClick={() => setShowSettings(true)}
            />
          )}

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home onOpen={openMenu} />} />
              <Route path="/search" element={<div className="screen"><UserSearch onFollowChange={() => {}} onOpenProfile={handleOpenProfile} onOpenMenu={openMenu} /></div>} />
              <Route path="/rate" element={<RateScreen />} />
              <Route path="/community" element={<CommunityFeed posts={communityPosts} onAddComment={handleAddComment} onRestaurantClick={openMenu} />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/profile" element={<Profile userPosts={myPosts} onEditPost={handleEditPost} onDeletePost={handleDeletePost} />} />
              <Route path="/profile/:userId" element={<UserProfileRoute />} />
              <Route path="/menu" element={<RestaurantPage post={menuPost} onBack={closeMenu} />} />
            </Routes>
          </main>

          {!detail && (
            <BottomTabs
              active={activeTab}
              onTabClick={(tab) => {
                setActiveTab(tab)
                setMenuPost(null)
                navigate(pathFromTab(tab))
              }}
            />
          )}

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
