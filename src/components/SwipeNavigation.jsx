"use client";

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const SwipeNavigation = () => {
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);

  // Define page order
  const pages = ['/', '/calendar', '/connect', '/notes', '/settings'];
  const currentPageIndex = pages.indexOf(pathname);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].clientX;
    touchEndY.current = e.changedTouches[0].clientY;
    handleSwipe();
  };

  const handleSwipe = () => {
    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = touchEndY.current - touchStartY.current;
    
    console.log('Swipe detected:', { deltaX, deltaY, currentPageIndex, pathname });
    
    // Only trigger if horizontal swipe is greater than vertical (to avoid conflicts with scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right - go to previous page
        if (currentPageIndex > 0) {
          console.log('Swipe right: going to', pages[currentPageIndex - 1]);
          router.push(pages[currentPageIndex - 1]);
        }
      } else {
        // Swipe left - go to next page
        if (currentPageIndex < pages.length - 1) {
          console.log('Swipe left: going to', pages[currentPageIndex + 1]);
          router.push(pages[currentPageIndex + 1]);
        }
      }
    }
  };

  useEffect(() => {
    // Add touch event listeners to the document
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentPageIndex]);

  return null; // This component doesn't render anything
};

export default SwipeNavigation;
