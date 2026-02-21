import React, { useState } from "react";
import MenuCard from "../components/MenuCard";

const mockRestaurants = [
  { restaurantId: "c1a2b3d4-e5f6-7890-abcd-131mainuuid", name: "131 Main" },
  { restaurantId: "d2b3c4a5-f6e7-8901-bcda-angelinesuuid", name: "Angeline's" },
];

const Home = () => {
  const [menuData, setMenuData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleMenuClick = async (restaurantId) => {
    console.log("Menu button clicked", restaurantId);
    setLoading(true);
    setMenuData(null);
    setError(null);
    try {
      const resp = await fetch(`/api/restaurants/${restaurantId}/full-menu`);
      console.log("Response received:", resp);
      if (!resp.ok) throw new Error("Menu fetch failed");
      const data = await resp.json();
      console.log("Full menu response:", data);
      setMenuData(data);
    } catch (err) {
      console.error("Menu fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <h2>Restaurants</h2>
      {mockRestaurants.map((r) => (
        <MenuCard
          key={r.restaurantId}
          restaurantName={r.name}
          restaurantId={r.restaurantId}
          onMenuClick={handleMenuClick}
        />
      ))}
      {loading && <div>Loading menu...</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {menuData && (
        <div style={{ marginTop: 24, border: "1px solid #333", padding: 16 }}>
          <h3>{menuData.name}</h3>
          {menuData?.sections?.length > 0 ? (
            menuData.sections.map(section => (
              <div key={section.name} style={{ marginBottom: 16 }}>
                <h4>{section.name}</h4>
                {section.items.map(item => (
                  <div key={item.name}>
                    <p><strong>{item.name}</strong></p>
                    <p>{item.description}</p>
                    <p>{item.price}</p>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <p>No menu available</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
