import './global.css'

import { useState, useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { AuthProvider, useAuth } from './mobile/context/AuthContext'
import MainTabs from './mobile/navigation/MainTabs'
import LoginScreen from './mobile/screens/Login'
import SignupScreen from './mobile/screens/Signup'
import OnboardingScreen from './mobile/screens/Onboarding'
import LoadingScreen from './mobile/screens/Loading'

const AuthStack = createNativeStackNavigator()

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  )
}

const RootStack = createNativeStackNavigator()

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth()
  const [onboardingDone, setOnboardingDone] = useState(null) // null = loading

  useEffect(() => {
    if (!isAuthenticated) {
      setOnboardingDone(null)
      return
    }
    AsyncStorage.getItem('onboarding_completed').then(val => {
      setOnboardingDone(val === 'true')
    })
  }, [isAuthenticated])

  if (loading || (isAuthenticated && onboardingDone === null)) {
    return <LoadingScreen />
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      ) : !onboardingDone ? (
        <RootStack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen
              {...props}
              onComplete={() => setOnboardingDone(true)}
            />
          )}
        </RootStack.Screen>
      ) : (
        <RootStack.Screen name="Main" component={MainTabs} />
      )}
    </RootStack.Navigator>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
