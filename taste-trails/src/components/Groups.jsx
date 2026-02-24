import React, { useEffect, useState } from 'react'
import { posts as allPosts, restaurants as dataRestaurants } from '../data'
import MenuView from './MenuView'
import AddPost from './AddPost'

const STORAGE_KEY = 'taste-trails-groups'
const CHALLENGES_KEY = 'taste-trails-challenges'
const BADGES_KEY = 'taste-trails-badges'
const CURRENT_USER = 'You'

function loadGroups() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) {
    return []
  }
}

function saveGroups(groups) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
  } catch (e) {}
}

function loadChallenges() {
  try {
    const raw = localStorage.getItem(CHALLENGES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function saveChallenges(challenges) {
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges))
  } catch (e) {}
}

function loadBadges() {
  try {
    const raw = localStorage.getItem(BADGES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function saveBadges(badges) {
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify(badges))
  } catch (e) {}
}

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [joinPolicy, setJoinPolicy] = useState('request')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedPost, setSelectedPost] = useState(null)
  const [showAddPost, setShowAddPost] = useState(false)
  const [showChallenges, setShowChallenges] = useState(false)
  const [challenges, setChallenges] = useState([])
  const [badges, setBadges] = useState([])
  const [showCreateChallenge, setShowCreateChallenge] = useState(false)
  const [challengeName, setChallengeName] = useState('')
  const [challengeDesc, setChallengeDesc] = useState('')
  const [challengeReward, setChallengeReward] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [groupPosts, setGroupPosts] = useState([])
  // Show restaurant posts without rendering group membership cards.
  useEffect(() => {
    const refreshRestaurantPosts = () => {
      try {
        const storedRaw = localStorage.getItem('community-posts')
        const storedPosts = storedRaw ? JSON.parse(storedRaw) : []
        const persisted = Array.isArray(storedPosts) ? storedPosts : []
        const fallback = Array.isArray(allPosts) ? allPosts : []
        const source = persisted.length > 0 ? persisted : fallback
        const filtered = source
          .filter((post) => post && post.restaurant)
          .sort((a, b) => {
            const aTime = new Date(a?.timestamp || 0).getTime() || 0
            const bTime = new Date(b?.timestamp || 0).getTime() || 0
            return bTime - aTime
          })
        setGroupPosts(filtered)
      } catch (e) {
        setGroupPosts(Array.isArray(allPosts) ? allPosts.filter((post) => post && post.restaurant) : [])
      }
    }

    refreshRestaurantPosts()
    window.addEventListener('postsUpdated', refreshRestaurantPosts)
    window.addEventListener('postsCleared', refreshRestaurantPosts)
    return () => {
      window.removeEventListener('postsUpdated', refreshRestaurantPosts)
      window.removeEventListener('postsCleared', refreshRestaurantPosts)
    }
  }, [])

  useEffect(() => {
    const g = loadGroups()
    if (g.length === 0) {
      // seed with an example
      const seed = [
        { id: 1, name: 'Downtown Lunchers', desc: 'Quick lunches and best daily specials', members: ['Maya'], leader: 'Maya', pendingRequests: [], invites: [], joinPolicy: 'request' },
        { id: 2, name: 'Pasta Lovers', desc: 'All things pasta', members: [], leader: CURRENT_USER, pendingRequests: [], invites: [], joinPolicy: 'request' }
      ]
      setGroups(seed)
      saveGroups(seed)
    } else {
      setGroups(g)
    }
    setChallenges(loadChallenges())
    setBadges(loadBadges())
  }, [])

  function generateAutoChallenges(groupId, groupName) {
    const defaultChallenges = [
      {
        id: Date.now(),
        groupId: groupId,
        name: 'First Bite',
        description: 'Try your first restaurant with the group',
        reward: 'ðŸ½ï¸ First Bite',
        createdBy: 'Auto',
        completedBy: []
      },
      {
        id: Date.now() + 1,
        groupId: groupId,
        name: 'Food Explorer',
        description: 'Visit 3 different restaurants',
        reward: 'ðŸ—ºï¸ Explorer',
        createdBy: 'Auto',
        completedBy: []
      },
      {
        id: Date.now() + 2,
        groupId: groupId,
        name: 'Taste Master',
        description: 'Rate 5 different dishes',
        reward: 'â­ Taste Master',
        createdBy: 'Auto',
        completedBy: []
      },
      {
        id: Date.now() + 3,
        groupId: groupId,
        name: 'Social Foodie',
        description: 'Share a meal with all group members',
        reward: 'ðŸ‘¥ Social Butterfly',
        createdBy: 'Auto',
        completedBy: []
      },
      {
        id: Date.now() + 4,
        groupId: groupId,
        name: 'Weekend Warrior',
        description: 'Try a new restaurant on the weekend',
        reward: 'ðŸŽ‰ Weekend Warrior',
        createdBy: 'Auto',
        completedBy: []
      }
    ]
    
    const newChallenges = [...challenges, ...defaultChallenges]
    setChallenges(newChallenges)
    saveChallenges(newChallenges)
  }

  function createGroup() {
    if (!name) return
    const g = { id: Date.now(), name, desc, members: [CURRENT_USER], leader: CURRENT_USER, pendingRequests: [], invites: [], joinPolicy: joinPolicy === 'open' ? 'open' : 'request' }
    const next = [g, ...groups]
    setGroups(next)
    saveGroups(next)
    
    // Auto-generate challenges for new group
    generateAutoChallenges(g.id, g.name)
    
    setName('')
    setDesc('')
    setJoinPolicy('request')
    setShowCreate(false)
  }

  function toggleJoin(gid) {
    const next = groups.map((g) => {
      if (g.id !== gid) return g
      const isMember = (g.members || []).includes(CURRENT_USER)
      // If already a member, allow leave
      if (isMember) {
        const members = (g.members || []).filter((m) => m !== CURRENT_USER)
        return { ...g, members }
      }
      // Request-only join: add to pending unless invited
      const alreadyPending = (g.pendingRequests || []).includes(CURRENT_USER)
      const invited = (g.invites || []).includes(CURRENT_USER)
      // If invited to any group, accept immediately
      if (invited) {
        const members = [...(g.members || []), CURRENT_USER]
        const invites = (g.invites || []).filter((u) => u !== CURRENT_USER)
        return { ...g, members, invites }
      }
      // If group is public/open, join immediately
      if ((g.joinPolicy || 'request') === 'open') {
        const members = [...(g.members || []), CURRENT_USER]
        return { ...g, members }
      }
      // Private/request group: create a pending request if not already requested
      if (!alreadyPending) {
        const pendingRequests = [...(g.pendingRequests || []), CURRENT_USER]
        // Notify leader via localStorage counter (Notifications will read groups)
        return { ...g, pendingRequests }
      }
      return g
    })
    setGroups(next)
    saveGroups(next)
    // Trigger header notification refresh
    window.dispatchEvent(new Event('notificationsViewed'))
  }

  function approveRequest(gid, user) {
    const next = groups.map((g) => {
      if (g.id !== gid) return g
      const pending = (g.pendingRequests || []).filter((u) => u !== user)
      const members = (g.members || []).includes(user) ? g.members : [...(g.members || []), user]
      return { ...g, pendingRequests: pending, members }
    })
    setGroups(next)
    saveGroups(next)
    window.dispatchEvent(new Event('notificationsViewed'))
  }

  function declineRequest(gid, user) {
    const next = groups.map((g) => {
      if (g.id !== gid) return g
      const pending = (g.pendingRequests || []).filter((u) => u !== user)
      return { ...g, pendingRequests: pending }
    })
    setGroups(next)
    saveGroups(next)
    window.dispatchEvent(new Event('notificationsViewed'))
  }

  function inviteUser(gid, user) {
    if (!user) return
    const next = groups.map((g) => {
      if (g.id !== gid) return g
      if ((g.members || []).includes(user)) return g
      const invites = (g.invites || []).includes(user) ? g.invites : [...(g.invites || []), user]
      return { ...g, invites }
    })
    setGroups(next)
    saveGroups(next)
  }

  function createChallenge() {
    if (!challengeName || !selectedGroup) return
    const challenge = {
      id: Date.now(),
      groupId: selectedGroup.id,
      name: challengeName,
      description: challengeDesc,
      reward: challengeReward || 'ðŸ† Champion Badge',
      createdBy: CURRENT_USER,
      completedBy: []
    }
    const next = [challenge, ...challenges]
    setChallenges(next)
    saveChallenges(next)
    setChallengeName('')
    setChallengeDesc('')
    setChallengeReward('')
    setShowCreateChallenge(false)
  }

  function completeChallenge(challengeId) {
    const next = challenges.map((c) => {
      if (c.id !== challengeId) return c
      if ((c.completedBy || []).includes(CURRENT_USER)) return c
      return { ...c, completedBy: [...(c.completedBy || []), CURRENT_USER] }
    })
    setChallenges(next)
    saveChallenges(next)

    // Award badge
    const challenge = next.find(c => c.id === challengeId)
    if (challenge) {
      const badge = {
        id: Date.now(),
        user: CURRENT_USER,
        groupId: challenge.groupId,
        challengeId: challengeId,
        name: challenge.reward,
        earnedAt: new Date().toISOString()
      }
      const newBadges = [badge, ...badges]
      setBadges(newBadges)
      saveBadges(newBadges)

      // Check if group earned badge (all members completed)
      const group = groups.find(g => g.id === challenge.groupId)
      if (group) {
        const allCompleted = (group.members || []).every(member => 
          (challenge.completedBy || []).includes(member)
        )
        if (allCompleted && group.members.length > 0) {
          const groupBadge = {
            id: Date.now() + 1,
            group: group.name,
            groupId: group.id,
            challengeId: challengeId,
            name: `ðŸŒŸ Group ${challenge.reward}`,
            earnedAt: new Date().toISOString()
          }
          const updatedBadges = [groupBadge, ...newBadges]
          setBadges(updatedBadges)
          saveBadges(updatedBadges)
        }
      }
    }
  }

  const isLeader = (group) => {
    return group.leader === CURRENT_USER || (group.members && group.members[0] === CURRENT_USER)
  }

  const getUserBadges = () => {
    return badges.filter(b => b.user === CURRENT_USER)
  }

  const getGroupBadges = (groupId) => {
    return badges.filter(b => b.groupId === groupId && b.group)
  }

  const getGroupChallenges = (groupId) => {
    return challenges.filter(c => c.groupId === groupId)
  }

  const getPostGroupLabel = (post) => {
    if (post?.groupName) return post.groupName
    if (!post?.groupId) return 'Community'
    const match = groups.find((g) => String(g.id) === String(post.groupId))
    return match?.name || `Group ${post.groupId}`
  }

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24">
      <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Groups</h2>
            <div className="text-sm text-gray-600 mt-1">Join or create groups for restaurants and food interests.</div>
            {getUserBadges().length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-xs font-semibold text-gray-700">My Badges:</span>
                {getUserBadges().slice(0, 5).map(b => (
                  <span key={b.id} className="text-2xl" title={b.name}>{b.name.split(' ')[0]}</span>
                ))}
                {getUserBadges().length > 5 && <span className="text-xs text-gray-500 font-medium">+{getUserBadges().length - 5} more</span>}
              </div>
            )}
          </div>
          <button onClick={() => setShowCreate(true)} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold">
            Create Group
          </button>
        </div>
      </div>
      {false && !selectedGroup && (
        <div className="grid gap-4">
          {groups.map((g) => (
            <div key={g.id} className="card-hover glass rounded-2xl p-6 shadow-lg flex items-center justify-between">
              <div className="flex-1">
                <div className="font-bold text-lg cursor-pointer hover:text-orange-600 transition-colors" onClick={() => setSelectedGroup(g)}>{g.name}</div>
                <div className="text-sm text-gray-600 mt-1">{g.desc}</div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs text-gray-500 font-medium">ðŸ‘¥ {(g.members || []).length} members</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    ((g.joinPolicy||'request')==='open') 
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md' 
                      : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-md'
                  }`}>
                    {((g.joinPolicy||'request')==='open') ? 'ðŸŒ Public' : 'ðŸ”’ Private'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!(g.members||[]).includes(CURRENT_USER) && (g.invites||[]).includes(CURRENT_USER) ? (
                  <button onClick={() => toggleJoin(g.id)} className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold">
                    âœ“ Accept Invite
                  </button>
                ) : (
                  <button onClick={() => toggleJoin(g.id)} className={`px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold ${
                    (g.members || []).includes(CURRENT_USER)
                      ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                      : (((g.pendingRequests||[]).includes(CURRENT_USER) && ((g.joinPolicy||'request')!=='open'))
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                  )}`}>
                    {(g.members || []).includes(CURRENT_USER) ? 'Leave' : (((g.pendingRequests||[]).includes(CURRENT_USER) && ((g.joinPolicy||'request')!=='open')) ? 'â³ Requested' : 'Join')}
                  </button>
                )}
                <button onClick={() => setSelectedGroup(g)} className="px-5 py-2.5 glass hover:bg-white/50 rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-gray-700">
                  View Posts
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {false && selectedGroup && (
        <div>
          <div className="glass rounded-2xl p-6 mb-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{selectedGroup.name}</h3>
                <div className="text-sm text-gray-600 mt-1">{selectedGroup.desc}</div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${((selectedGroup.joinPolicy||'request')==='open') ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'} shadow-md`}>
                    {((selectedGroup.joinPolicy||'request')==='open') ? 'ðŸŒ Public Group' : 'ðŸ”’ Private Group'}
                  </span>
                  <span className="text-xs text-gray-600 font-medium">ðŸ‘¥ {(selectedGroup.members || []).length} members</span>
                  {getGroupBadges(selectedGroup.id).length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">Group Badges:</span>
                      {getGroupBadges(selectedGroup.id).map(b => (
                        <span key={b.id} className="text-2xl" title={b.name}>{b.name.split(' ')[1]}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedGroup(null)} className="px-5 py-2.5 glass hover:bg-white/50 rounded-xl shadow-md hover:shadow-lg transition-all font-semibold text-gray-700">
                  â† Back
                </button>
                {!(selectedGroup.members||[]).includes(CURRENT_USER) && (selectedGroup.invites||[]).includes(CURRENT_USER) && (
                  <button onClick={() => toggleJoin(selectedGroup.id)} className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold">
                    âœ“ Accept Invite
                  </button>
                )}
                <button onClick={() => toggleJoin(selectedGroup.id)} className={`px-5 py-2.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold ${
                  (selectedGroup.members||[]).includes(CURRENT_USER)
                    ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                    : (((selectedGroup.pendingRequests||[]).includes(CURRENT_USER) && ((selectedGroup.joinPolicy||'request')!=='open'))
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                )}`}>
                  {(selectedGroup.members||[]).includes(CURRENT_USER) ? 'Leave' : (((selectedGroup.pendingRequests||[]).includes(CURRENT_USER) && ((selectedGroup.joinPolicy||'request')!=='open')) ? 'â³ Requested' : 'Join')}
                </button>
                {(selectedGroup.members||[]).includes(CURRENT_USER) && (
                  <button onClick={() => setShowAddPost(true)} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold">
                    + Add Rating
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Challenges Tab */}
          <div className="flex gap-3 mb-6">
            <button 
              onClick={() => setShowChallenges(false)} 
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                !showChallenges 
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-xl' 
                  : 'glass hover:bg-white/50 text-gray-700'
              }`}
            >
              ðŸ´ Restaurants
            </button>
            <button 
              onClick={() => setShowChallenges(true)} 
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                showChallenges 
                  ? 'bg-gradient-to-r from-orange-600 to-red-700 text-white shadow-lg hover:shadow-xl' 
                  : 'glass hover:bg-white/50 text-gray-700'
              }`}
            >
              ðŸ† Challenges
            </button>
          </div>

          {!showChallenges && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-4">ðŸ´ Restaurants tried by members:</div>
              <div className="grid gap-4">
                {/** derive unique restaurants from posts associated with this group; gate by membership for private groups */}
                {(((selectedGroup.joinPolicy||'request')==='request') && !(selectedGroup.members||[]).includes(CURRENT_USER)) ? (
                  (selectedGroup.pendingRequests||[]).includes(CURRENT_USER) ? (
                    <div className="glass rounded-2xl p-8 text-center">
                      <div className="text-5xl mb-3">â³</div>
                      <div className="text-gray-600 font-medium">Waiting for group leader to accept your requestâ€¦</div>
                    </div>
                  ) : (
                    <div className="glass rounded-2xl p-8 text-center">
                      <div className="text-5xl mb-3">ðŸ”’</div>
                      <div className="text-gray-600 font-medium">Join the group to view posts.</div>
                    </div>
                  )
                ) : (
                  Array.from(new Map(allPosts.filter(p => String(p.groupId) === String(selectedGroup.id)).map(p => [p.restaurant, p])).values()).map((p) => (
                  <div key={p.id} className="card-hover glass rounded-2xl p-4 shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {p.image && <img src={p.image} alt="" className="w-16 h-16 object-cover rounded-xl shadow-md" />}
                      <div>
                        <div className="font-bold text-gray-900">{p.restaurant}</div>
                        <div className="text-sm text-gray-600 mt-1">{p.dish}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedPost(p)} className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all font-semibold">
                        View Menu
                      </button>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          )}

          {showChallenges && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-gray-700">ðŸ† Group Challenges:</div>
                {isLeader(selectedGroup) && (
                  <button 
                    onClick={() => setShowCreateChallenge(true)} 
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-red-700 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold"
                  >
                    + Create Challenge
                  </button>
                )}
              </div>
              {isLeader(selectedGroup) && (
                <div className="glass rounded-2xl p-5 shadow-lg mb-4">
                  <div className="font-bold text-lg mb-4 bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">ðŸ’¼ Membership</div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-semibold text-gray-700">Privacy:</span>
                    <select
                      value={(selectedGroup.joinPolicy||'request')}
                      onChange={(e) => {
                        const val = e.target.value
                        const next = groups.map(g => {
                          if (g.id !== selectedGroup.id) return g
                          if (val === 'open') {
                            // auto-accept all pending when switching to public
                            const members = Array.from(new Set([...(g.members||[]), ...((g.pendingRequests||[]))]))
                            return { ...g, joinPolicy: 'open', members, pendingRequests: [] }
                          }
                          return { ...g, joinPolicy: 'request' }
                        })
                        setGroups(next)
                        saveGroups(next)
                        const updatedSelected = next.find(g => g.id === selectedGroup.id)
                        setSelectedGroup(updatedSelected)
                        window.dispatchEvent(new Event('notificationsViewed'))
                      }}
                      className="flex-1 border-2 border-gray-200 p-3 rounded-xl font-medium text-gray-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                    >
                      <option value="open">ðŸŒ Public (Anyone can join)</option>
                      <option value="request">ðŸ”’ Private (Request to join)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="flex-1 border-2 border-gray-200 p-3 rounded-xl font-medium focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all"
                      placeholder="Invite user by name"
                    />
                    <button
                      onClick={() => {
                        inviteUser(selectedGroup.id, inviteName.trim())
                        setInviteName('')
                      }}
                      className="px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold"
                    >
                      âœ‰ Invite
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-gray-700 mb-3">ðŸ“¥ Pending requests:</div>
                  {!(selectedGroup.pendingRequests||[]).length && (
                    <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl text-center">âœ“ No pending requests</div>
                  )}
                  <div className="space-y-3">
                    {(selectedGroup.pendingRequests||[]).map((u) => (
                      <div key={u} className="card-hover glass rounded-xl p-4 shadow-md flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
                            {u.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{u}</div>
                            <div className="text-xs text-gray-500">wants to join</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => approveRequest(selectedGroup.id, u)} className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-md hover:shadow-lg hover:scale-105 transition-all text-sm font-semibold">
                            âœ“ Accept
                          </button>
                          <button onClick={() => declineRequest(selectedGroup.id, u)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl shadow-md transition-all text-sm font-semibold">
                            âœ• Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-4">
                {getGroupChallenges(selectedGroup.id).length === 0 && (
                  <div className="glass rounded-2xl p-8 text-center">
                    <div className="text-5xl mb-3">ðŸ†</div>
                    <div className="text-gray-600 font-medium">
                      {isLeader(selectedGroup) ? 'Create a challenge to get started!' : 'Ask your group leader to create challenges!'}
                    </div>
                  </div>
                )}
                {getGroupChallenges(selectedGroup.id).map((challenge) => {
                  const isCompleted = (challenge.completedBy || []).includes(CURRENT_USER)
                  const completionCount = (challenge.completedBy || []).length
                  const totalMembers = (selectedGroup.members || []).length
                  const progressPercent = totalMembers > 0 ? (completionCount / totalMembers) * 100 : 0
                  return (
                    <div key={challenge.id} className="card-hover glass rounded-2xl p-6 shadow-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-lg text-gray-900">{challenge.name}</h4>
                            {isCompleted && <span className="text-2xl">âœ“</span>}
                          </div>
                          <div className="text-sm text-gray-600 mb-3">{challenge.description}</div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-md">
                              {challenge.reward}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                            <div className="bg-gradient-to-r from-green-400 to-emerald-600 h-2.5 rounded-full transition-all" style={{width: `${progressPercent}%`}}></div>
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            ðŸŽ¯ {completionCount}/{totalMembers} members completed
                          </div>
                        </div>
                        {!isCompleted && (selectedGroup.members || []).includes(CURRENT_USER) && (
                          <button 
                            onClick={() => completeChallenge(challenge.id)}
                            className="px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold"
                          >
                            âœ“ Complete
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {showAddPost && (
        <AddPost initialGroupId={selectedGroup?.id} onCancel={() => setShowAddPost(false)} onSubmit={(post) => {
          try { allPosts.unshift(post) } catch (e) {}
          try {
            const needle = (post.restaurant || '').toLowerCase()
            let r = dataRestaurants.find((x) => (x.name || '').toLowerCase() === needle)
            if (r) {
              r.menu = r.menu || []
              r.menu.unshift({ name: post.dish, rating: post.rating, image: post.image })
              const all = r.menu.map((i) => i.rating).filter(Boolean)
              r.avgRating = all.length ? (all.reduce((s, v) => s + v, 0) / all.length) : null
            } else {
              r = { id: Date.now(), name: post.restaurant, lat: post.lat || 0, lon: post.lon || 0, image: post.image || '', menu: [{ name: post.dish, rating: post.rating, image: post.image }], avgRating: post.rating }
              dataRestaurants.unshift(r)
            }
          } catch (e) {}
          // ensure group menu list updates if needed
          setShowAddPost(false)
          setSelectedPost(post)
        }} />
      )}

      {showCreateChallenge && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="glass rounded-3xl p-6 w-full max-w-md shadow-2xl border border-white/30 animate-slideUp">
            <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-orange-600 to-red-700 bg-clip-text text-transparent">ðŸ† Create Challenge</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Challenge Name</label>
                <input 
                  value={challengeName} 
                  onChange={(e) => setChallengeName(e.target.value)} 
                  className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all" 
                  placeholder="e.g., Try 5 new restaurants"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea 
                  value={challengeDesc} 
                  onChange={(e) => setChallengeDesc(e.target.value)} 
                  className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all" 
                  placeholder="Describe the challenge..."
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Badge Reward (emoji + name)</label>
                <input 
                  value={challengeReward} 
                  onChange={(e) => setChallengeReward(e.target.value)} 
                  className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all" 
                  placeholder="e.g., ðŸ• Pizza Master"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreateChallenge(false)} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all">
                Cancel
              </button>
              <button onClick={createChallenge} className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-700 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="glass rounded-3xl p-6 w-full max-w-md shadow-2xl border border-white/30 animate-slideUp">
            <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">ðŸ‘¥ Create Group</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Group Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all" placeholder="Enter group name" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all" placeholder="What's this group about?" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Privacy</label>
                <select value={joinPolicy} onChange={(e) => setJoinPolicy(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all font-medium">
                  <option value="open">ðŸŒ Public (Anyone can join)</option>
                  <option value="request">ðŸ”’ Private (Request to join)</option>
                </select>
              </div>
              <div className="text-xs text-gray-500">ðŸ‘¥ Members on creation: 1 (You)</div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all">
                Cancel
              </button>
              <button onClick={createGroup} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all font-semibold">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-full max-w-3xl">
            <MenuView post={selectedPost} onBack={() => setSelectedPost(null)} />
          </div>
        </div>
      )}


      {/* Restaurant Posts Section */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Restaurant Posts</h2>
        {groupPosts.length === 0 ? (
          <div className="text-gray-400 text-sm mb-4">No restaurant posts yet.</div>
        ) : (
          <div className="space-y-4">
            {groupPosts.map((post) => {
              const groupLabel = getPostGroupLabel(post)
              return (
                <div
                  key={post.id || `${post.restaurant}-${post.dish}-${post.timestamp || 'post'}`}
                  className="glass rounded-xl p-4 shadow-md cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setSelectedPost(post)}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <img
                      src={post.user?.avatar || 'https://i.pravatar.cc/64?img=1'}
                      alt="avatar"
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">{post.user?.name || 'You'}</div>
                      <div className="text-xs text-gray-500">{new Date(post.timestamp || Date.now()).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="font-bold text-orange-700 text-lg mb-1">{post.restaurant}</div>
                  <div className="text-xs text-gray-600 mb-2">Posted for: <span className="font-semibold text-gray-700">{groupLabel}</span></div>
                  <div className="text-sm text-gray-700 mb-2">{post.caption}</div>
                  {post.image && <img src={post.image} alt="dish" className="w-full h-40 object-cover rounded-xl mb-2" />}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {typeof post.rating === 'number' && <span>Rating: {post.rating.toFixed(1)}</span>}
                    {post.dish && <span>Dish: {post.dish}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

