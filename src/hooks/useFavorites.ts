import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { FavoriteItem, FavoriteTargetType } from '../types/platform';

const LOCAL_FAVORITES_KEY = 'masar_favorites_v1';

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function makeFavoriteId(targetType: FavoriteTargetType, targetId: string): string {
  const safeTarget = targetId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 72) || 'item';
  return `fav_${targetType}__${safeTarget}`;
}

function loadLocalFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_FAVORITES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FavoriteItem[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function saveLocalFavorites(items: FavoriteItem[]): void {
  try {
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function useFavorites(user: User | null, authReady: boolean) {
  const [localFavorites, setLocalFavorites] = useState<FavoriteItem[]>(() => loadLocalFavorites());
  const [cloudFavorites, setCloudFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    saveLocalFavorites(localFavorites);
  }, [localFavorites]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudFavorites([]);
      return;
    }

    const favPath = `users/${user.uid}/favorites`;
    const unsub = onSnapshot(
      query(collection(db, favPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: FavoriteItem[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              targetType: data.targetType as FavoriteTargetType,
              targetId: String(data.targetId || ''),
              parentId: String(data.parentId || ''),
              title: String(data.title || ''),
              subtitle: String(data.subtitle || ''),
              url: String(data.url || ''),
              thumbnailUrl: String(data.thumbnailUrl || ''),
              createdAt: toIsoString(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCloudFavorites(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, favPath)
    );

    return unsub;
  }, [authReady, user]);

  const favorites = user ? cloudFavorites : localFavorites;

  const isFavorited = useCallback(
    (targetType: FavoriteTargetType, targetId: string) =>
      favorites.some((f) => f.targetType === targetType && f.targetId === targetId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (input: {
      targetType: FavoriteTargetType;
      targetId: string;
      parentId?: string;
      title: string;
      subtitle?: string;
      url?: string;
      thumbnailUrl?: string;
    }): Promise<boolean> => {
      const favId = makeFavoriteId(input.targetType, input.targetId);
      const exists = favorites.some((f) => f.id === favId);

      if (exists) {
        if (!user) {
          setLocalFavorites((prev) => prev.filter((f) => f.id !== favId));
          return false;
        }
        const path = `users/${user.uid}/favorites/${favId}`;
        try {
          await deleteDoc(doc(db, path));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
        return false;
      }

      const newFav: FavoriteItem = {
        id: favId,
        ownerId: user?.uid || 'local',
        targetType: input.targetType,
        targetId: input.targetId.slice(0, 128),
        parentId: (input.parentId || '').slice(0, 128),
        title: input.title.trim().slice(0, 200) || 'عنصر محفوظ',
        subtitle: (input.subtitle || '').trim().slice(0, 200),
        url: (input.url || '').slice(0, 2048),
        thumbnailUrl: (input.thumbnailUrl || '').slice(0, 350000),
        createdAt: new Date().toISOString(),
      };

      if (!user) {
        setLocalFavorites((prev) => [newFav, ...prev.filter((f) => f.id !== favId)]);
        return true;
      }

      const path = `users/${user.uid}/favorites/${favId}`;
      try {
        await setDoc(doc(db, path), {
          ...newFav,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
      return true;
    },
    [favorites, user]
  );

  const removeFavorite = useCallback(
    async (favId: string) => {
      if (!user) {
        setLocalFavorites((prev) => prev.filter((f) => f.id !== favId));
        return;
      }
      const path = `users/${user.uid}/favorites/${favId}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  return {
    favorites,
    isFavorited,
    toggleFavorite,
    removeFavorite,
  };
}
