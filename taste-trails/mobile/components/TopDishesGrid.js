import React from 'react';
import { View, Text, FlatList } from 'react-native';

export default function TopDishesGrid({ dishes = [], onPress }) {
  return (
    <View style={{ marginBottom: 32 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginLeft: 16, marginBottom: 8 }}>Top Picks</Text>
      <FlatList
        data={dishes}
        keyExtractor={(item, idx) => String(item.id || idx)}
        numColumns={3}
        renderItem={({ item }) => (
          <View style={{ flex: 1, margin: 8, minWidth: 100, maxWidth: 140 }}>
            {/* Replace below with your dish card UI */}
            <Pressable onPress={() => onPress && onPress(item)} style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>{item.name}</Text>
              <Text style={{ color: '#f59e42', fontWeight: 'bold', fontSize: 14 }}>★ {item.avgRating?.toFixed(1) || item.rating?.toFixed(1) || 'N/A'}</Text>
              <Text style={{ color: '#888', fontSize: 12 }}>{item.restaurantName}</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#888', marginTop: 16 }}>No top dishes found.</Text>}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      />
    </View>
  );
}
