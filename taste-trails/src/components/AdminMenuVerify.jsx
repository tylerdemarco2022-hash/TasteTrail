import React, { useState } from 'react';

import { supabase } from '../supabaseClient';

export default function AdminMenuVerify({ restaurant, menu }) {
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: supabaseError } = await supabase.from('verified_menus').insert([
        {
          restaurant_id: restaurant.id,
          menu,
          verified: true,
          verified_at: new Date().toISOString(),
        }
      ]);
      if (supabaseError) throw supabaseError;
      setVerified(true);
    } catch (err) {
      setError('Failed to store menu in Supabase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, margin: 16 }}>
      <h2>Admin Menu Verification</h2>
      <div><strong>Restaurant:</strong> {restaurant.name}</div>
      <div><strong>Menu Items:</strong> {menu.length}</div>
      <button disabled={loading || verified} onClick={handleVerify} style={{ marginTop: 12 }}>
        {verified ? 'Verified & Stored' : loading ? 'Verifying...' : 'Verify & Store in Supabase'}
      </button>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
