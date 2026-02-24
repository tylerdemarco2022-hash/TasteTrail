import { useEffect } from 'react'

const useSwipe = (onSwipeLeft, onSwipeRight, threshold = 50) => {
  useEffect(() => {
    let touchStartX = 0
    let touchStartY = 0
    let touchEndX = 0
    let touchEndY = 0

    const handleTouchStart = (e) => {
      touchStartX = e.changedTouches[0].screenX
      touchStartY = e.changedTouches[0].screenY
    }

    const handleTouchEnd = (e) => {
      touchEndX = e.changedTouches[0].screenX
      touchEndY = e.changedTouches[0].screenY
      handleSwipe()
    }

    const handleSwipe = () => {
      const diffX = touchStartX - touchEndX
      const diffY = touchStartY - touchEndY

      // Only trigger if horizontal movement is greater than vertical
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > threshold && onSwipeLeft) {
          onSwipeLeft()
        } else if (diffX < -threshold && onSwipeRight) {
          onSwipeRight()
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, false)
    window.addEventListener('touchend', handleTouchEnd, false)

    return () => {
      window.removeEventListener('touchstart', handleTouchStart, false)
      window.removeEventListener('touchend', handleTouchEnd, false)
    }
  }, [onSwipeLeft, onSwipeRight, threshold])
}

export default useSwipe
