import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  FriendContact,
  ShareableItemType,
  SharedItemRecord,
  SharePermissionRole,
  UserPublicProfile,
} from '../types/workspace';
import { createSafeId } from '../utils/pathLogic';
import {
  buildSanitizedShareBundle,
  buildShareInviteUrl,
  normalizeUsername,
  type SharedPayloadBundle,
  validateUsername,
} from '../utils/sharingLogic';

const LOCAL_SHARES_KEY = 'masar_social_shares_v1';
const LOCAL_PROFILE_KEY = 'masar_public_profile_v1';
const LOCAL_FRIENDS_KEY = 'masar_friends_v1';
const LOCAL_REDEEMED_KEY = 'masar_redeemed_shares_v1';

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function loadLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore corrupt cache
  }
  return fallback;
}

function saveLocalJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function mapDocToShare(d: { id: string; data: () => Record<string, unknown> }): SharedItemRecord {
  const data = d.data();
  return {
    id: String(data.id || d.id),
    ownerId: String(data.ownerId || ''),
    ownerUsername: String(data.ownerUsername || ''),
    ownerDisplayName: String(data.ownerDisplayName || 'مستخدم مسار'),
    recipientUid: String(data.recipientUid || ''),
    recipientUsername: String(data.recipientUsername || ''),
    itemType: (data.itemType as ShareableItemType) || 'learning_path',
    itemId: String(data.itemId || ''),
    itemTitle: String(data.itemTitle || 'محتوى مشترك'),
    itemSummary: String(data.itemSummary || ''),
    itemThumbnail: String(data.itemThumbnail || ''),
    role: (data.role as SharePermissionRole) || 'viewer',
    shareCode: String(data.shareCode || ''),
    revoked: Boolean(data.revoked),
    allowCopy: data.allowCopy !== false,
    includePersonalNotes: Boolean(data.includePersonalNotes),
    payloadJson: String(data.payloadJson || '{}'),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export interface CreateShareRequest {
  itemType: ShareableItemType;
  itemId: string;
  role: SharePermissionRole;
  allowCopy: boolean;
  includePersonalNotes: boolean;
  recipient?: { uid: string; username: string };
  sourceData: Omit<Parameters<typeof buildSanitizedShareBundle>[0], 'itemType' | 'includePersonalNotes'>;
}

export function useSocialSharing(user: User | null, authReady: boolean) {
  const [localProfile, setLocalProfile] = useState<UserPublicProfile | null>(() =>
    loadLocalJson<UserPublicProfile | null>(LOCAL_PROFILE_KEY, null)
  );
  const [localFriends, setLocalFriends] = useState<FriendContact[]>(() =>
    loadLocalJson<FriendContact[]>(LOCAL_FRIENDS_KEY, [])
  );
  const [localShares, setLocalShares] = useState<SharedItemRecord[]>(() =>
    loadLocalJson<SharedItemRecord[]>(LOCAL_SHARES_KEY, [])
  );
  const [redeemedShares, setRedeemedShares] = useState<SharedItemRecord[]>(() =>
    loadLocalJson<SharedItemRecord[]>(LOCAL_REDEEMED_KEY, [])
  );

  const [cloudProfile, setCloudProfile] = useState<UserPublicProfile | null>(null);
  const [cloudFriends, setCloudFriends] = useState<FriendContact[]>([]);
  const [cloudOutgoing, setCloudOutgoing] = useState<SharedItemRecord[]>([]);
  const [cloudIncoming, setCloudIncoming] = useState<SharedItemRecord[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    saveLocalJson(LOCAL_PROFILE_KEY, localProfile);
  }, [localProfile]);

  useEffect(() => {
    saveLocalJson(LOCAL_FRIENDS_KEY, localFriends);
  }, [localFriends]);

  useEffect(() => {
    saveLocalJson(LOCAL_SHARES_KEY, localShares);
  }, [localShares]);

  useEffect(() => {
    saveLocalJson(LOCAL_REDEEMED_KEY, redeemedShares);
  }, [redeemedShares]);

  const showToast = useCallback((msg: string) => {
    setShareMessage(msg);
    window.setTimeout(() => {
      setShareMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  // Subscribe to cloud profile, friends, outgoing shares, and incoming shares when authenticated
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudProfile(null);
      setCloudFriends([]);
      setCloudOutgoing([]);
      setCloudIncoming([]);
      return;
    }

    setCloudLoading(true);
    const unsubProfile = onSnapshot(
      doc(db, `publicProfiles/${user.uid}`),
      (snap) => {
        if (!snap.exists()) {
          setCloudProfile(null);
          return;
        }
        const data = snap.data();
        setCloudProfile({
          uid: String(data.uid || user.uid),
          username: String(data.username || ''),
          usernameLower: String(data.usernameLower || ''),
          displayName: String(data.displayName || user.displayName || 'مستخدم مسار'),
          bio: String(data.bio || ''),
          avatarLetter: String(data.avatarLetter || 'م'),
          updatedAt: toIsoString(data.updatedAt),
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `publicProfiles/${user.uid}`);
      }
    );

    const friendsPath = `users/${user.uid}/friends`;
    const unsubFriends = onSnapshot(
      query(collection(db, friendsPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: FriendContact[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              friendUid: String(data.friendUid || ''),
              username: String(data.username || ''),
              displayName: String(data.displayName || ''),
              addedAt: toIsoString(data.addedAt),
            };
          })
          .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
        setCloudFriends(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, friendsPath);
      }
    );

    const unsubOutgoing = onSnapshot(
      query(collection(db, 'shares'), where('ownerId', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => mapDocToShare({ id: d.id, data: () => d.data() }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setCloudOutgoing(list);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'shares');
      }
    );

    const unsubIncoming = onSnapshot(
      query(collection(db, 'shares'), where('recipientUid', '==', user.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => mapDocToShare({ id: d.id, data: () => d.data() }))
          .filter((s) => !s.revoked)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setCloudIncoming(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'shares');
      }
    );

    return () => {
      unsubProfile();
      unsubFriends();
      unsubOutgoing();
      unsubIncoming();
    };
  }, [authReady, user]);

  const myProfile = user ? cloudProfile : localProfile;
  const friends = user ? cloudFriends : localFriends;
  const outgoingShares = user ? cloudOutgoing : localShares;

  // Combine incoming targeted shares + redeemed invite shares (excluding duplicates & revoked)
  const incomingShares = (() => {
    const map = new Map<string, SharedItemRecord>();
    const direct = user ? cloudIncoming : localShares.filter((s) => !s.revoked && s.recipientUid === 'local_friend');
    for (const s of direct) {
      if (!s.revoked) map.set(s.id, s);
    }
    for (const s of redeemedShares) {
      if (!s.revoked && !map.has(s.id)) {
        map.set(s.id, s);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  })();

  const claimUsername = useCallback(
    async (rawUsername: string, displayNameInput: string, bioInput = '') => {
      setShareError(null);
      const err = validateUsername(rawUsername);
      if (err) {
        setShareError(err);
        throw new Error(err);
      }

      const username = normalizeUsername(rawUsername);
      const usernameLower = username.toLowerCase();
      const displayName = (displayNameInput.trim() || user?.displayName || username).slice(0, 120);
      const bio = bioInput.trim().slice(0, 300);
      const avatarLetter = (Array.from(displayName)[0] || Array.from(username)[0] || 'م').slice(0, 4);
      const nowIso = new Date().toISOString();

      if (!user) {
        const profile: UserPublicProfile = {
          uid: 'local',
          username,
          usernameLower,
          displayName,
          bio,
          avatarLetter,
          updatedAt: nowIso,
        };
        setLocalProfile(profile);
        showToast(`تم تفعيل معرفك العام @${username} محلياً.`);
        return profile;
      }

      const usernameDocPath = `usernames/${usernameLower}`;
      const existingSnap = await getDoc(doc(db, usernameDocPath));
      if (existingSnap.exists() && existingSnap.data()?.ownerUid !== user.uid) {
        const takenErr = `اسم المستخدم "@${username}" مستخدم بالفعل، اختر اسماً آخر.`;
        setShareError(takenErr);
        throw new Error(takenErr);
      }

      const batch = writeBatch(db);
      if (cloudProfile?.usernameLower && cloudProfile.usernameLower !== usernameLower) {
        batch.delete(doc(db, `usernames/${cloudProfile.usernameLower}`));
      }

      batch.set(doc(db, usernameDocPath), {
        usernameLower,
        username,
        ownerUid: user.uid,
        displayName,
        updatedAt: serverTimestamp(),
      });

      batch.set(doc(db, `publicProfiles/${user.uid}`), {
        uid: user.uid,
        username,
        usernameLower,
        displayName,
        bio,
        avatarLetter,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        const savedProfile: UserPublicProfile = {
          uid: user.uid,
          username,
          usernameLower,
          displayName,
          bio,
          avatarLetter,
          updatedAt: nowIso,
        };
        showToast(`تم حفظ معرفك العام @${username} بنجاح.`);
        return savedProfile;
      } catch (commitErr) {
        handleFirestoreError(commitErr, OperationType.WRITE, usernameDocPath);
        throw commitErr;
      }
    },
    [user, cloudProfile, showToast]
  );

  const lookupUserByUsername = useCallback(
    async (rawUsername: string): Promise<UserPublicProfile | null> => {
      setShareError(null);
      const clean = normalizeUsername(rawUsername);
      if (clean.length < 3) {
        setShareError('أدخل اسم مستخدم من 3 أحرف إنجليزية على الأقل للبحث.');
        return null;
      }
      const lower = clean.toLowerCase();

      if (!user) {
        // Offline / local preview check against saved friends or self
        const existingFriend = localFriends.find((f) => f.username.toLowerCase() === lower);
        if (existingFriend) {
          return {
            uid: existingFriend.friendUid,
            username: existingFriend.username,
            usernameLower: lower,
            displayName: existingFriend.displayName,
            bio: '',
            avatarLetter: Array.from(existingFriend.displayName)[0] || 'ص',
            updatedAt: existingFriend.addedAt,
          };
        }
        setShareError('سجّل الدخول بحسابك للبحث المباشر عن الأصدقاء عبر المنصة، أو استخدم رابط الدعوة السريع.');
        return null;
      }

      try {
        const claimSnap = await getDoc(doc(db, `usernames/${lower}`));
        if (!claimSnap.exists()) {
          return null;
        }
        const claimData = claimSnap.data();
        const ownerUid = String(claimData.ownerUid || '');
        if (!ownerUid) return null;

        const profileSnap = await getDoc(doc(db, `publicProfiles/${ownerUid}`));
        if (profileSnap.exists()) {
          const p = profileSnap.data();
          return {
            uid: String(p.uid || ownerUid),
            username: String(p.username || claimData.username || clean),
            usernameLower: lower,
            displayName: String(p.displayName || claimData.displayName || clean),
            bio: String(p.bio || ''),
            avatarLetter: String(p.avatarLetter || 'م'),
            updatedAt: toIsoString(p.updatedAt),
          };
        }
        return {
          uid: ownerUid,
          username: String(claimData.username || clean),
          usernameLower: lower,
          displayName: String(claimData.displayName || clean),
          bio: '',
          avatarLetter: Array.from(String(claimData.displayName || clean))[0] || 'م',
          updatedAt: new Date().toISOString(),
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `usernames/${lower}`);
        return null;
      }
    },
    [user, localFriends]
  );

  const addFriend = useCallback(
    async (profile: UserPublicProfile): Promise<FriendContact> => {
      setShareError(null);
      if (user && profile.uid === user.uid) {
        const msg = 'لا يمكنك إضافة حسابك الشخصي إلى قائمة الأصدقاء.';
        setShareError(msg);
        throw new Error(msg);
      }

      const existing = friends.find(
        (f) => f.friendUid === profile.uid || f.username.toLowerCase() === profile.usernameLower
      );
      if (existing) {
        showToast(`@${profile.username} موجود بالفعل في قائمة أصدقائك.`);
        return existing;
      }

      const nowIso = new Date().toISOString();
      const friendId = createSafeId('frd');
      const contact: FriendContact = {
        id: friendId,
        ownerId: user?.uid || 'local',
        friendUid: profile.uid,
        username: profile.username.slice(0, 32),
        displayName: profile.displayName.slice(0, 120),
        addedAt: nowIso,
      };

      if (!user) {
        setLocalFriends((prev) => [contact, ...prev]);
        showToast(`تمت إضافة @${contact.username} إلى قائمة الأصدقاء.`);
        return contact;
      }

      const docPath = `users/${user.uid}/friends/${friendId}`;
      try {
        await setDoc(doc(db, docPath), {
          id: friendId,
          ownerId: user.uid,
          friendUid: contact.friendUid,
          username: contact.username,
          displayName: contact.displayName,
          addedAt: serverTimestamp(),
        });
        showToast(`تمت إضافة @${contact.username} إلى أصدقائك.`);
        return contact;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
        throw err;
      }
    },
    [user, friends, showToast]
  );

  const removeFriend = useCallback(
    async (friendId: string) => {
      setShareError(null);
      if (!user) {
        setLocalFriends((prev) => prev.filter((f) => f.id !== friendId));
        showToast('تمت إزالة الصديق من قائمتك.');
        return;
      }
      const docPath = `users/${user.uid}/friends/${friendId}`;
      try {
        await deleteDoc(doc(db, docPath));
        showToast('تمت إزالة الصديق من قائمتك.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, showToast]
  );

  const createShare = useCallback(
    async (req: CreateShareRequest): Promise<{ share: SharedItemRecord; inviteUrl: string }> => {
      setShareError(null);
      const bundle = buildSanitizedShareBundle({
        itemType: req.itemType,
        includePersonalNotes: req.includePersonalNotes,
        ...req.sourceData,
      });

      const payloadJson = JSON.stringify(bundle);
      if (payloadJson.length > 195000) {
        const sizeErr = 'حجم البيانات المشاركة كبير جداً. حاول تقليل النصوص المرفقة قبل المشاركة.';
        setShareError(sizeErr);
        throw new Error(sizeErr);
      }

      const shareId = createSafeId('shr');
      const shareCode = generateShareCode();
      const nowIso = new Date().toISOString();
      const ownerUsername = (myProfile?.username || (user ? 'user' : 'local_creator')).slice(0, 40);
      const ownerDisplayName = (myProfile?.displayName || user?.displayName || 'مستخدم مسار').slice(0, 120);

      const record: SharedItemRecord = {
        id: shareId,
        ownerId: user?.uid || 'local',
        ownerUsername,
        ownerDisplayName,
        recipientUid: (req.recipient?.uid || '').slice(0, 128),
        recipientUsername: (req.recipient?.username || '').slice(0, 40),
        itemType: req.itemType,
        itemId: req.itemId.slice(0, 128),
        itemTitle: (bundle.title || 'محتوى مشترك').slice(0, 200),
        itemSummary: (bundle.summary || '').slice(0, 500),
        itemThumbnail: (bundle.thumbnail || '').slice(0, 2048),
        role: req.role,
        shareCode,
        revoked: false,
        allowCopy: req.allowCopy,
        includePersonalNotes: Boolean(req.includePersonalNotes),
        payloadJson,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const inviteUrl = buildShareInviteUrl(window.location.origin, shareId, shareCode);

      if (!user) {
        setLocalShares((prev) => [record, ...prev]);
        showToast(`تم إنشاء رابط المشاركة "${record.itemTitle}" محلياً.`);
        return { share: record, inviteUrl };
      }

      const docPath = `shares/${shareId}`;
      try {
        await setDoc(doc(db, docPath), {
          ...record,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(
          record.recipientUsername
            ? `تمت مشاركة "${record.itemTitle}" مع @${record.recipientUsername}.`
            : `تم إنشاء رابط دعوة لـ "${record.itemTitle}".`
        );
        return { share: record, inviteUrl };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
        throw err;
      }
    },
    [user, myProfile, showToast]
  );

  const updateSharePermissions = useCallback(
    async (
      shareId: string,
      patch: Partial<Pick<SharedItemRecord, 'role' | 'revoked' | 'allowCopy'>>
    ) => {
      setShareError(null);
      const nowIso = new Date().toISOString();

      if (!user) {
        setLocalShares((prev) =>
          prev.map((s) => (s.id === shareId ? { ...s, ...patch, updatedAt: nowIso } : s))
        );
        showToast(patch.revoked ? 'تم إلغاء صلاحية الوصول للمشاركة.' : 'تم تحديث صلاحيات المشاركة.');
        return;
      }

      const docPath = `shares/${shareId}`;
      const cleanPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.role !== undefined) cleanPatch.role = patch.role;
      if (patch.revoked !== undefined) cleanPatch.revoked = patch.revoked;
      if (patch.allowCopy !== undefined) cleanPatch.allowCopy = patch.allowCopy;

      try {
        await updateDoc(doc(db, docPath), cleanPatch);
        showToast(patch.revoked ? 'تم إيقاف المشاركة بنجاح.' : 'تم تحديث صلاحيات المشاركة.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, showToast]
  );

  const deleteShare = useCallback(
    async (shareId: string) => {
      setShareError(null);
      if (!user) {
        setLocalShares((prev) => prev.filter((s) => s.id !== shareId));
        setRedeemedShares((prev) => prev.filter((s) => s.id !== shareId));
        showToast('تم حذف المشاركة نهائياً.');
        return;
      }
      const docPath = `shares/${shareId}`;
      try {
        await deleteDoc(doc(db, docPath));
        showToast('تم حذف المشاركة نهائياً.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, showToast]
  );

  const updateSharedPayload = useCallback(
    async (shareId: string, updatedBundle: SharedPayloadBundle) => {
      setShareError(null);
      const payloadJson = JSON.stringify(updatedBundle);
      if (payloadJson.length > 195000) {
        const msg = 'حجم التعديلات يتجاوز الحد المسموح به للمشاركة.';
        setShareError(msg);
        throw new Error(msg);
      }

      const nowIso = new Date().toISOString();
      const itemTitle = (updatedBundle.title || 'محتوى مشترك').slice(0, 200);
      const itemSummary = (updatedBundle.summary || '').slice(0, 500);

      if (!user) {
        setLocalShares((prev) =>
          prev.map((s) =>
            s.id === shareId
              ? { ...s, payloadJson, itemTitle, itemSummary, updatedAt: nowIso }
              : s
          )
        );
        setRedeemedShares((prev) =>
          prev.map((s) =>
            s.id === shareId
              ? { ...s, payloadJson, itemTitle, itemSummary, updatedAt: nowIso }
              : s
          )
        );
        showToast('تم حفظ تعديلات التعاون المشتركة.');
        return;
      }

      const docPath = `shares/${shareId}`;
      try {
        await updateDoc(doc(db, docPath), {
          payloadJson,
          itemTitle,
          itemSummary,
          updatedAt: serverTimestamp(),
        });
        setRedeemedShares((prev) =>
          prev.map((s) =>
            s.id === shareId
              ? { ...s, payloadJson, itemTitle, itemSummary, updatedAt: nowIso }
              : s
          )
        );
        showToast('تم حفظ التعديلات التعاونية ومزامنتها.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, showToast]
  );

  const redeemShareInvite = useCallback(
    async (shareIdInput: string, shareCodeInput: string): Promise<SharedItemRecord | null> => {
      setShareError(null);
      const cleanId = shareIdInput.trim();
      const cleanCode = shareCodeInput.trim();

      // Check local first (or URL parsed against local shares)
      const localFound = localShares.find((s) => s.id === cleanId || s.shareCode === cleanId);
      if (localFound && !user) {
        if (localFound.revoked) {
          setShareError('تم إلغاء صلاحية رابط المشاركة هذا من قبل المالك.');
          return null;
        }
        if (cleanCode && localFound.shareCode !== cleanCode) {
          setShareError('رمز الدعوة غير مطابق لرابط المشاركة.');
          return null;
        }
        setRedeemedShares((prev) => [localFound, ...prev.filter((x) => x.id !== localFound.id)]);
        return localFound;
      }

      if (!user) {
        setShareError('يرجى تسجيل الدخول بحسابك لفتح روابط المشاركة السحابية.');
        return null;
      }

      try {
        const snap = await getDoc(doc(db, `shares/${cleanId}`));
        if (!snap.exists()) {
          setShareError('تعذر العثور على هذا العنصر المشترك أو تم حذفه.');
          return null;
        }
        const record = mapDocToShare({ id: snap.id, data: () => snap.data() });
        if (record.revoked) {
          setShareError('تم إيقاف رابط المشاركة هذا من قبل المالك.');
          return null;
        }
        if (
          record.ownerId !== user.uid &&
          record.recipientUid !== user.uid &&
          cleanCode &&
          record.shareCode !== cleanCode
        ) {
          setShareError('رمز التحقق للوصول إلى المشاركة غير صحيح.');
          return null;
        }
        if (record.ownerId !== user.uid && record.recipientUid !== user.uid) {
          setRedeemedShares((prev) => [record, ...prev.filter((x) => x.id !== record.id)]);
        }
        return record;
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `shares/${cleanId}`);
        return null;
      }
    },
    [user, localShares]
  );

  return {
    myProfile,
    friends,
    outgoingShares,
    incomingShares,
    cloudLoading,
    shareMessage,
    shareError,
    dismissShareError: () => setShareError(null),
    claimUsername,
    lookupUserByUsername,
    addFriend,
    removeFriend,
    createShare,
    updateSharePermissions,
    deleteShare,
    updateSharedPayload,
    redeemShareInvite,
  };
}
