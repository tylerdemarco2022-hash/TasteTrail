import React, { createContext, useEffect, useMemo, useState, lazy, Suspense, startTransition } from 'react'
import { useAuth } from './context/AuthContext'
import Header from './components/Header'
import BottomTabs from './components/BottomTabs'
import Feed from './components/Feed'
import useSwipe from './hooks/useSwipe'
// Lazy load non-critical components for better initial load time
const CommunityFeed = lazy(() => import('./components/CommunityFeed'))
const Groups = lazy(() => import('./components/Groups'))
const Profile = lazy(() => import('./components/Profile'))
const MenuView = lazy(() => import('./components/MenuView'))
const Login = lazy(() => import('./components/Login'))
const Signup = lazy(() => import('./components/Signup'))
const Notifications = lazy(() => import('./components/Notifications'))
const Settings = lazy(() => import('./components/Settings'))
const UserSearch = lazy(() => import('./components/UserSearch'))
const UserProfile = lazy(() => import('./components/UserProfile'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))
import Onboarding from './components/Onboarding'
import { posts as seedPosts, users as seedUsers, restaurants as seedRestaurants } from './data'
import { HashRouter as Router, Routes, Route, useParams, useLocation, useNavigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import {
  applyThemeToDocument,
  getActiveProfileId,
  loadUserScopedValue
} from './utils/accountStorage'

// Loading fallback for lazy components
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="glass rounded-2xl px-6 py-4 shadow-lg text-gray-700">Loading…</div>
  </div>
)

const COMMUNITY_POSTS_KEY = 'community-posts'
const CURRENT_USER = 'You'

function safeGetLocalStorageItem(key) {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

export const LocationContext = createContext({ location: null, setLocation: () => {} })

function loadCommunityPosts() {
  try {
    const raw = safeGetLocalStorageItem(COMMUNITY_POSTS_KEY)
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
  const [activeTab, setActiveTab] = useState('restaurants')
  const [menuPost, setMenuPost] = useState(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [communityPosts, setCommunityPosts] = useState(() => loadCommunityPosts())
  const [isNewSignup, setIsNewSignup] = useState(() => {
    return safeGetLocalStorageItem('is_new_signup') === 'true'
  })
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => {
    return safeGetLocalStorageItem('onboarding_completed') === 'true'
  })
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
    try {
      localStorage.setItem(COMMUNITY_POSTS_KEY, JSON.stringify(communityPosts))
    } catch (e) {
      // Ignore storage errors (blocked or unavailable storage).
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl px-6 py-4 shadow-lg text-gray-700">Loading…</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        {authView === 'signup' ? (
          <Signup onSignup={signup} onLogin={login} onSwitchToLogin={() => setAuthView('login')} />
        ) : (
          <Login onLogin={login} onSwitchToSignup={() => setAuthView('signup')} />
        )}
      </Suspense>
    )
  }

  // Show onboarding for all users who haven't completed it
  if (!onboardingCompleted) {
    return (
      <Onboarding
        onComplete={() => {
          setOnboardingCompleted(true)
          setIsNewSignup(false)
          localStorage.removeItem('is_new_signup')
          console.log('✅ Onboarding completed!')
        }}
      />
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

    // Escape key closes any open modal
    useEffect(() => {
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          if (showNotifications) setShowNotifications(false)
          else if (showSettings) setShowSettings(false)
          else if (showSearch) setShowSearch(false)
          else if (showAdmin) setShowAdmin(false)
        }
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }, [showNotifications, showSettings, showSearch, showAdmin])

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

    // Swipe gesture handling for tab navigation
    const tabs = ['restaurants', 'feed', 'groups', 'profile']
    const currentTabIndex = tabs.indexOf(activeTab)

    const handleSwipeLeft = () => {
      const nextIndex = (currentTabIndex + 1) % tabs.length
      const nextTab = tabs[nextIndex]
      startTransition(() => {
        setActiveTab(nextTab)
        navigate(pathFromTab(nextTab))
      })
    }

    const handleSwipeRight = () => {
      const prevIndex = (currentTabIndex - 1 + tabs.length) % tabs.length
      const prevTab = tabs[prevIndex]
      startTransition(() => {
        setActiveTab(prevTab)
        navigate(pathFromTab(prevTab))
      })
    }

    useSwipe(handleSwipeLeft, handleSwipeRight)

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

    return (
      <LocationContext.Provider value={{ location, setLocation }}>
        <div className="app-shell safe-area-all">
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <Header
            title="TasteTrails"
            onNotificationsClick={() => setShowNotifications(true)}
            onSearchClick={() => setShowSearch(true)}
            onSettingsClick={() => setShowSettings(true)}
            onAdminClick={() => setShowAdmin(true)}
          />

          <main id="main-content" className="flex-1">
            <Routes>
              <Route path="/" element={<Feed onOpen={openMenu} />} />
              <Route path="/community" element={<Suspense fallback={<LoadingFallback />}><CommunityFeed posts={communityPosts} onAddComment={handleAddComment} onRestaurantClick={openMenu} /></Suspense>} />
              <Route path="/groups" element={<Suspense fallback={<LoadingFallback />}><Groups /></Suspense>} />
              <Route path="/profile" element={<Suspense fallback={<LoadingFallback />}><Profile userPosts={myPosts} onEditPost={handleEditPost} onDeletePost={handleDeletePost} /></Suspense>} />
              <Route path="/profile/:userId" element={<Suspense fallback={<LoadingFallback />}><UserProfileRoute /></Suspense>} />
              <Route path="/menu" element={<Suspense fallback={<LoadingFallback />}><MenuView post={menuPost} onBack={closeMenu} showAI /></Suspense>} />
            </Routes>
          </main>

          <BottomTabs
            active={activeTab}
            setActive={(tab) => {
              startTransition(() => {
                setActiveTab(tab)
                setMenuPost(null)
              })
            }}
            onTabClick={(tab) => startTransition(() => navigate(pathFromTab(tab)))}
          />

          {showNotifications && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Notifications">
              <div className="absolute inset-x-0 top-0 max-w-3xl mx-auto bg-white rounded-b-3xl shadow-2xl">
                <div className="flex justify-end p-4">
                  <button
                    aria-label="Close notifications"
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                    onClick={() => setShowNotifications(false)}
                  >
                    Close
                  </button>
                </div>
                <Suspense fallback={<LoadingFallback />}>
                  <Notifications />
                </Suspense>
              </div>
            </div>
          )}

          {showSettings && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Settings">
              <div className="absolute inset-0 overflow-y-auto">
                <Suspense fallback={<LoadingFallback />}>
                  <Settings onClose={() => setShowSettings(false)} />
                </Suspense>
              </div>
            </div>
          )}

          {showSearch && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Search">
              <div className="absolute inset-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto">
                  <div className="flex justify-end p-4">
                    <button
                      aria-label="Close search"
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
                      onClick={() => setShowSearch(false)}
                    >
                      Close
                    </button>
                  </div>
                  <Suspense fallback={<LoadingFallback />}>
                    <UserSearch onFollowChange={() => {}} onOpenProfile={handleOpenProfile} />
                  </Suspense>
                </div>
              </div>
            </div>
          )}

          {showAdmin && (
            <Suspense fallback={<LoadingFallback />}>
              <AdminPanel onClose={() => setShowAdmin(false)} />
            </Suspense>
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
