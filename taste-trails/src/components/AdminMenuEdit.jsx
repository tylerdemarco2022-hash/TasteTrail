  const [menuVerified, setMenuVerified] = useState(false);
  const handleVerifyMenu = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: supabaseError } = await supabase.from('verified_menus').update({ menu: items, verified: true, verified_at: new Date().toISOString() }).eq('restaurant_id', restaurant.id);
      if (supabaseError) throw supabaseError;
      setMenuVerified(true);
    } catch (err) {
      setError('Failed to verify menu in Supabase');
    } finally {
      setLoading(false);
    }
  };
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminMenuEdit({ restaurant, menu, onMenuChange }) {
  const [items, setItems] = useState(menu);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleItemChange = (idx, field, value) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setItems(updated);
    if (onMenuChange) onMenuChange(updated);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: supabaseError } = await supabase.from('verified_menus').update({ menu: items }).eq('restaurant_id', restaurant.id);
      if (supabaseError) throw supabaseError;
    } catch (err) {
      setError('Failed to update menu in Supabase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, margin: 16 }}>
      <h2>Edit Menu Items (Admin Only)</h2>
      <div><strong>Restaurant:</strong> {restaurant.name}</div>
      <div>
        {items.map((item, idx) => (
          <div key={idx} style={{ marginBottom: 12, padding: 8, border: '1px solid #eee', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={item.name}
              onChange={e => handleItemChange(idx, 'name', e.target.value)}
              placeholder="Item Name"
              style={{ marginRight: 8 }}
            />
            <input
              type="text"
              value={item.description}
              onChange={e => handleItemChange(idx, 'description', e.target.value)}
              placeholder="Description"
              style={{ marginRight: 8 }}
            />
            <input
              type="text"
              value={item.price}
              onChange={e => handleItemChange(idx, 'price', e.target.value)}
              placeholder="Price"
              style={{ marginRight: 8 }}
            />
            <input
              type="text"
              value={item.category}
              onChange={e => handleItemChange(idx, 'category', e.target.value)}
              placeholder="Category"
              style={{ marginRight: 8 }}
            />
            <button
              style={{
                padding: '8px 16px',
                fontSize: '1rem',
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                marginLeft: 8,
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
              }}
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const { error: supabaseError } = await supabase.from('verified_menus').update({ menu: items.map((it, i) => i === idx ? { ...it, approved: true } : it) }).eq('restaurant_id', restaurant.id);
                  if (supabaseError) throw supabaseError;
                  // Optionally mark item as approved in local state
                  setItems(items.map((it, i) => i === idx ? { ...it, approved: true } : it));
                } catch (err) {
                  setError('Failed to approve menu item');
                } finally {
                  setLoading(false);
                }
              }}
            >Approve</button>
            {Boolean(item.approved) && <span style={{ color: '#4caf50', marginLeft: 8, fontWeight: 600 }}>Approved</span>}
          </div>
        ))}
      </div>
      <button disabled={loading} onClick={handleSave} style={{ marginTop: 12 }}>
        {loading ? 'Saving...' : 'Save Changes to Supabase'}
      </button>
      <button
        disabled={loading || menuVerified}
        onClick={handleVerifyMenu}
        style={{
          marginTop: 20,
          padding: '16px 32px',
          fontSize: '1.2rem',
          background: menuVerified ? '#4caf50' : '#1976d2',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          cursor: loading || menuVerified ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {menuVerified ? 'Menu Verified' : loading ? 'Verifying...' : 'Approve Full Menu'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
