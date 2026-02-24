import React, { useEffect, useState } from "react";
import MenuCard from "./components/MenuCard";
import { API_BASE_URL } from "./config/api";

const Home = () => {
  const [menuData, setMenuData] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/restaurants`)
      .then((res) => res.json())
      .then((data) => {
        console.log("Loaded restaurants from backend:", data);
        setRestaurants(data);
      })
      .catch((err) => {
        console.error("Failed to load restaurants:", err);
      });
  }, []);

  const handleMenuClick = async (restaurantId) => {
    console.log("Menu button clicked", restaurantId);
    setLoading(true);
    setMenuData(null);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/restaurants/${restaurantId}/full-menu`);
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
      {restaurants.map((r) => (
        <MenuCard
          key={r.id}
          restaurantName={r.name}
          restaurantId={r.id}
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
