import test from 'node:test'
import assert from 'node:assert/strict'
import { createSocialGraph } from './socialGraph.js'

function harness() {
  const users = []
  let stored = null
  let n = 0
  const social = createSocialGraph({
    readUsers: () => users,
    readGraph: () => stored,
    writeGraph: (next) => { stored = next },
    now: () => '2026-10-12T00:00:00.000Z',
    id: () => `id-${++n}`
  })
  function addUser(partial) {
    const user = { role: 'user', is_private: false, ...partial }
    users.push(user)
    return user
  }
  return { social, addUser, users }
}

test('a non-follower cannot read a private account, and an approved follower can', () => {
  const { social, addUser } = harness()
  const casey = addUser({ id: 'casey', name: 'Casey Public', username: 'casey' })
  const blair = addUser({ id: 'blair', name: 'Blair Private', username: 'blair', is_private: true })
  social.addPost(blair.id, { dish: 'Tonkotsu ramen', restaurant: 'Supper Land', caption: 'Rich pork broth' })
  social.addRating(blair.id, { dish_name: 'Tonkotsu ramen', restaurant_name: 'Supper Land', rating: 9, dish_id: 'ramen' })
  social.addList(blair.id, { name: 'Charlotte noodles', items: ['Tonkotsu ramen'] })

  const hidden = social.profile(casey.id, blair.id)
  assert.equal(hidden.body.canView, false)
  assert.equal(hidden.body.message, 'This account is private')
  assert.deepEqual(hidden.body.posts, [])
  assert.deepEqual(hidden.body.ratings, [])
  assert.deepEqual(hidden.body.lists, [])
  assert.deepEqual(hidden.body.activity, [])
  assert.equal(hidden.body.counts, null)
  assert.equal(JSON.stringify(hidden.body).includes('Rich pork broth'), false)
  assert.equal(social.contentFor(casey.id, blair.id, 'posts').status, 403)
  assert.equal(social.contentFor(casey.id, blair.id, 'ratings').status, 403)
  assert.equal(social.listRatings(casey.id, { userId: blair.id }).status, 403)
  assert.equal(social.listRatings(casey.id, { dishId: 'ramen' }).body.ratings.length, 0)
  assert.equal(social.connections(casey.id, blair.id, 'followers').body.private, true)
  assert.deepEqual(social.connections(casey.id, blair.id, 'following').body.users, [])
  assert.equal(social.feed(casey.id).body.posts.length, 0)

  const requested = social.follow(casey.id, blair.id)
  assert.equal(requested.body.status, 'pending')
  assert.equal(social.profile(casey.id, blair.id).body.canView, false)

  const declined = social.respond(blair.id, requested.body.requestId, 'decline')
  assert.equal(declined.body.status, 'declined')
  assert.equal(social.profile(casey.id, blair.id).body.canView, false)

  const again = social.follow(casey.id, blair.id)
  assert.equal(social.respond(blair.id, again.body.requestId, 'accept').body.status, 'accepted')
  const visible = social.profile(casey.id, blair.id)
  assert.equal(visible.body.canView, true)
  assert.equal(visible.body.posts[0].caption, 'Rich pork broth')
  assert.equal(visible.body.ratings[0].dish_name, 'Tonkotsu ramen')
  assert.equal(visible.body.lists[0].name, 'Charlotte noodles')
  assert.equal(visible.body.activity.length, 3)
  assert.equal(visible.body.counts.followers, 1)
  assert.equal(social.contentFor(casey.id, blair.id, 'posts').status, 200)
  assert.equal(social.listRatings(casey.id, { dishId: 'ramen' }).body.ratings.length, 1)
  assert.equal(social.feed(casey.id).body.posts[0].caption, 'Rich pork broth')
  assert.equal(social.connections(casey.id, blair.id, 'followers').body.users[0].id, casey.id)
})

test('a blocked user cannot find the account or send a follow request', () => {
  const { social, addUser } = harness()
  const casey = addUser({ id: 'casey', name: 'Casey Public', username: 'casey' })
  const blair = addUser({ id: 'blair', name: 'Blair Private', username: 'blair', is_private: true })
  social.addPost(blair.id, { caption: 'Secret tasting note' })
  social.block(blair.id, casey.id)

  const found = social.search(casey.id, 'blair')
  assert.equal(found.length, 0)
  assert.equal(social.search(blair.id, 'casey').length, 0)
  const follow = social.follow(casey.id, blair.id)
  assert.equal(follow.status, 403)
  assert.equal(follow.body.error, 'You cannot follow this account.')
  const profile = social.profile(casey.id, blair.id)
  assert.equal(profile.body.canView, false)
  assert.equal(profile.body.blocked, true)
  assert.deepEqual(profile.body.posts, [])
  assert.equal(JSON.stringify(profile.body).includes('Secret tasting note'), false)
})

test('public follow is instant and search cards omit private content', () => {
  const { social, addUser } = harness()
  const casey = addUser({ id: 'casey', name: 'Casey Public', username: 'casey', email: 'casey@example.com' })
  addUser({ id: 'blair', name: 'Blair Private', username: 'blair', is_private: true, email: 'blair@example.com' })
  social.addPost('blair', { caption: 'Do not leak this caption' })

  const follow = social.follow(casey.id, 'casey')
  assert.equal(follow.status, 400)

  const drew = addUser({ id: 'drew', name: 'Drew Open', username: 'drew', email: 'drew@example.com' })
  social.addPost(drew.id, { caption: 'Public bowl' })
  assert.equal(social.follow(casey.id, drew.id).body.status, 'following')
  assert.equal(social.profile(casey.id, drew.id).body.posts[0].caption, 'Public bowl')

  const cards = social.search(casey.id, 'blair')
  assert.equal(cards.length, 1)
  assert.equal(cards[0].username, 'blair')
  assert.equal(cards[0].is_private, true)
  assert.equal('email' in cards[0], false)
  assert.equal(JSON.stringify(cards).includes('Do not leak'), false)
  assert.equal(JSON.stringify(cards).includes('blair@example.com'), false)
})
