import React, { createContext, useContext, useState, useCallback } from 'react';

export type MediaStatus = 'pending' | 'fire' | 'safe';

export interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  file?: Blob;
  createdAt: string;
  status: MediaStatus;
  confidence?: number;
}

interface MediaContextValue {
  items: MediaItem[];
  addMedia: (type: MediaItem['type'], url: string, file?: Blob, id?: string) => string;
  updateMediaStatus: (id: string, status: MediaStatus, confidence?: number) => void;
  removeMedia: (id: string) => void;
}

const MediaContext = createContext<MediaContextValue | undefined>(undefined);

// Hash basé sur le contenu réel du fichier : deux imports du même fichier
// (par clic ou par glisser-déposer) produisent toujours le même id, même
// si le nom ou les métadonnées du File diffèrent selon la méthode d'import.
export async function hashFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const MediaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<MediaItem[]>([]);

  const addMedia = useCallback((type: MediaItem['type'], url: string, file?: Blob, presetId?: string) => {
    const id = presetId ?? (file instanceof File ? `${file.name}-${file.size}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setItems((prev) => {
      const existing = prev.find((m) => m.id === id);
      const newItem: MediaItem = existing
        ? { ...existing, type, url, file, createdAt: new Date().toISOString() }
        : { id, type, url, file, createdAt: new Date().toISOString(), status: 'pending' };
      return [newItem, ...prev.filter((m) => m.id !== id)];
    });
    return id;
  }, []);

  const updateMediaStatus = useCallback((id: string, status: MediaStatus, confidence?: number) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status, confidence } : m)));
  }, []);

  const removeMedia = useCallback((id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return <MediaContext.Provider value={{ items, addMedia, updateMediaStatus, removeMedia }}>{children}</MediaContext.Provider>;
};

export const useMedia = (): MediaContextValue => {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error('useMedia doit être utilisé dans un MediaProvider');
  return ctx;
};
