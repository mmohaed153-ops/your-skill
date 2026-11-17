import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Link2,
  Lock,
  Search,
  Share2,
  Shield,
  ShieldOff,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { CreateShareRequest } from '../../hooks/useSocialSharing';
import type {
  FriendContact,
  ShareableItemType,
  SharedItemRecord,
  SharePermissionRole,
  UserPublicProfile,
} from '../../types/workspace';
import {
  normalizeUsername,
  SHARE_ITEM_TYPE_LABELS,
  SHARE_ROLE_DESCRIPTIONS,
  SHARE_ROLE_LABELS,
} from '../../utils/sharingLogic';

export interface ShareTargetDescriptor {
  itemType: ShareableItemType;
  itemId: string;
  title: string;
  sourceData: CreateShareRequest['sourceData'];
}

interface ShareItemModalProps {
  open: boolean;
  target: ShareTargetDescriptor | null;
  myProfile: UserPublicProfile | null;
  friends: FriendContact[];
  existingShares: SharedItemRecord[];
  onClose: () => void;
  onClaimUsername: (username: string, displayName: string, bio?: string) => Promise<UserPublicProfile>;
  onLookupUsername: (username: string) => Promise<UserPublicProfile | null>;
  onAddFriend: (profile: UserPublicProfile) => Promise<FriendContact>;
  onCreateShare: (req: CreateShareRequest) => Promise<{ share: SharedItemRecord; inviteUrl: string }>;
  onUpdateSharePermissions: (
    shareId: string,
    patch: Partial<Pick<SharedItemRecord, 'role' | 'revoked' | 'allowCopy'>>
  ) => Promise<void>;
}

export function ShareItemModal({
  open,
  target,
  myProfile,
  friends,
  existingShares,
  onClose,
  onClaimUsername,
  onLookupUsername,
  onAddFriend,
  onCreateShare,
  onUpdateSharePermissions,
}: ShareItemModalProps) {
  const [role, setRole] = useState<SharePermissionRole>('viewer');
  const [allowCopy, setAllowCopy] = useState(true);
  const [includePersonalNotes, setIncludePersonalNotes] = useState(false);

  const [shareMode, setShareMode] = useState<'link' | 'friend'>('link');
  const [selectedFriendUid, setSelectedFriendUid] = useState('');
  const [usernameSearch, setUsernameSearch] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);
  const [foundProfile, setFoundProfile] = useState<UserPublicProfile | null>(null);
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);

  // Quick inline username claim if user hasn't picked one yet
  const [claimHandle, setClaimHandle] = useState('');
  const [claimName, setClaimName] = useState('');
  const [claimingBusy, setClaimingBusy] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRole('viewer');
      setAllowCopy(true);
      setIncludePersonalNotes(false);
      setShareMode(friends.length > 0 ? 'friend' : 'link');
      setSelectedFriendUid(friends[0]?.friendUid || '');
      setUsernameSearch('');
      setFoundProfile(null);
      setLookupFeedback(null);
      setGeneratedLink('');
      setCopiedUrl(false);
      setModalError(null);
    }
  }, [open, target?.itemId, friends]);

  if (!open || !target) return null;

  const itemShares = existingShares.filter((s) => s.itemId === target.itemId);
  const supportsPersonalNotesToggle =
    target.itemType === 'learning_board' || target.itemType === 'saved_game_jam';

  const handleQuickClaim = async () => {
    if (!claimHandle.trim()) return;
    setClaimingBusy(true);
    setModalError(null);
    try {
      await onClaimUsername(claimHandle, claimName || claimHandle);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'تعذر حجز اسم المستخدم.');
    } finally {
      setClaimingBusy(false);
    }
  };

  const handleLookupFriend = async () => {
    const clean = normalizeUsername(usernameSearch);
    if (!clean) return;
    setSearchingUser(true);
    setLookupFeedback(null);
    setFoundProfile(null);
    try {
      const profile = await onLookupUsername(clean);
      if (!profile) {
        setLookupFeedback(`لم يتم العثور على مستخدم بالمعرف @${clean}. تأكد من الاسم أو أرسل رابط الدعوة مباشرة.`);
      } else {
        setFoundProfile(profile);
      }
    } finally {
      setSearchingUser(false);
    }
  };

  const handleAddAndSelectFound = async () => {
    if (!foundProfile) return;
    try {
      const contact = await onAddFriend(foundProfile);
      setSelectedFriendUid(contact.friendUid);
      setShareMode('friend');
      setLookupFeedback(`تمت إضافة @${contact.username} ويمكنك الآن اختياره للمشاركة.`);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'تعذر إضافة الصديق.');
    }
  };

  const handleSubmitShare = async () => {
    setModalError(null);
    let recipient: { uid: string; username: string } | undefined;

    if (shareMode === 'friend') {
      const f = friends.find((x) => x.friendUid === selectedFriendUid);
      if (f) {
        recipient = { uid: f.friendUid, username: f.username };
      } else if (foundProfile) {
        recipient = { uid: foundProfile.uid, username: foundProfile.username };
      } else {
        setModalError('اختر صديقاً من القائمة أو انتقل إلى إنشاء رابط دعوة.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await onCreateShare({
        itemType: target.itemType,
        itemId: target.itemId,
        role,
        allowCopy,
        includePersonalNotes: supportsPersonalNotesToggle ? includePersonalNotes : false,
        recipient,
        sourceData: target.sourceData,
      });
      setGeneratedLink(res.inviteUrl);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'تعذر إنشاء المشاركة.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Share2 className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-amber-300">
                مشاركة {SHARE_ITEM_TYPE_LABELS[target.itemType]}
              </div>
              <h2 id="share-modal-title" className="text-base sm:text-lg font-extrabold truncate">
                {target.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة المشاركة"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {modalError && (
            <div
              role="alert"
              className="rounded-lg border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#B92622] dark:text-rose-200"
            >
              {modalError}
            </div>
          )}

          {/* Privacy Guarantee Banner */}
          <div className="rounded-xl border border-emerald-600/30 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 flex items-start gap-2.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
            <Lock className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              خصوصيتك محمية: لا تتم مشاركة بريدك الإلكتروني أو ملاحظاتك الخاصة أو ملفاتك السرية إلا إذا اخترتها صراحةً.
            </span>
          </div>

          {/* Inline Username Setup if missing */}
          {!myProfile && (
            <div className="rounded-xl border-2 border-[#062D4C]/25 bg-slate-50 dark:bg-slate-800 p-4 space-y-3">
              <div className="text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white">
                حدّد اسم مستخدم عام (@username) ليتمكن أصدقاؤك من العثور عليك (اختياري):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={claimHandle}
                  onChange={(e) => setClaimHandle(e.target.value)}
                  placeholder="username (إنجليزي)"
                  dir="ltr"
                  className="rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#062D4C] dark:text-white"
                />
                <input
                  type="text"
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  placeholder="الاسم المعروض"
                  className="rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-[#062D4C] dark:text-white"
                />
                <button
                  type="button"
                  disabled={claimingBusy || !claimHandle.trim()}
                  onClick={() => void handleQuickClaim()}
                  className="px-3 py-2 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {claimingBusy ? 'جاري الحفظ...' : 'حجز المعرف'}
                </button>
              </div>
            </div>
          )}

          {/* Method Switcher: Direct Friend vs Invite Link */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="share-mode-friend"
                onClick={() => setShareMode('friend')}
                className={`inline-flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-extrabold rounded-xl border-2 cursor-pointer ${
                  shareMode === 'friend'
                    ? 'bg-[#062D4C] text-white border-[#062D4C]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>مشاركة مع صديق بالمنصة</span>
              </button>
              <button
                type="button"
                data-testid="share-mode-link"
                onClick={() => setShareMode('link')}
                className={`inline-flex items-center justify-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-extrabold rounded-xl border-2 cursor-pointer ${
                  shareMode === 'link'
                    ? 'bg-[#062D4C] text-white border-[#062D4C]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
                }`}
              >
                <Link2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>رابط دعوة فريد</span>
              </button>
            </div>

            {shareMode === 'friend' && (
              <div className="rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
                {/* Search Friend by Username */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      type="text"
                      data-testid="share-friend-search-input"
                      value={usernameSearch}
                      onChange={(e) => setUsernameSearch(e.target.value)}
                      placeholder="ابحث باسم المستخدم @username..."
                      dir="ltr"
                      className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-900 pr-9 pl-3 py-2 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    data-testid="share-friend-search-btn"
                    disabled={searchingUser || !usernameSearch.trim()}
                    onClick={() => void handleLookupFriend()}
                    className="px-4 py-2 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-xl cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {searchingUser ? 'جاري البحث...' : 'بحث بالمعرف'}
                  </button>
                </div>

                {lookupFeedback && (
                  <p className="text-xs font-bold text-slate-600 dark:text-amber-300">
                    {lookupFeedback}
                  </p>
                )}

                {foundProfile && (
                  <div className="rounded-xl border-2 border-emerald-600 bg-white dark:bg-slate-900 p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                        {foundProfile.displayName}
                      </div>
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">
                        @{foundProfile.username}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAddAndSelectFound()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>إضافة كصديق</span>
                    </button>
                  </div>
                )}

                {/* Existing Friends Selector */}
                {friends.length > 0 ? (
                  <div>
                    <label htmlFor="share-friend-select" className="block text-xs font-bold text-[#062D4C] dark:text-slate-300 mb-1">
                      اختر من أصدقائك ({friends.length})
                    </label>
                    <select
                      id="share-friend-select"
                      value={selectedFriendUid}
                      onChange={(e) => setSelectedFriendUid(e.target.value)}
                      className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
                    >
                      {friends.map((f) => (
                        <option key={f.id} value={f.friendUid}>
                          {f.displayName} (@{f.username})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  !foundProfile && (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      لا يوجد أصدقاء محفوظون بعد. يمكنك البحث باسم المستخدم أو استخدام &quot;رابط دعوة فريد&quot; وإرساله مباشرة.
                    </p>
                  )
                )}
              </div>
            )}
          </div>

          {/* Permission Level Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#062D4C] dark:text-white">
              <Shield className="w-4 h-4 text-[#B92622] dark:text-amber-300" aria-hidden="true" />
              <span>صلاحية الوصول</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(['viewer', 'collaborator', 'owner'] as SharePermissionRole[]).map((perm) => {
                const active = role === perm;
                return (
                  <button
                    key={perm}
                    type="button"
                    data-testid={`share-role-${perm}`}
                    onClick={() => setRole(perm)}
                    className={`text-right rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#062D4C] text-white border-[#062D4C]'
                        : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/20 dark:border-slate-700 hover:border-[#062D4C]'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-extrabold">{SHARE_ROLE_LABELS[perm]}</div>
                    <div className={`text-[11px] font-medium mt-0.5 ${active ? 'text-amber-200' : 'text-slate-500 dark:text-slate-400'}`}>
                      {SHARE_ROLE_DESCRIPTIONS[perm]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options: Allow Copy + Explicit Notes Opt-in */}
          <div className="space-y-2.5 rounded-xl border border-[#062D4C]/15 dark:border-slate-700 p-3.5 bg-slate-50 dark:bg-slate-800/50">
            <label className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={allowCopy}
                onChange={(e) => setAllowCopy(e.target.checked)}
                className="w-4 h-4 accent-[#062D4C] rounded"
              />
              <span>السماح للمستلم بحفظ نسخة مستقلة من هذا المحتوى في حسابه</span>
            </label>

            {supportsPersonalNotesToggle && (
              <label className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePersonalNotes}
                  onChange={(e) => setIncludePersonalNotes(e.target.checked)}
                  className="w-4 h-4 accent-[#B92622] rounded"
                />
                <span>تضمين ملاحظاتي الشخصية المكتوبة داخل البطاقات (اختياري — مغلق افتراضياً)</span>
              </label>
            )}
          </div>

          {/* Primary Create Share Button */}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              data-testid="create-share-submit-btn"
              disabled={submitting}
              onClick={() => void handleSubmitShare()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] disabled:opacity-50 border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
            >
              <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'جاري الإنشاء...' : 'توليد رابط ومشاركة الآن'}</span>
            </button>
          </div>

          {/* Generated Link Box */}
          {generatedLink && (
            <div
              data-testid="generated-share-link-box"
              className="rounded-xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 p-4 space-y-2"
            >
              <div className="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                رابط المشاركة الفريد جاهز! أرسله لصديقك لفتحه داخل المنصة:
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={generatedLink}
                  className="flex-1 min-w-0 rounded-lg border border-emerald-600/40 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-mono text-[#062D4C] dark:text-white"
                />
                <button
                  type="button"
                  data-testid="copy-share-link-btn"
                  onClick={() => void handleCopyUrl()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer shrink-0"
                >
                  {copiedUrl ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  <span>{copiedUrl ? 'تم النسخ' : 'نسخ الرابط'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Existing Active Shares Management for this item */}
          {itemShares.length > 0 && (
            <div className="pt-3 border-t-2 border-[#062D4C]/15 dark:border-slate-700 space-y-2.5">
              <div className="text-xs font-extrabold text-[#062D4C] dark:text-slate-200">
                المشاركات الحالية لهذا العنصر ({itemShares.length}):
              </div>
              <ul className="space-y-2">
                {itemShares.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="text-xs font-bold">
                      <span className="text-[#062D4C] dark:text-white">
                        {s.recipientUsername ? `@${s.recipientUsername}` : `رابط دعوة (${s.shareCode})`}
                      </span>
                      {s.revoked && (
                        <span className="mr-2 text-[#B92622] dark:text-rose-400">· ملغاة</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        aria-label="تغيير الصلاحية"
                        value={s.role}
                        onChange={(e) =>
                          void onUpdateSharePermissions(s.id, {
                            role: e.target.value as SharePermissionRole,
                          })
                        }
                        className="rounded-lg border border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-bold text-[#062D4C] dark:text-white"
                      >
                        <option value="viewer">عرض فقط</option>
                        <option value="collaborator">متعاون</option>
                        <option value="owner">مالك مشارك</option>
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateSharePermissions(s.id, { revoked: !s.revoked })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold rounded-lg cursor-pointer ${
                          s.revoked
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-[#B92622] dark:text-rose-300 border border-[#B92622]/30'
                        }`}
                      >
                        <ShieldOff className="w-3 h-3" aria-hidden="true" />
                        <span>{s.revoked ? 'تفعيل' : 'إيقاف الوصول'}</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
