import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Home, MessageCircle, Users, User } from 'lucide-react-native'

import FeedScreen from '../screens/Feed'
import CommunityFeedScreen from '../screens/CommunityFeed'
import GroupsScreen from '../screens/Groups'
import ProfileScreen from '../screens/Profile'
import MenuViewScreen from '../screens/MenuView'
import UserProfileScreen from '../screens/UserProfile'
import SearchScreen from '../screens/Search'
import TopDishesScreen from '../screens/TopDishes'
import NotificationsScreen from '../screens/Notifications'
import SettingsScreen from '../screens/Settings'
import CategoryView from '../screens/CategoryView'

const Tab = createBottomTabNavigator()
const FeedStack = createNativeStackNavigator()
const CommunityStack = createNativeStackNavigator()
const GroupsStack = createNativeStackNavigator()
const ProfileStack = createNativeStackNavigator()

function FeedNavigator() {
  return (
    <FeedStack.Navigator screenOptions={{ headerShown: false }}>
      <FeedStack.Screen name="FeedHome" component={FeedScreen} />
      <FeedStack.Screen name="MenuView" component={MenuViewScreen} />
      <FeedStack.Screen name="UserProfile" component={UserProfileScreen} />
      <FeedStack.Screen name="TopDishes" component={TopDishesScreen} />
      <FeedStack.Screen name="CategoryView" component={CategoryView} />
    </FeedStack.Navigator>
  )
}

function CommunityNavigator() {
  return (
    <CommunityStack.Navigator screenOptions={{ headerShown: false }}>
      <CommunityStack.Screen name="CommunityHome" component={CommunityFeedScreen} />
      <CommunityStack.Screen name="MenuView" component={MenuViewScreen} />
      <CommunityStack.Screen name="UserProfile" component={UserProfileScreen} />
    </CommunityStack.Navigator>
  )
}

function GroupsNavigator() {
  return (
    <GroupsStack.Navigator screenOptions={{ headerShown: false }}>
      <GroupsStack.Screen name="GroupsHome" component={GroupsScreen} />
    </GroupsStack.Navigator>
  )
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileHome" component={ProfileScreen} />
      <ProfileStack.Screen name="UserProfile" component={UserProfileScreen} />
      <ProfileStack.Screen name="Search" component={SearchScreen} />
      <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsScreen} />
    </ProfileStack.Navigator>
  )
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f3f4f6',
          paddingBottom: 4,
          height: 60
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600'
        },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Restaurants: Home,
            Community: MessageCircle,
            Groups: Users,
            Profile: User
          }
          const Icon = icons[route.name]
          return Icon ? <Icon color={color} size={size} /> : null
        }
      })}
    >
      <Tab.Screen name="Restaurants" component={FeedNavigator} />
      <Tab.Screen name="Community" component={CommunityNavigator} />
      <Tab.Screen name="Groups" component={GroupsNavigator} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  )
}
