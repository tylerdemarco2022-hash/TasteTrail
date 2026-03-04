import React, { useState, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable,
  Modal, Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native'
import {
  Users, Plus, X, Trophy, ChevronLeft,
  Globe, Lock, Check, Clock, Star
} from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { emit } from '../utils/eventEmitter'

const GROUPS_KEY = 'taste-trails-groups'
const CHALLENGES_KEY = 'taste-trails-challenges'
const BADGES_KEY = 'taste-trails-badges'

async function load(key) {
  try { const r = await AsyncStorage.getItem(key); return r ? JSON.parse(r) : [] } catch { return [] }
}
async function save(key, val) {
  try { await AsyncStorage.setItem(key, JSON.stringify(val)) } catch {}
}

function generateAutoChallenges(groupId) {
  const now = Date.now()
  return [
    { id: now, groupId, name: 'First Bite', description: 'Try your first restaurant with the group', reward: '🍽️ First Bite', createdBy: 'Auto', completedBy: [] },
    { id: now + 1, groupId, name: 'Food Explorer', description: 'Visit 3 different restaurants', reward: '🗺️ Explorer', createdBy: 'Auto', completedBy: [] },
    { id: now + 2, groupId, name: 'Taste Master', description: 'Rate 5 different dishes', reward: '⭐ Taste Master', createdBy: 'Auto', completedBy: [] },
    { id: now + 3, groupId, name: 'Social Foodie', description: 'Share a meal with all group members', reward: '👥 Social Butterfly', createdBy: 'Auto', completedBy: [] },
    { id: now + 4, groupId, name: 'Weekend Warrior', description: 'Try a new restaurant on the weekend', reward: '🎉 Weekend Warrior', createdBy: 'Auto', completedBy: [] },
  ]
}

export default function GroupsScreen() {
  const { profile, user } = useAuth()
  const insets = useSafeAreaInsets()
  const CURRENT_USER = profile?.name || user?.email?.split('@')[0] || 'You'

  const [groups, setGroups] = useState([])
  const [challenges, setChallenges] = useState([])
  const [badges, setBadges] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groupTab, setGroupTab] = useState('restaurants') // 'restaurants' | 'challenges'

  // Create group form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [joinPolicy, setJoinPolicy] = useState('request')

  // Create challenge form
  const [showCreateChallenge, setShowCreateChallenge] = useState(false)
  const [challengeName, setChallengeName] = useState('')
  const [challengeDesc, setChallengeDesc] = useState('')
  const [challengeReward, setChallengeReward] = useState('')

  // Invite
  const [inviteName, setInviteName] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const g = await load(GROUPS_KEY)
    if (g.length === 0) {
      const seed = [
        { id: 1, name: 'Downtown Lunchers', desc: 'Quick lunches and best daily specials', members: ['Maya'], leader: 'Maya', pendingRequests: [], invites: [], joinPolicy: 'request' },
        { id: 2, name: 'Pasta Lovers', desc: 'All things pasta', members: [], leader: CURRENT_USER, pendingRequests: [], invites: [], joinPolicy: 'request' },
      ]
      setGroups(seed)
      await save(GROUPS_KEY, seed)
    } else {
      setGroups(g)
    }
    setChallenges(await load(CHALLENGES_KEY))
    setBadges(await load(BADGES_KEY))
  }

  async function updateGroups(next) {
    setGroups(next)
    await save(GROUPS_KEY, next)
    // Keep selectedGroup in sync
    if (selectedGroup) {
      const updated = next.find(g => g.id === selectedGroup.id)
      if (updated) setSelectedGroup(updated)
    }
    emit('notificationsViewed')
  }

  async function updateChallenges(next) {
    setChallenges(next)
    await save(CHALLENGES_KEY, next)
  }

  async function updateBadges(next) {
    setBadges(next)
    await save(BADGES_KEY, next)
  }

  // ── Create group ──────────────────────────────────────────────────────────
  async function handleCreateGroup() {
    if (!newName.trim()) return
    const g = {
      id: Date.now(),
      name: newName.trim(),
      desc: newDesc.trim(),
      members: [CURRENT_USER],
      leader: CURRENT_USER,
      pendingRequests: [],
      invites: [],
      joinPolicy,
    }
    await updateGroups([g, ...groups])
    const autoChallenges = generateAutoChallenges(g.id)
    await updateChallenges([...challenges, ...autoChallenges])
    setNewName(''); setNewDesc(''); setJoinPolicy('request'); setShowCreate(false)
  }

  // ── Join / Leave / Request ────────────────────────────────────────────────
  async function handleToggleJoin(gid) {
    const next = groups.map(g => {
      if (g.id !== gid) return g
      const isMember = (g.members || []).includes(CURRENT_USER)
      if (isMember) {
        return { ...g, members: g.members.filter(m => m !== CURRENT_USER) }
      }
      const invited = (g.invites || []).includes(CURRENT_USER)
      if (invited) {
        return { ...g, members: [...(g.members || []), CURRENT_USER], invites: g.invites.filter(u => u !== CURRENT_USER) }
      }
      if ((g.joinPolicy || 'request') === 'open') {
        return { ...g, members: [...(g.members || []), CURRENT_USER] }
      }
      const alreadyPending = (g.pendingRequests || []).includes(CURRENT_USER)
      if (!alreadyPending) {
        return { ...g, pendingRequests: [...(g.pendingRequests || []), CURRENT_USER] }
      }
      return g
    })
    await updateGroups(next)
  }

  // ── Leader: approve / decline ─────────────────────────────────────────────
  async function handleApproveRequest(gid, user) {
    const next = groups.map(g => {
      if (g.id !== gid) return g
      const pending = (g.pendingRequests || []).filter(u => u !== user)
      const members = (g.members || []).includes(user) ? g.members : [...(g.members || []), user]
      return { ...g, pendingRequests: pending, members }
    })
    await updateGroups(next)
  }

  async function handleDeclineRequest(gid, user) {
    const next = groups.map(g => {
      if (g.id !== gid) return g
      return { ...g, pendingRequests: (g.pendingRequests || []).filter(u => u !== user) }
    })
    await updateGroups(next)
  }

  // ── Invite user ───────────────────────────────────────────────────────────
  async function handleInvite(gid) {
    const name = inviteName.trim()
    if (!name) return
    const next = groups.map(g => {
      if (g.id !== gid) return g
      if ((g.members || []).includes(name)) return g
      const invites = (g.invites || []).includes(name) ? g.invites : [...(g.invites || []), name]
      return { ...g, invites }
    })
    await updateGroups(next)
    setInviteName('')
    Alert.alert('Invite Sent', `${name} has been invited to the group.`)
  }

  // ── Create challenge ──────────────────────────────────────────────────────
  async function handleCreateChallenge() {
    if (!challengeName.trim() || !selectedGroup) return
    const challenge = {
      id: Date.now(),
      groupId: selectedGroup.id,
      name: challengeName.trim(),
      description: challengeDesc.trim(),
      reward: challengeReward.trim() || '🏆 Champion Badge',
      createdBy: CURRENT_USER,
      completedBy: [],
    }
    await updateChallenges([challenge, ...challenges])
    setChallengeName(''); setChallengeDesc(''); setChallengeReward(''); setShowCreateChallenge(false)
  }

  // ── Complete challenge ────────────────────────────────────────────────────
  async function handleCompleteChallenge(challengeId) {
    const next = challenges.map(c => {
      if (c.id !== challengeId) return c
      if ((c.completedBy || []).includes(CURRENT_USER)) return c
      return { ...c, completedBy: [...(c.completedBy || []), CURRENT_USER] }
    })
    await updateChallenges(next)

    const challenge = next.find(c => c.id === challengeId)
    if (challenge) {
      const badge = {
        id: Date.now(),
        user: CURRENT_USER,
        groupId: challenge.groupId,
        challengeId,
        name: challenge.reward,
        icon: challenge.reward.split(' ')[0],
        earnedAt: new Date().toISOString(),
      }
      const newBadges = [badge, ...badges]
      await updateBadges(newBadges)
      emit('ratingSaved') // refresh Profile badge count
      Alert.alert('Badge Earned! 🎉', `You earned: ${challenge.reward}`)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isLeader = g => g.leader === CURRENT_USER || (g.members && g.members[0] === CURRENT_USER)
  const isMember = g => (g.members || []).includes(CURRENT_USER)
  const isPending = g => (g.pendingRequests || []).includes(CURRENT_USER)
  const isInvited = g => (g.invites || []).includes(CURRENT_USER)
  const myBadges = badges.filter(b => b.user === CURRENT_USER)
  const getGroupChallenges = gid => challenges.filter(c => c.groupId === gid)

  // ── Join button label / style ─────────────────────────────────────────────
  function joinButtonProps(g) {
    if (isInvited(g) && !isMember(g)) return { label: '✓ Accept Invite', color: 'bg-green-500' }
    if (isMember(g)) return { label: 'Leave', color: 'bg-gray-500' }
    if (isPending(g) && g.joinPolicy !== 'open') return { label: '⏳ Requested', color: 'bg-gray-300', disabled: true }
    return { label: 'Join', color: 'bg-orange-500' }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SELECTED GROUP VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (selectedGroup) {
    const groupChallenges = getGroupChallenges(selectedGroup.id)
    const btnProps = joinButtonProps(selectedGroup)
    const canSeeContent = isMember(selectedGroup) || (selectedGroup.joinPolicy || 'request') === 'open'

    return (
      <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
        {/* Group header */}
        <View className="bg-white px-4 pt-3 pb-4 shadow-sm">
          <View className="flex-row items-center mb-3">
            <Pressable onPress={() => setSelectedGroup(null)} className="mr-3">
              <ChevronLeft size={24} color="#6b7280" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-lg font-black text-gray-900" numberOfLines={1}>{selectedGroup.name}</Text>
              {selectedGroup.desc ? <Text className="text-xs text-gray-500">{selectedGroup.desc}</Text> : null}
            </View>
          </View>

          {/* Meta row */}
          <View className="flex-row items-center gap-3 mb-3">
            <View className="flex-row items-center bg-gray-100 rounded-full px-3 py-1">
              {(selectedGroup.joinPolicy || 'request') === 'open'
                ? <Globe size={12} color="#10b981" />
                : <Lock size={12} color="#6b7280" />}
              <Text className="text-xs font-semibold text-gray-600 ml-1">
                {(selectedGroup.joinPolicy || 'request') === 'open' ? 'Public' : 'Private'}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Users size={12} color="#9ca3af" />
              <Text className="text-xs text-gray-500 ml-1">{(selectedGroup.members || []).length} members</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => !btnProps.disabled && handleToggleJoin(selectedGroup.id)}
              className={`flex-1 py-2.5 rounded-xl items-center ${btnProps.color}`}
            >
              <Text className={`font-bold text-sm ${btnProps.color === 'bg-gray-300' ? 'text-gray-600' : 'text-white'}`}>
                {btnProps.label}
              </Text>
            </Pressable>
            {isMember(selectedGroup) && isLeader(selectedGroup) && (
              <Pressable
                onPress={() => setShowCreateChallenge(true)}
                className="flex-1 py-2.5 rounded-xl items-center bg-orange-100"
              >
                <Text className="font-bold text-sm text-orange-600">+ Challenge</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Pending requests (leader only) */}
        {isLeader(selectedGroup) && (selectedGroup.pendingRequests || []).length > 0 && (
          <View className="bg-amber-50 mx-4 mt-3 rounded-xl p-3">
            <Text className="text-xs font-bold text-amber-700 mb-2">
              {(selectedGroup.pendingRequests || []).length} Pending Request{(selectedGroup.pendingRequests || []).length > 1 ? 's' : ''}
            </Text>
            {(selectedGroup.pendingRequests || []).map(u => (
              <View key={u} className="flex-row items-center justify-between mb-1">
                <Text className="text-sm text-gray-800">{u}</Text>
                <View className="flex-row gap-2">
                  <Pressable onPress={() => handleApproveRequest(selectedGroup.id, u)} className="bg-green-500 rounded-lg px-3 py-1">
                    <Text className="text-white text-xs font-bold">Accept</Text>
                  </Pressable>
                  <Pressable onPress={() => handleDeclineRequest(selectedGroup.id, u)} className="bg-gray-200 rounded-lg px-3 py-1">
                    <Text className="text-gray-600 text-xs font-bold">Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Invite (leader only) */}
        {isLeader(selectedGroup) && isMember(selectedGroup) && (
          <View className="mx-4 mt-3 flex-row gap-2">
            <TextInput
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 bg-white text-sm text-gray-800"
              placeholder="Invite someone by name…"
              placeholderTextColor="#9ca3af"
              value={inviteName}
              onChangeText={setInviteName}
            />
            <Pressable
              onPress={() => handleInvite(selectedGroup.id)}
              className="bg-orange-500 rounded-xl px-4 items-center justify-center"
            >
              <Text className="text-white font-bold text-sm">Invite</Text>
            </Pressable>
          </View>
        )}

        {/* Tabs */}
        <View className="flex-row mx-4 mt-3 bg-gray-100 rounded-xl p-1">
          {[{ id: 'restaurants', label: '🍴 Restaurants' }, { id: 'challenges', label: '🏆 Challenges' }].map(t => (
            <Pressable
              key={t.id}
              onPress={() => setGroupTab(t.id)}
              className={`flex-1 py-2 rounded-xl items-center ${groupTab === t.id ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`text-sm font-semibold ${groupTab === t.id ? 'text-orange-500' : 'text-gray-500'}`}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {/* Restaurants tab */}
          {groupTab === 'restaurants' && (
            canSeeContent ? (
              <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
                <Text className="text-4xl mb-3">🍽️</Text>
                <Text className="text-gray-500 text-center">Restaurant posts shared by members will appear here.</Text>
              </View>
            ) : (
              <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
                <Lock size={36} color="#d1d5db" />
                <Text className="text-gray-400 mt-3 text-center">
                  {isPending(selectedGroup)
                    ? '⏳ Waiting for group leader to accept your request…'
                    : 'Join the group to view posts.'}
                </Text>
              </View>
            )
          )}

          {/* Challenges tab */}
          {groupTab === 'challenges' && (
            <View>
              {groupChallenges.length === 0 ? (
                <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
                  <Trophy size={36} color="#d1d5db" />
                  <Text className="text-gray-400 mt-3 text-center">No challenges yet.{isLeader(selectedGroup) ? ' Tap "+ Challenge" to create one.' : ''}</Text>
                </View>
              ) : (
                groupChallenges.map(challenge => {
                  const completed = (challenge.completedBy || []).includes(CURRENT_USER)
                  const totalMembers = (selectedGroup.members || []).length
                  const completedCount = (challenge.completedBy || []).length
                  return (
                    <View key={challenge.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-1 mr-3">
                          <Text className="font-bold text-gray-900">{challenge.name}</Text>
                          <Text className="text-xs text-gray-500 mt-0.5">{challenge.description}</Text>
                          <View className="flex-row items-center mt-1">
                            <Star size={10} color="#f59e0b" fill="#f59e0b" />
                            <Text className="text-xs text-amber-600 ml-1 font-medium">{challenge.reward}</Text>
                          </View>
                        </View>
                        <Trophy size={18} color="#f59e0b" />
                      </View>

                      {/* Progress */}
                      <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <View
                          className="h-full bg-orange-400 rounded-full"
                          style={{ width: totalMembers > 0 ? `${(completedCount / totalMembers) * 100}%` : '0%' }}
                        />
                      </View>
                      <Text className="text-xs text-gray-400 mb-3">
                        {completedCount}/{totalMembers} members completed
                      </Text>

                      {isMember(selectedGroup) && (
                        completed ? (
                          <View className="flex-row items-center bg-green-50 rounded-xl px-3 py-2">
                            <Check size={14} color="#10b981" />
                            <Text className="text-green-600 text-sm font-semibold ml-2">Completed ✓</Text>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleCompleteChallenge(challenge.id)}
                            className="bg-orange-500 rounded-xl py-2 items-center"
                          >
                            <Text className="text-white text-sm font-bold">Mark Complete</Text>
                          </Pressable>
                        )
                      )}
                    </View>
                  )
                })
              )}
            </View>
          )}
        </ScrollView>

        {/* Create Challenge Modal */}
        <Modal visible={showCreateChallenge} transparent animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
            <View className="bg-black/30 flex-1 justify-end">
              <View className="bg-white rounded-t-3xl p-6">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-bold text-gray-900">Create Challenge</Text>
                  <Pressable onPress={() => setShowCreateChallenge(false)}>
                    <X size={20} color="#6b7280" />
                  </Pressable>
                </View>
                <TextInput
                  className="border border-gray-200 rounded-xl px-3 py-3 mb-3 bg-gray-50 text-gray-800"
                  placeholder="Challenge name *"
                  placeholderTextColor="#9ca3af"
                  value={challengeName}
                  onChangeText={setChallengeName}
                />
                <TextInput
                  className="border border-gray-200 rounded-xl px-3 py-3 mb-3 bg-gray-50 text-gray-800"
                  placeholder="Description"
                  placeholderTextColor="#9ca3af"
                  value={challengeDesc}
                  onChangeText={setChallengeDesc}
                  multiline
                />
                <TextInput
                  className="border border-gray-200 rounded-xl px-3 py-3 mb-5 bg-gray-50 text-gray-800"
                  placeholder="Reward badge name (e.g. 🏆 Champion)"
                  placeholderTextColor="#9ca3af"
                  value={challengeReward}
                  onChangeText={setChallengeReward}
                />
                <Pressable
                  onPress={handleCreateChallenge}
                  disabled={!challengeName.trim()}
                  className={`py-3.5 rounded-xl items-center ${challengeName.trim() ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                  <Text className={`font-bold ${challengeName.trim() ? 'text-white' : 'text-gray-400'}`}>Create Challenge</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GROUPS LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-4 pt-3 pb-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-2xl font-black text-gray-900">Groups</Text>
          <Pressable
            onPress={() => setShowCreate(true)}
            className="flex-row items-center bg-orange-500 px-4 py-2 rounded-full"
          >
            <Plus size={14} color="#fff" />
            <Text className="text-white text-sm font-bold ml-1">Create</Text>
          </Pressable>
        </View>
        <Text className="text-sm text-gray-500 mb-2">Join groups, share restaurants, complete challenges.</Text>

        {/* My Badges */}
        {myBadges.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-1">
            {myBadges.slice(0, 8).map((b, i) => (
              <Text key={i} className="text-2xl mr-1" title={b.name}>{b.icon || '🏅'}</Text>
            ))}
            {myBadges.length > 8 && (
              <View className="bg-gray-100 rounded-full px-2 items-center justify-center">
                <Text className="text-xs text-gray-500 font-medium">+{myBadges.length - 8}</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Group List */}
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {groups.length === 0 ? (
          <View className="bg-white rounded-2xl p-10 items-center shadow-sm">
            <Users size={40} color="#d1d5db" />
            <Text className="text-gray-400 mt-3 text-center">No groups yet. Create one to start sharing food adventures!</Text>
          </View>
        ) : (
          groups.map(g => {
            const btn = joinButtonProps(g)
            const groupChallenges = getGroupChallenges(g.id)
            return (
              <Pressable
                key={g.id}
                onPress={() => { setSelectedGroup(g); setGroupTab('restaurants') }}
                className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="font-bold text-gray-900 text-base">{g.name}</Text>
                    {g.desc ? <Text className="text-sm text-gray-500 mt-0.5">{g.desc}</Text> : null}
                    <View className="flex-row items-center gap-2 mt-2">
                      <View className="flex-row items-center">
                        {(g.joinPolicy || 'request') === 'open'
                          ? <Globe size={11} color="#10b981" />
                          : <Lock size={11} color="#9ca3af" />}
                        <Text className="text-xs text-gray-400 ml-0.5">
                          {(g.joinPolicy || 'request') === 'open' ? 'Public' : 'Private'}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Users size={11} color="#9ca3af" />
                        <Text className="text-xs text-gray-400 ml-0.5">{(g.members || []).length} members</Text>
                      </View>
                      {groupChallenges.length > 0 && (
                        <View className="flex-row items-center">
                          <Trophy size={11} color="#f59e0b" />
                          <Text className="text-xs text-amber-500 ml-0.5">{groupChallenges.length} challenges</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Pressable
                    onPress={e => { e.stopPropagation?.(); !btn.disabled && handleToggleJoin(g.id) }}
                    className={`px-4 py-2 rounded-xl ${btn.color}`}
                  >
                    <Text className={`text-xs font-bold ${btn.color === 'bg-gray-300' ? 'text-gray-600' : 'text-white'}`}>
                      {btn.label}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            )
          })
        )}
      </ScrollView>

      {/* Create Group Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
          <View className="bg-black/30 flex-1 justify-end">
            <View className="bg-white rounded-t-3xl p-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-gray-900">Create Group</Text>
                <Pressable onPress={() => setShowCreate(false)}>
                  <X size={20} color="#6b7280" />
                </Pressable>
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-1">Group Name *</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-3 py-3 mb-4 bg-gray-50 text-gray-800"
                placeholder="e.g. Charlotte Foodies"
                placeholderTextColor="#9ca3af"
                value={newName}
                onChangeText={setNewName}
              />

              <Text className="text-sm font-medium text-gray-700 mb-1">Description (optional)</Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-3 py-3 mb-4 bg-gray-50 text-gray-800"
                placeholder="What's this group about?"
                placeholderTextColor="#9ca3af"
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
                numberOfLines={2}
              />

              <Text className="text-sm font-medium text-gray-700 mb-2">Join Policy</Text>
              <View className="flex-row gap-3 mb-5">
                {[{ val: 'open', label: '🌐 Public', sub: 'Anyone can join' }, { val: 'request', label: '🔒 Private', sub: 'Requires approval' }].map(opt => (
                  <Pressable
                    key={opt.val}
                    onPress={() => setJoinPolicy(opt.val)}
                    className={`flex-1 border-2 rounded-xl p-3 ${joinPolicy === opt.val ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`}
                  >
                    <Text className="font-semibold text-gray-800 text-sm">{opt.label}</Text>
                    <Text className="text-xs text-gray-400 mt-0.5">{opt.sub}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={handleCreateGroup}
                disabled={!newName.trim()}
                className={`py-3.5 rounded-xl items-center ${newName.trim() ? 'bg-orange-500' : 'bg-gray-200'}`}
              >
                <Text className={`font-bold ${newName.trim() ? 'text-white' : 'text-gray-400'}`}>Create Group</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}
