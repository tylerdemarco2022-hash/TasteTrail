import crypto from 'crypto'
import { readJSON, writeJSON } from '../../backend/utils/localDB.js'

export function emptyGraph() {
  return {
    follows: [],
    requests: [],
    blocks: [],
    reports: [],
    posts: [],
    ratings: [],
    lists: [],
    activity: []
  }
}

export function slugName(value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
  return slug || 'user'
}

export function allocateUsername(users, name, userCode) {
  const list = Array.isArray(users) ? users : []
  const taken = new Set(list.map((user) => String(user?.username || '').toLowerCase()).filter(Boolean))
  const base = slugName(name)
  if (!taken.has(base)) return base
  const withCode = `${base}${String(userCode || '').toLowerCase()}`
  if (withCode !== base && !taken.has(withCode)) return withCode
  return `${base}${list.length + 1}`
}

export function usernameFor(user) {
  const explicit = String(user?.username || '').trim()
  if (explicit) return explicit
  if (user?.user_code) return String(user.user_code)
  return slugName(user?.name || 'user')
}

function normalizeGraph(raw) {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') return emptyGraph()
  return {
    follows: Array.isArray(raw.follows) ? raw.follows : [],
    requests: Array.isArray(raw.requests) ? raw.requests : [],
    blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
    reports: Array.isArray(raw.reports) ? raw.reports : [],
    posts: Array.isArray(raw.posts) ? raw.posts : [],
    ratings: Array.isArray(raw.ratings) ? raw.ratings : [],
    lists: Array.isArray(raw.lists) ? raw.lists : [],
    activity: Array.isArray(raw.activity) ? raw.activity : []
  }
}

function involves(row, userId) {
  return [
    row?.userId,
    row?.followerId,
    row?.followeeId,
    row?.fromId,
    row?.toId,
    row?.blockerId,
    row?.blockedId,
    row?.reporterId,
    row?.targetId
  ].includes(userId)
}

export function createSocialGraph({
  readUsers,
  readGraph,
  writeGraph,
  now = () => new Date().toISOString(),
  id = () => crypto.randomUUID()
} = {}) {
  function users() {
    const list = readUsers?.() 
    return Array.isArray(list) ? list : []
  }

  function graph() {
    return normalizeGraph(readGraph?.())
  }

  function save(next) {
    writeGraph?.(next)
  }

  function userById(userId) {
    return users().find((user) => user?.id === userId) || null
  }

  function blockedEither(a, b) {
    if (!a || !b) return false
    return graph().blocks.some((row) =>
      (row.blockerId === a && row.blockedId === b) ||
      (row.blockerId === b && row.blockedId === a)
    )
  }

  function isFollowing(followerId, followeeId) {
    return graph().follows.some((row) => row.followerId === followerId && row.followeeId === followeeId)
  }

  function pendingRequest(fromId, toId) {
    return graph().requests.find((row) => row.fromId === fromId && row.toId === toId && row.status === 'pending') || null
  }

  function canView(viewerId, target) {
    if (!target) return false
    if (viewerId && blockedEither(viewerId, target.id)) return false
    if (viewerId && viewerId === target.id) return true
    if (target.role === 'admin' && viewerId === target.id) return true
    if (!target.is_private) return true
    return Boolean(viewerId && isFollowing(viewerId, target.id))
  }

  function publicCard(user, viewerId) {
    const request = viewerId ? pendingRequest(viewerId, user.id) : null
    return {
      id: user.id,
      name: user.name || 'User',
      username: usernameFor(user),
      avatar: user.avatar || null,
      is_private: Boolean(user.is_private),
      isFollowing: Boolean(viewerId && isFollowing(viewerId, user.id)),
      followRequestStatus: request ? 'pending' : null
    }
  }

  function search(viewerId, query) {
    const q = String(query || '').trim().toLowerCase()
    if (q.length < 1) return []
    return users()
      .filter((user) => user?.id && user.id !== viewerId)
      .filter((user) => !blockedEither(viewerId, user.id))
      .filter((user) => {
        const name = String(user.name || '').toLowerCase()
        const username = usernameFor(user).toLowerCase()
        const code = String(user.user_code || '').toLowerCase()
        return name.includes(q) || username.includes(q) || code.includes(q)
      })
      .slice(0, 20)
      .map((user) => publicCard(user, viewerId))
  }

  function hiddenProfile(target, viewerId, blocked) {
    const card = publicCard(target, viewerId)
    return {
      user: {
        id: card.id,
        name: card.name,
        username: card.username,
        avatar: card.avatar,
        is_private: card.is_private
      },
      canView: false,
      blocked,
      isFollowing: false,
      followRequestStatus: blocked ? null : card.followRequestStatus,
      message: blocked ? 'You cannot view this account.' : 'This account is private',
      posts: [],
      ratings: [],
      lists: [],
      activity: [],
      counts: null
    }
  }

  function profile(viewerId, targetId) {
    const target = userById(targetId)
    if (!target) return { status: 404, body: { error: 'User not found' } }
    const blocked = blockedEither(viewerId, target.id)
    if (blocked || !canView(viewerId, target)) {
      return { status: 200, body: hiddenProfile(target, viewerId, blocked) }
    }
    const g = graph()
    const posts = g.posts.filter((post) => post.userId === target.id)
    const ratings = g.ratings.filter((rating) => rating.userId === target.id)
    const lists = g.lists.filter((list) => list.userId === target.id)
    const activity = g.activity.filter((item) => item.userId === target.id)
    const card = publicCard(target, viewerId)
    return {
      status: 200,
      body: {
        user: {
          id: card.id,
          name: card.name,
          username: card.username,
          avatar: card.avatar,
          is_private: card.is_private
        },
        canView: true,
        blocked: false,
        isFollowing: card.isFollowing,
        followRequestStatus: card.followRequestStatus,
        message: null,
        posts,
        ratings,
        lists,
        activity,
        counts: {
          posts: posts.length,
          ratings: ratings.length,
          lists: lists.length,
          followers: g.follows.filter((row) => row.followeeId === target.id).length,
          following: g.follows.filter((row) => row.followerId === target.id).length
        }
      }
    }
  }

  function contentFor(viewerId, targetId, kind) {
    const viewed = profile(viewerId, targetId)
    if (viewed.status !== 200) return viewed
    if (!viewed.body.canView) {
      return { status: 403, body: { error: viewed.body.message || 'This account is private', [kind]: [] } }
    }
    return { status: 200, body: { [kind]: viewed.body[kind] || [] } }
  }

  function follow(viewerId, targetId) {
    if (!viewerId) return { status: 401, body: { error: 'Sign in required' } }
    if (viewerId === targetId) return { status: 400, body: { error: 'You cannot follow yourself' } }
    const target = userById(targetId)
    if (!target) return { status: 404, body: { error: 'User not found' } }
    if (blockedEither(viewerId, targetId)) {
      return { status: 403, body: { error: 'You cannot follow this account.' } }
    }
    if (isFollowing(viewerId, targetId)) {
      return { status: 200, body: { status: 'following', message: 'Already following' } }
    }
    const g = graph()
    if (target.is_private) {
      const existing = pendingRequest(viewerId, targetId)
      if (existing) {
        return { status: 200, body: { status: 'pending', message: 'Request already sent', requestId: existing.id } }
      }
      const request = { id: id(), fromId: viewerId, toId: targetId, status: 'pending', createdAt: now() }
      g.requests.push(request)
      save(g)
      return { status: 200, body: { status: 'pending', message: 'Follow request sent', requestId: request.id } }
    }
    g.follows.push({ followerId: viewerId, followeeId: targetId, createdAt: now() })
    save(g)
    return { status: 200, body: { status: 'following', message: 'Following' } }
  }

  function unfollow(viewerId, targetId) {
    if (!viewerId) return { status: 401, body: { error: 'Sign in required' } }
    const g = graph()
    g.follows = g.follows.filter((row) => !(row.followerId === viewerId && row.followeeId === targetId))
    g.requests = g.requests.map((row) => {
      if (row.fromId === viewerId && row.toId === targetId && row.status === 'pending') {
        return { ...row, status: 'cancelled' }
      }
      return row
    })
    save(g)
    return { status: 200, body: { status: 'none', message: 'Updated' } }
  }

  function removeFollower(ownerId, followerId) {
    if (!ownerId) return { status: 401, body: { error: 'Sign in required' } }
    const g = graph()
    g.follows = g.follows.filter((row) => !(row.followerId === followerId && row.followeeId === ownerId))
    save(g)
    return { status: 200, body: { ok: true } }
  }

  function incoming(ownerId) {
    if (!ownerId) return { status: 401, body: { error: 'Sign in required' } }
    const requests = graph().requests
      .filter((row) => row.toId === ownerId && row.status === 'pending')
      .filter((row) => !blockedEither(ownerId, row.fromId))
      .map((row) => {
        const requester = userById(row.fromId)
        return {
          id: row.id,
          createdAt: row.createdAt,
          requester: requester
            ? { id: requester.id, name: requester.name || 'User', username: usernameFor(requester), avatar: requester.avatar || null }
            : { id: row.fromId, name: 'User', username: 'user', avatar: null }
        }
      })
    return { status: 200, body: { requests, followRequests: requests } }
  }

  function respond(ownerId, requestId, action) {
    if (!ownerId) return { status: 401, body: { error: 'Sign in required' } }
    const g = graph()
    const request = g.requests.find((row) => row.id === requestId && row.toId === ownerId && row.status === 'pending')
    if (!request) return { status: 404, body: { error: 'Request not found' } }
    if (blockedEither(ownerId, request.fromId)) {
      request.status = 'declined'
      save(g)
      return { status: 403, body: { error: 'You cannot follow this account.' } }
    }
    if (action === 'accept') {
      request.status = 'accepted'
      if (!g.follows.some((row) => row.followerId === request.fromId && row.followeeId === ownerId)) {
        g.follows.push({ followerId: request.fromId, followeeId: ownerId, createdAt: now() })
      }
    } else {
      request.status = 'declined'
    }
    save(g)
    return { status: 200, body: { ok: true, status: request.status } }
  }

  function block(viewerId, targetId) {
    if (!viewerId) return { status: 401, body: { error: 'Sign in required' } }
    if (!targetId || viewerId === targetId) return { status: 400, body: { error: 'You cannot block yourself' } }
    if (!userById(targetId)) return { status: 404, body: { error: 'User not found' } }
    const g = graph()
    if (!g.blocks.some((row) => row.blockerId === viewerId && row.blockedId === targetId)) {
      g.blocks.push({ blockerId: viewerId, blockedId: targetId, createdAt: now() })
    }
    g.follows = g.follows.filter((row) => !(
      (row.followerId === viewerId && row.followeeId === targetId) ||
      (row.followerId === targetId && row.followeeId === viewerId)
    ))
    g.requests = g.requests.map((row) => {
      const pair = (row.fromId === viewerId && row.toId === targetId) || (row.fromId === targetId && row.toId === viewerId)
      if (pair && row.status === 'pending') return { ...row, status: 'cancelled' }
      return row
    })
    save(g)
    return { status: 200, body: { ok: true } }
  }

  function report(viewerId, targetId, reason) {
    if (!viewerId) return { status: 401, body: { error: 'Sign in required' } }
    if (!userById(targetId)) return { status: 404, body: { error: 'User not found' } }
    const text = String(reason || '').trim().slice(0, 500)
    if (!text) return { status: 400, body: { error: 'A reason is required' } }
    const g = graph()
    const entry = { id: id(), reporterId: viewerId, targetId, reason: text, createdAt: now() }
    g.reports.push(entry)
    save(g)
    return { status: 200, body: { ok: true, message: 'Report received' } }
  }

  function connections(viewerId, targetId, kind) {
    const target = userById(targetId)
    if (!target) return { status: 404, body: { error: 'User not found' } }
    if (!canView(viewerId, target)) return { status: 200, body: { private: true, users: [] } }
    const rows = kind === 'followers'
      ? graph().follows.filter((row) => row.followeeId === targetId)
      : graph().follows.filter((row) => row.followerId === targetId)
    const list = rows.map((row) => {
      const personId = kind === 'followers' ? row.followerId : row.followeeId
      const person = userById(personId)
      if (!person || blockedEither(viewerId, person.id)) return null
      return publicCard(person, viewerId)
    }).filter(Boolean)
    return { status: 200, body: { private: false, users: list } }
  }

  function visiblePosts(viewerId) {
    return graph().posts.filter((post) => {
      const author = userById(post.userId)
      return author && canView(viewerId, author)
    })
  }

  function feed(viewerId) {
    if (!viewerId) return { status: 401, body: { error: 'Sign in required' } }
    const followed = new Set(
      graph().follows.filter((row) => row.followerId === viewerId).map((row) => row.followeeId)
    )
    const posts = visiblePosts(viewerId).filter((post) => post.userId === viewerId || followed.has(post.userId))
    return { status: 200, body: { posts } }
  }

  function addPost(userId, payload = {}) {
    if (!userId) return { status: 401, body: { error: 'Sign in required' } }
    const g = graph()
    const post = {
      id: id(),
      userId,
      dish: String(payload.dish || payload.dish_name || '').slice(0, 120),
      restaurant: String(payload.restaurant || payload.restaurant_name || '').slice(0, 120),
      caption: String(payload.caption || payload.content || '').slice(0, 500),
      rating: payload.rating ?? null,
      createdAt: now()
    }
    g.posts.push(post)
    g.activity.push({ id: id(), userId, type: 'post', text: post.caption || post.dish || 'Post', refId: post.id, createdAt: post.createdAt })
    save(g)
    return { status: 201, body: { post } }
  }

  function addRating(userId, payload = {}) {
    if (!userId) return { status: 401, body: { error: 'Sign in required' } }
    const g = graph()
    const rating = {
      id: id(),
      userId,
      dish_id: payload.dish_id || null,
      dish_name: String(payload.dish_name || payload.dish || '').slice(0, 120),
      restaurant_name: String(payload.restaurant_name || payload.restaurant || '').slice(0, 120),
      rating: Number(payload.rating) || null,
      rated_at: now()
    }
    g.ratings.push(rating)
    g.activity.push({ id: id(), userId, type: 'rating', text: rating.dish_name || 'Rating', refId: rating.id, createdAt: rating.rated_at })
    save(g)
    return { status: 201, body: { rating } }
  }

  function addList(userId, payload = {}) {
    if (!userId) return { status: 401, body: { error: 'Sign in required' } }
    const g = graph()
    const list = {
      id: id(),
      userId,
      name: String(payload.name || 'List').slice(0, 80),
      items: Array.isArray(payload.items) ? payload.items.slice(0, 50) : [],
      createdAt: now()
    }
    g.lists.push(list)
    g.activity.push({ id: id(), userId, type: 'list', text: list.name, refId: list.id, createdAt: list.createdAt })
    save(g)
    return { status: 201, body: { list } }
  }

  function ratingsVisibleTo(viewerId, { userId, dishId } = {}) {
    return graph().ratings.filter((rating) => {
      if (userId && rating.userId !== userId) return false
      if (dishId && String(rating.dish_id) !== String(dishId)) return false
      const author = userById(rating.userId)
      return author && canView(viewerId, author)
    }).map((rating) => {
      const author = userById(rating.userId)
      return {
        id: rating.id,
        user_id: rating.userId,
        dish_id: rating.dish_id,
        dish_name: rating.dish_name,
        restaurant_name: rating.restaurant_name,
        rating: rating.rating,
        rated_at: rating.rated_at,
        user: { id: author.id, name: author.name || 'User', username: usernameFor(author) }
      }
    })
  }

  function listRatings(viewerId, filters) {
    if (filters?.userId) {
      const viewed = profile(viewerId, filters.userId)
      if (viewed.status !== 200) return viewed
      if (!viewed.body.canView) return { status: 403, body: { error: 'This account is private', ratings: [] } }
    }
    return { status: 200, body: { ratings: ratingsVisibleTo(viewerId, filters) } }
  }

  function clearOwn(userId) {
    if (!userId) return { status: 401, body: { error: 'Sign in required' } }
    const g = graph()
    g.posts = g.posts.filter((row) => row.userId !== userId)
    g.ratings = g.ratings.filter((row) => row.userId !== userId)
    g.lists = g.lists.filter((row) => row.userId !== userId)
    g.activity = g.activity.filter((row) => row.userId !== userId)
    save(g)
    return { status: 200, body: { ok: true } }
  }

  function purge(userId) {
    if (!userId) return
    const g = graph()
    g.follows = g.follows.filter((row) => !involves(row, userId))
    g.requests = g.requests.filter((row) => !involves(row, userId))
    g.blocks = g.blocks.filter((row) => !involves(row, userId))
    g.reports = g.reports.filter((row) => !involves(row, userId))
    g.posts = g.posts.filter((row) => row.userId !== userId)
    g.ratings = g.ratings.filter((row) => row.userId !== userId)
    g.lists = g.lists.filter((row) => row.userId !== userId)
    g.activity = g.activity.filter((row) => row.userId !== userId)
    save(g)
  }

  return {
    search,
    profile,
    contentFor,
    follow,
    unfollow,
    removeFollower,
    incoming,
    respond,
    block,
    report,
    connections,
    feed,
    addPost,
    addRating,
    addList,
    listRatings,
    purge,
    clearOwn,
    canView
  }
}

let singleton = null

export function getSocialGraph() {
  if (!singleton) {
    singleton = createSocialGraph({
      readUsers: () => readJSON('users.json'),
      readGraph: () => readJSON('social.json'),
      writeGraph: (data) => writeJSON('social.json', data)
    })
  }
  return singleton
}
