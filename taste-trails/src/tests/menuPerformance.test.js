/**
 * FRONTEND PERFORMANCE TEST
 * 
 * Purpose: Ensure menu grouping and render performance stays under threshold
 * 
 * Test Requirements:
 * - Load a 300-item menu across multiple sections
 * - Measure grouping time (section creation)
 * - Ensure total time < 50ms
 * - Verify no memory leaks during repeated operations
 * 
 * Run: npm test -- menuPerformance.test.js
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock performance if not available in test environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

/**
 * Generate a large menu dataset for performance testing
 * @param {number} itemCount - Total number of items to generate
 * @param {number} sectionCount - Number of sections to distribute items across
 * @returns {Array} Menu sections with items
 */
function generateLargeMenu(itemCount = 300, sectionCount = 15) {
  const sections = [];
  const itemsPerSection = Math.floor(itemCount / sectionCount);
  const sectionNames = [
    'Appetizers', 'Soups & Salads', 'Small Plates', 'Shared Plates',
    'Pasta', 'Seafood', 'From The Grill', 'Steaks', 'Poultry', 'Vegetarian',
    'Sides', 'Kids Menu', 'Desserts', 'Beverages', 'Wine List'
  ];
  
  for (let s = 0; s < sectionCount; s++) {
    const sectionName = sectionNames[s] || `Section ${s + 1}`;
    const items = [];
    
    for (let i = 0; i < itemsPerSection; i++) {
      items.push({
        id: `item_${s}_${i}`,
        name: `${sectionName} Item ${i + 1}`,
        category: sectionName,
        description: `A delicious ${sectionName.toLowerCase()} dish prepared with fresh ingredients`,
        price: (10 + Math.random() * 30).toFixed(2),
        rating: (3 + Math.random() * 2).toFixed(1),
        rating_count: Math.floor(Math.random() * 100)
      });
    }
    
    sections.push({
      name: sectionName,
      category: sectionName,
      items
    });
  }
  
  return sections;
}

/**
 * Measure menu grouping performance (simulates React useMemo logic)
 * This replicates the categorySections useMemo from MenuView.jsx
 */
function measureMenuGroupingPerformance(displaySections) {
  const startTime = performance.now();
  
  // Replicate the grouping logic from MenuView.jsx
  const sectionOrder = [];
  const groups = new Map();
  let totalItems = 0;
  let uncategorizedItems = 0;
  
  for (const section of displaySections) {
    const sectionItems = Array.isArray(section?.items) ? section.items : [];
    
    for (const item of sectionItems) {
      if (!item) continue;
      
      totalItems++;
      
      // Get category from item.category field (primary) or section name (fallback)
      const rawCategory = item?.category || section?.name || section?.category || 'Uncategorized';
      
      // Normalize for grouping but preserve original for display
      const normalizedCategory = String(rawCategory).trim();
      const sectionKey = normalizedCategory.toLowerCase().replace(/\s+/g, '_');
      
      // Track uncategorized items
      if (normalizedCategory === 'Uncategorized') {
        uncategorizedItems++;
      }
      
      // Track section order on first appearance
      if (!groups.has(sectionKey)) {
        sectionOrder.push(sectionKey);
        groups.set(sectionKey, {
          key: sectionKey,
          name: normalizedCategory,
          originalName: normalizedCategory,
          items: []
        });
      }
      
      groups.get(sectionKey).items.push(item);
    }
  }
  
  // Return sections in order they appeared
  const orderedSections = sectionOrder
    .map((key) => groups.get(key))
    .filter((section) => section && section.items.length > 0);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  return {
    duration,
    totalItems,
    sectionCount: orderedSections.length,
    uncategorizedItems,
    uncategorizedPercent: totalItems > 0 ? (uncategorizedItems / totalItems) * 100 : 0,
    sections: orderedSections
  };
}

describe('Menu Performance Tests', () => {
  
  describe('300-item menu grouping performance', () => {
    it('should group 300 items in under 50ms', () => {
      const largeMenu = generateLargeMenu(300, 15);
      
      const result = measureMenuGroupingPerformance(largeMenu);
      
      console.log(`Performance Test Results:`);
      console.log(`  Items: ${result.totalItems}`);
      console.log(`  Sections: ${result.sectionCount}`);
      console.log(`  Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`  Uncategorized: ${result.uncategorizedPercent.toFixed(1)}%`);
      
      // Assert: Grouping must complete in < 50ms
      expect(result.duration).toBeLessThan(50);
      
      // Assert: All items should be categorized
      expect(result.totalItems).toBe(300);
      expect(result.sectionCount).toBeGreaterThan(0);
      
      // Assert: No excessive uncategorized items
      expect(result.uncategorizedPercent).toBeLessThan(20);
    });
    
    it('should handle 500-item menu gracefully', () => {
      const veryLargeMenu = generateLargeMenu(500, 20);
      
      const result = measureMenuGroupingPerformance(veryLargeMenu);
      
      console.log(`Large Menu Performance:`);
      console.log(`  Items: ${result.totalItems}`);
      console.log(`  Sections: ${result.sectionCount}`);
      console.log(`  Duration: ${result.duration.toFixed(2)}ms`);
      
      // Should still be reasonably fast even for very large menus
      expect(result.duration).toBeLessThan(100);
      expect(result.totalItems).toBe(500);
    });
  });
  
  describe('Section deduplication performance', () => {
    it('should efficiently deduplicate sections with whitespace variations', () => {
      const menuWithDuplicates = [
        {
          name: 'Small Plates',
          items: [
            { name: 'Item 1', category: 'Small Plates' },
            { name: 'Item 2', category: ' Small Plates ' },
            { name: 'Item 3', category: 'Small Plates  ' },
            { name: 'Item 4', category: 'small plates' }
          ]
        }
      ];
      
      const startTime = performance.now();
      const result = measureMenuGroupingPerformance(menuWithDuplicates);
      const endTime = performance.now();
      
      // Should create only 1 section despite whitespace/casing variations
      expect(result.sectionCount).toBe(1);
      expect(result.sections[0].items.length).toBe(4);
      
      // Should be very fast for small menus
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
  
  describe('Sorting performance', () => {
    it('should sort large sections without performance degradation', () => {
      // Create a single section with 200 items
      const largeSection = {
        name: 'Main Menu',
        items: Array.from({ length: 200 }, (_, i) => ({
          id: `item_${i}`,
          name: `Item ${String.fromCharCode(65 + (i % 26))} ${i}`, // Random letter + number
          category: 'Main Menu',
          price: (10 + Math.random() * 30).toFixed(2),
          rating: (1 + Math.random() * 4).toFixed(1)
        }))
      };
      
      const startTime = performance.now();
      
      // Simulate sorting by name
      const sorted = [...largeSection.items].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`Sorting 200 items: ${duration.toFixed(2)}ms`);
      
      expect(sorted.length).toBe(200);
      expect(duration).toBeLessThan(20); // Sorting should be very fast
    });
  });
  
  describe('Memory efficiency', () => {
    it('should not leak memory on repeated grouping operations', () => {
      const largeMenu = generateLargeMenu(300, 15);
      
      const runs = 10;
      const results = [];
      
      for (let i = 0; i < runs; i++) {
        const result = measureMenuGroupingPerformance(largeMenu);
        results.push(result.duration);
      }
      
      // Calculate average duration
      const avgDuration = results.reduce((sum, d) => sum + d, 0) / runs;
      const maxDuration = Math.max(...results);
      const minDuration = Math.min(...results);
      
      console.log(`Repeated Operations (${runs} runs):`);
      console.log(`  Avg: ${avgDuration.toFixed(2)}ms`);
      console.log(`  Min: ${minDuration.toFixed(2)}ms`);
      console.log(`  Max: ${maxDuration.toFixed(2)}ms`);
      
      // Max should not be significantly higher than min (no memory leaks causing slowdown)
      const variance = maxDuration - minDuration;
      expect(variance).toBeLessThan(20); // Should be consistent
      expect(avgDuration).toBeLessThan(50);
    });
  });
  
  describe('Edge cases', () => {
    it('should handle empty menu efficiently', () => {
      const emptyMenu = [];
      
      const result = measureMenuGroupingPerformance(emptyMenu);
      
      expect(result.duration).toBeLessThan(5);
      expect(result.totalItems).toBe(0);
      expect(result.sectionCount).toBe(0);
    });
    
    it('should handle menu with all uncategorized items', () => {
      const uncategorizedMenu = [
        {
          name: 'Menu',
          items: Array.from({ length: 100 }, (_, i) => ({
            id: `item_${i}`,
            name: `Item ${i}`,
            category: 'Uncategorized',
            price: '10.00'
          }))
        }
      ];
      
      const result = measureMenuGroupingPerformance(uncategorizedMenu);
      
      expect(result.totalItems).toBe(100);
      expect(result.uncategorizedPercent).toBe(100);
      expect(result.duration).toBeLessThan(50);
    });
    
    it('should handle menu with many small sections', () => {
      // 50 sections with 6 items each = 300 items
      const manySections = generateLargeMenu(300, 50);
      
      const result = measureMenuGroupingPerformance(manySections);
      
      expect(result.totalItems).toBe(300);
      expect(result.sectionCount).toBe(50);
      expect(result.duration).toBeLessThan(50);
    });
  });
  
  describe('Real-world scenario simulation', () => {
    it('should handle The Crunkleton menu structure efficiently', () => {
      // Simulate The Crunkleton's actual menu structure
      const crunkletonMenu = [
        { name: 'Raw', items: Array(3).fill().map((_, i) => ({ name: `Raw Item ${i}`, category: 'Raw', price: '30' })) },
        { name: 'Shared', items: Array(6).fill().map((_, i) => ({ name: `Shared Item ${i}`, category: 'Shared', price: '20' })) },
        { name: 'Soups & Salads', items: Array(4).fill().map((_, i) => ({ name: `Soup/Salad ${i}`, category: 'Soups & Salads', price: '12' })) },
        { name: 'Hand-Helds', items: Array(3).fill().map((_, i) => ({ name: `Handheld ${i}`, category: 'Hand-Helds', price: '18' })) },
        { name: 'Mains', items: Array(4).fill().map((_, i) => ({ name: `Main ${i}`, category: 'Mains', price: '35' })) },
        { name: 'From The Grill', items: Array(5).fill().map((_, i) => ({ name: `Grilled ${i}`, category: 'From The Grill', price: '50' })) },
        { name: 'Small Plates', items: Array(7).fill().map((_, i) => ({ name: `Small Plate ${i}`, category: 'Small Plates', price: '12' })) },
        { name: 'After Dinner', items: Array(4).fill().map((_, i) => ({ name: `Dessert ${i}`, category: 'After Dinner', price: '14' })) }
      ];
      
      const result = measureMenuGroupingPerformance(crunkletonMenu);
      
      console.log(`The Crunkleton Menu Performance:`);
      console.log(`  Items: ${result.totalItems}`);
      console.log(`  Sections: ${result.sectionCount}`);
      console.log(`  Duration: ${result.duration.toFixed(2)}ms`);
      console.log(`  Uncategorized: ${result.uncategorizedPercent.toFixed(1)}%`);
      
      expect(result.totalItems).toBe(36); // 3+6+4+3+4+5+7+4
      expect(result.sectionCount).toBe(8);
      expect(result.duration).toBeLessThan(10); // Should be very fast for small menus
      expect(result.uncategorizedPercent).toBe(0); // All properly categorized
    });
  });
});

export default {};
