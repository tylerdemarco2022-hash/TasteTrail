import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_PATH = path.join(__dirname, 'storage.json')

const defaultState = {
	users: [
		{ id: 'user1', username: 'you', displayName: 'You', avatar: 'https://i.pravatar.cc/64?img=1' },
		{ id: 'user2', username: 'maya', displayName: 'Maya', avatar: 'https://i.pravatar.cc/64?img=12' },
		{ id: 'user3', username: 'liam', displayName: 'Liam', avatar: 'https://i.pravatar.cc/64?img=5' },
		{ id: 'user4', username: 'ava', displayName: 'Ava', avatar: 'https://i.pravatar.cc/64?img=47' }
	],
	posts: [],
	restaurants: []
}

function ensureDB() {
	if (!fs.existsSync(DB_PATH)) {
		fs.writeFileSync(DB_PATH, JSON.stringify(defaultState, null, 2), 'utf8')
	}
}

function readDB() {
	ensureDB()
	const raw = fs.readFileSync(DB_PATH, 'utf8')
	return JSON.parse(raw)
}

function writeDB(db) {
	fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8')
}

export function getUsers() {
	const db = readDB()
	return db.users
}

export function getUserById(id) {
	const db = readDB()
	return db.users.find((u) => u.id === id) || null
}

export function createUser({ username, displayName, avatar }) {
	const db = readDB()
	const normalized = (username || '').trim().toLowerCase()
	if (!normalized) throw new Error('username required')
	if (db.users.some((u) => u.username === normalized)) {
		throw new Error('username taken')
	}
	const user = {
		id: `user_${Date.now()}`,
		username: normalized,
		displayName: displayName || username,
		avatar: avatar || `https://i.pravatar.cc/64?u=${normalized}`
	}
	db.users.push(user)
	writeDB(db)
	return user
}

export function listPosts() {
	const db = readDB()
	return db.posts
}

export function addPost({ userId, restaurant, dish, caption, image, rating }) {
	const db = readDB()
	if (!userId) throw new Error('userId required')
	if (!restaurant) throw new Error('restaurant required')
	const post = {
		id: `post_${Date.now()}`,
		userId,
		restaurant,
		dish: dish || null,
		caption: caption || '',
		image: image || null,
		rating: typeof rating === 'number' ? rating : null,
		comments: [],
		createdAt: new Date().toISOString()
	}
	db.posts.push(post)
	writeDB(db)
	return post
}

export function addComment(postId, { userId, text }) {
	const db = readDB()
	const post = db.posts.find((p) => p.id === postId)
	if (!post) throw new Error('post not found')
	const comment = {
		id: `c_${Date.now()}`,
		userId,
		text,
		createdAt: new Date().toISOString()
	}
	post.comments = post.comments || []
	post.comments.push(comment)
	writeDB(db)
	return comment
}
