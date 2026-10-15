'use client';
import { useEffect, useState } from 'react';
export function useViewport() {
  const [size, setSize] = useState({ width: 1280, height: 850 });
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return size;
}
