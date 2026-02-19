import { menuData } from './menuData'

// Load following list from localStorage or use defaults
const loadFollowing = () => {
  try {
    const saved = localStorage.getItem('taste-trails-following')
    return saved ? JSON.parse(saved) : ['user2', 'user3', 'user4'] // Default: Following Maya, Liam, and Ava
  } catch (e) {
    return ['user2', 'user3', 'user4']
  }
}

// Current user
export const currentUser = {
  id: 'user1',
  name: 'You',
  avatar: 'https://i.pravatar.cc/64?img=1',
  following: loadFollowing()
}

// All users
export const users = [
  { id: 'user1', name: 'You', avatar: 'https://i.pravatar.cc/64?img=1' },
  { id: 'user2', name: 'Maya', avatar: 'https://i.pravatar.cc/64?img=12' },
  { id: 'user3', name: 'Liam', avatar: 'https://i.pravatar.cc/64?img=5' },
  { id: 'user4', name: 'Ava', avatar: 'https://i.pravatar.cc/64?img=47' },
  { id: 'user5', name: 'Sophie', avatar: 'https://i.pravatar.cc/64?img=32' },
  { id: 'user6', name: 'James', avatar: 'https://i.pravatar.cc/64?img=13' },
  { id: 'user7', name: 'Nina Patel', avatar: 'https://i.pravatar.cc/64?img=22' },
  { id: 'user8', name: 'Carlos Rivera', avatar: 'https://i.pravatar.cc/64?img=18' },
  { id: 'user9', name: 'Jasmine Brooks', avatar: 'https://i.pravatar.cc/64?img=29' },
  { id: 'user10', name: 'Ethan Cole', avatar: 'https://i.pravatar.cc/64?img=41' },
  { id: 'user11', name: 'Priya Shah', avatar: 'https://i.pravatar.cc/64?img=48' },
  { id: 'user12', name: 'Noah Kim', avatar: 'https://i.pravatar.cc/64?img=53' },
  { id: 'user13', name: 'Bella Nguyen', avatar: 'https://i.pravatar.cc/64?img=56' },
  { id: 'user14', name: 'Marcus Lee', avatar: 'https://i.pravatar.cc/64?img=59' },
  { id: 'user15', name: 'Zoe Carter', avatar: 'https://i.pravatar.cc/64?img=60' }
]

export const posts = [
  {
    id: 1,
    userId: 'user2',
    user: { name: 'Maya', avatar: 'https://i.pravatar.cc/64?img=12' },
    restaurant: 'Bao & Co',
    dish: 'Pork Belly Bao',
    image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=0b3b2f0975dce9f9f155b9f7a0c1a0a5',
    caption: 'Best bao in town ✨',
    rating: 0,
    comments: [],
    commentCount: 12,
    menu: [
      { name: 'Pork Belly Bao', rating: 0, price: 3 },
      { name: 'Chicken Bao', rating: 0, price: 3 },
      { name: 'Shrimp Bao', rating: 0, price: 3 },
      { name: 'Veggie Bao', rating: 0, price: 2 },
      { name: 'Edamame', rating: 0, price: 2 },
      { name: 'Dumpling (6pcs)', rating: 0, price: 3 },
      { name: 'Spring Rolls (3pcs)', rating: 0, price: 3 },
      { name: 'Bubble Tea', rating: 0, price: 2 },
      { name: 'Mango Lassi', rating: 0, price: 2 },
      { name: 'Lychee Lemonade', rating: 0, price: 2 },
      { name: 'Sesame Noodles', rating: 0, price: 3 },
      { name: 'Crispy Tofu', rating: 0, price: 2 }
    ]
  },
  {
    id: 2,
    userId: 'user3',
    user: { name: 'Liam', avatar: 'https://i.pravatar.cc/64?img=5' },
    restaurant: 'Saffron Spoon',
    dish: 'Lamb Biryani',
    image: 'https://images.unsplash.com/photo-1604908177059-38ad5eec7a1f?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=2f8b0fa8a7c6b9f1f2d2a5c3c8e2f7e1',
    caption: 'Comfort in a bowl.',
    rating: 0,
    comments: [],
    commentCount: 34,
    menu: [
      { name: 'Lamb Biryani', rating: 0, price: 4 },
      { name: 'Chicken Biryani', rating: 0, price: 4 },
      { name: 'Vegetable Biryani', rating: 0, price: 3 },
      { name: 'Lamb Curry', rating: 0, price: 4 },
      { name: 'Chicken Tikka Masala', rating: 0, price: 4 },
      { name: 'Chicken Korma', rating: 0, price: 3 },
      { name: 'Paneer Tikka Masala', rating: 0, price: 3 },
      { name: 'Chana Masala', rating: 0, price: 2 },
      { name: 'Naan Bread', rating: 0, price: 2 },
      { name: 'Garlic Naan', rating: 0, price: 2 },
      { name: 'Samosa (3pcs)', rating: 0, price: 2 },
      { name: 'Mango Lassi', rating: 0, price: 2 }
    ]
  },
  {
    id: 3,
    userId: 'user4',
    user: { name: 'Ava', avatar: 'https://i.pravatar.cc/64?img=47' },
    restaurant: 'Green Fork',
    dish: 'Avocado Toast',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=93f8f7e1b0d7b5a2c0f4f1a6d2d7b8c4',
    caption: 'Brunch goals 🥑',
    rating: 0,
    comments: [],
    commentCount: 8,
    menu: [
      { name: 'Avocado Toast', rating: 0, price: 3 },
      { name: 'Acai Bowl', rating: 0, price: 4 },
      { name: 'Smoked Salmon Toast', rating: 0, price: 4 },
      { name: 'Shakshuka', rating: 0, price: 3 },
      { name: 'Quinoa Bowl', rating: 0, price: 4 },
      { name: 'Organic Salad', rating: 0, price: 3 },
      { name: 'Green Smoothie', rating: 0, price: 3 },
      { name: 'Berry Smoothie Bowl', rating: 0, price: 4 },
      { name: 'Cappuccino', rating: 0, price: 2 },
      { name: 'Cold Brew Coffee', rating: 0, price: 2 },
      { name: 'Matcha Latte', rating: 0, price: 3 },
      { name: 'Carrot Cake', rating: 0, price: 2 }
    ]
  }
]

export const restaurants = [];
