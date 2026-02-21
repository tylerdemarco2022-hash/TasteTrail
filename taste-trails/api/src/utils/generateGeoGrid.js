
// Generates a grid of lat/lng points covering a circle of given radius around a center point.
const EARTH_RADIUS_M = 6371000;

function metersToLat(m) {
  return m / 111320;
}

function metersToLng(m, lat) {
  return m / (111320 * Math.cos(lat * Math.PI / 180));
}

/**
 * Generate grid points covering a circle
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} radiusMeters
 * @param {number} stepMeters
 * @returns {Array<{lat:number, lng:number}>}
 */
function generateGeoGrid(centerLat, centerLng, radiusMeters, stepMeters) {
  const points = [];
  const latStep = metersToLat(stepMeters);
  const lngStep = metersToLng(stepMeters, centerLat);
  const latRadius = metersToLat(radiusMeters);
  const lngRadius = metersToLng(radiusMeters, centerLat);

  for (let dLat = -latRadius; dLat <= latRadius; dLat += latStep) {
    for (let dLng = -lngRadius; dLng <= lngRadius; dLng += lngStep) {
      const lat = centerLat + dLat;
      const lng = centerLng + dLng;
      // Only include points within the circle
      const dist = Math.sqrt(
        Math.pow(dLat * 111320, 2) +
        Math.pow(dLng * 111320 * Math.cos(centerLat * Math.PI / 180), 2)
      );
      if (dist <= radiusMeters + stepMeters / 2) {
        points.push({ lat, lng });
      }
    }
  }
  return points;
}

export default generateGeoGrid;
