import React from 'react';
import { View, Text, FlatList } from 'react-native';
import RestaurantCard from '../components/RestaurantCard';

export default function CategoryView({ route, navigation }) {
  const { category, restaurants = [] } = route.params || {};

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb', paddingTop: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 12, marginLeft: 16 }}>
        {category} Restaurants
      </Text>
      <FlatList
        data={restaurants}
        keyExtractor={(item, idx) => String(item.id || item.place_id || idx)}
        renderItem={({ item }) => (
          <RestaurantCard restaurant={item} onPress={() => navigation.navigate('MenuView', { restaurant: item })} />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>🍽️</Text>
            <Text style={{ color: '#888', textAlign: 'center' }}>No restaurants found in this category.</Text>
          </View>
        }
      />
    </View>
  );
}
