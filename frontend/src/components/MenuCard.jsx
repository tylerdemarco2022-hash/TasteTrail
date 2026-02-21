import React, { useState } from "react";

const MenuCard = ({ restaurantName, restaurantId, onMenuClick }) => {
  return (
    <div style={{ border: "1px solid #ccc", padding: 16, margin: 8 }}>
      <h3>{restaurantName}</h3>
      <button onClick={() => onMenuClick(restaurantId)}>
        View Menu
      </button>
    </div>
  );
};

export default MenuCard;
