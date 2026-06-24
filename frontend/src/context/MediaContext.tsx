import React, { createContext, useContext, useState, useCallback } from 'react';

export interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  createdAt: string;
}

interface MediaContextValue {
  items: MediaItem[];
  addMedia: (type: MediaItem['type'], url: string) => void;
}

const MediaContext = createContext<MediaContextValue | undefined>(undefined);

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<MediaItem[]>([]);

  const addMedia = useCallback((type: MediaItem['type'], url: string) => {
    setItems((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, url, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  return <MediaContext.Provider value={{ items, addMedia }}>{children}</MediaContext.Provider>;
};

export const useMedia = (): MediaContextValue => {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia doit être utilisé dans un MediaProvider');
  return ctx;
};
