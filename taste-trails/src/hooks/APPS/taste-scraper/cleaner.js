function cleanMenuItems(items) {
  return items.filter(item => {
    const lower = item.toLowerCase();

    return (
      !lower.includes("contact") &&
      !lower.includes("hours") &&
      !lower.includes("location") &&
      !lower.includes("privacy") &&
      !lower.includes("terms")
    );
  });
}

module.exports = cleanMenuItems;
