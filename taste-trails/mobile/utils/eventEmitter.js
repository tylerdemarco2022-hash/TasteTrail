import { DeviceEventEmitter } from 'react-native'

/**
 * Drop-in replacement for window.dispatchEvent / window.addEventListener.
 * Usage:
 *   emit('ratingSaved', { dishId: 123 })
 *   const sub = on('ratingSaved', (data) => console.log(data))
 *   sub.remove()  // cleanup in useEffect return
 */
export function emit(event, data) {
  DeviceEventEmitter.emit(event, data)
}

export function on(event, callback) {
  return DeviceEventEmitter.addListener(event, callback)
}
