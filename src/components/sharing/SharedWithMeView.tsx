import { useState } from 'react';
import {
  AtSign,
  CopyPlus,
  Eye,
  Inbox,
  Link2,
  Search,
  Send,
  Share2,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { SectionHeroBanner } from '../SectionHeroBanner';
import type {
  FriendContact,
  SharedItemRecord,
  SharePermissionRole,
  UserPublicProfile,
} from '../../types/workspace';
import {
  extractShareParamsFromSearch,
  normalizeUsername,
  parseSharePayload,
  SHARE_ITEM_TYPE_LABELS,
  SHARE_ROLE_LABELS,
  type SharedPayloadBundle,
} from '../../utils/sharingLogic';

interface SharedWithMeViewProps {
  myProfile: UserPublicProfile | null;
  friends: FriendContact[];
  outgoingShares: SharedItemRecord[];
  incomingShares: SharedItemRecord[];
  cloudLoading: boolean;
  onClaimUsername: (username: string, displayName: string, bio?: string) => Promise<UserPublicProfile>;
  onLookupUsername: (username: string) => Promise<UserPublicProfile | null>;
  onAddFriend: (profile: UserPublicProfile) => Promise<FriendContact>;
  onRemoveFriend: (friendId: string) => Promise<void>;
  onOpenSharedItem: (share: SharedItemRecord) => void;
  onSaveCopyToMyAccount: (share: SharedItemRecord, bundle: SharedPayloadBundle) => Promise<void>;
  onUpdateSharePermissions: (
    shareId: string,
    patch: Partial<Pick<SharedItemRecord, 'role' | 'revoked' | 'allowCopy'>>
  ) => Promise<void>;
  onDeleteShare: (shareId: string) => Promise<void>;
  onRedeemShareInvite: (shareId: string, shareCode: string) => Promise<SharedItemRecord | null>;
}

export function SharedWithMeView({
  myProfile,
  friends,
  outgoingShares,
  incomingShares,
  cloudLoading,
  onClaimUsername,
  onLookupUsername,
  onAddFriend,
  onRemoveFriend,
  onOpenSharedItem,
  onSaveCopyToMyAccount,
  onUpdateSharePermissions,
  onDeleteShare,
  onRedeemShareInvite,
}: SharedWithMeViewProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');

  // Public Profile Editor
  const [usernameInput, setUsernameInput] = useState(myProfile?.username || '');
  const [displayNameInput, setDisplayNameInput] = useState(myProfile?.displayName || '');
  const [bioInput, setBioInput] = useState(myProfile?.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Friend Search
  const [friendSearchInput, setFriendSearchInput] = useState('');
  const [searchingFriend, setSearchingFriend] = useState(false);
  const [foundFriend, setFoundFriend] = useState<UserPublicProfile | null>(null);
  const [friendLookupMsg, setFriendLookupMsg] = useState<string | null>(null);

  // Invite URL / Code Redemption
  const [inviteInput, setInviteInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onClaimUsername(usernameInput || myProfile?.username || '', displayNameInput, bioInput);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSearchFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeUsername(friendSearchInput);
    if (!clean) return;
    setSearchingFriend(true);
    setFriendLookupMsg(null);
    setFoundFriend(null);
    try {
      const profile = await onLookupUsername(clean);
      if (!profile) {
        setFriendLookupMsg(`لم يتم العثور على مستخدم بالمعرف @${clean}.`);
      } else {
        setFoundFriend(profile);
      }
    } finally {
      setSearchingFriend(false);
    }
  };

  const handleRedeemInput = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inviteInput.trim();
    if (!raw) return;
    setRedeeming(true);
    try {
      let shareId = raw;
      let shareCode = '';
      if (raw.includes('share=')) {
        const qIdx = raw.indexOf('?');
        const extracted = extractShareParamsFromSearch(qIdx >= 0 ? raw.slice(qIdx) : raw);
        if (extracted) {
          shareId = extracted.shareId;
          shareCode = extracted.shareCode;
        }
      }
      const opened = await onRedeemShareInvite(shareId, shareCode);
      if (opened) {
        setInviteInput('');
        onOpenSharedItem(opened);
      }
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <SectionHeroBanner
        testId="sharing-hero-banner"
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-rose-400">
              <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>التعاون والمشاركة الذكية مع الأصدقاء</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums text-[#062D4C] dark:text-slate-200">
              {friends.length} أصدقاء · {incomingShares.length} مشاركات واردة · {outgoingShares.length} صادرة
            </span>
          </>
        }
        title="المشاركات والتعاون (Shared With Me)"
        description="شارك مسارات التعلم، الكورسات، المسابقات، المشاريع، اللوحات، والملاحظات المختارة مع أصدقائك بصلاحيات دقيقة وحفظ نسخة مستقلة."
      />

      {/* Top Grid: Public Username Profile + Friends Search + Open Invite Link */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Username Profile Setup */}
        <form
          onSubmit={(e) => void handleSaveProfile(e)}
          className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#062D4C] dark:text-white">
            <AtSign className="w-4 h-4 text-[#B92622] dark:text-rose-400 shrink-0" aria-hidden="true" />
            <span>معرفك العام للمشاركة</span>
          </div>
          {myProfile ? (
            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-600/30 px-3 py-2 text-xs font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <span>{myProfile.displayName}</span>
              <span dir="ltr">@{myProfile.username}</span>
            </div>
          ) : (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              اختر اسم مستخدم عام ليتمكن أصدقاؤك من إضافتك بالاسم فقط دون إظهار بريدك الإلكتروني.
            </p>
          )}
          <input
            type="text"
            data-testid="sharing-username-input"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder={myProfile?.username || 'اسم المستخدم (مثال: ahmed_dev)'}
            dir="ltr"
            className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
          />
          <input
            type="text"
            value={displayNameInput}
            onChange={(e) => setDisplayNameInput(e.target.value)}
            placeholder={myProfile?.displayName || 'الاسم المعروض للأصدقاء'}
            className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
          />
          <button
            type="submit"
            disabled={savingProfile}
            data-testid="sharing-save-profile-btn"
            className="w-full py-2 px-4 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-xl cursor-pointer disabled:opacity-50"
          >
            {savingProfile ? 'جاري الحفظ...' : myProfile ? 'تحديث المعرف والاسم' : 'حفظ معرف المشاركة'}
          </button>
        </form>

        {/* Card 2: Find & Manage Friends */}
        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#062D4C] dark:text-white">
            <Users className="w-4 h-4 text-[#B92622] dark:text-rose-400 shrink-0" aria-hidden="true" />
            <span>دليل الأصدقاء ({friends.length})</span>
          </div>

          <form onSubmit={(e) => void handleSearchFriend(e)} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={friendSearchInput}
                onChange={(e) => setFriendSearchInput(e.target.value)}
                placeholder="بحث باسم المستخدم..."
                dir="ltr"
                className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-9 pl-3 py-2 text-xs font-bold text-[#062D4C] dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={searchingFriend || !friendSearchInput.trim()}
              className="px-3 py-2 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
            >
              بحث
            </button>
          </form>

          {friendLookupMsg && (
            <p className="text-xs font-bold text-slate-600 dark:text-amber-300">{friendLookupMsg}</p>
          )}

          {foundFriend && (
            <div className="rounded-xl border border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 flex items-center justify-between gap-2">
              <div className="text-xs font-bold">
                <span className="text-[#062D4C] dark:text-white">{foundFriend.displayName}</span>
                <span className="mr-1.5 text-emerald-700 dark:text-emerald-400" dir="ltr">
                  @{foundFriend.username}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void onAddFriend(foundFriend)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-white bg-emerald-600 rounded-lg cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة</span>
              </button>
            </div>
          )}

          {friends.length > 0 ? (
            <ul className="space-y-1.5 max-h-28 overflow-y-auto">
              {friends.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                >
                  <span className="truncate">
                    {f.displayName} <span className="text-slate-500" dir="ltr">(@{f.username})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void onRemoveFriend(f.id)}
                    aria-label={`إزالة ${f.displayName}`}
                    className="text-slate-400 hover:text-[#B92622] cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              أضف أصدقاءك بالمعرف لمشاركتهم العناصر بضغطة واحدة.
            </p>
          )}
        </div>

        {/* Card 3: Redeem Invite Link / Code */}
        <form
          onSubmit={(e) => void handleRedeemInput(e)}
          className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#062D4C] dark:text-white">
            <Link2 className="w-4 h-4 text-[#B92622] dark:text-rose-400 shrink-0" aria-hidden="true" />
            <span>فتح رابط دعوة مشاركة</span>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
            هل وصلك رابط مشاركة من صديق؟ الصقه هنا لعرضه وحفظ نسخة منه في حسابك فوراً.
          </p>
          <input
            type="text"
            data-testid="redeem-share-link-input"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder="https://.../?share=...&code=..."
            dir="ltr"
            className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-mono text-[#062D4C] dark:text-white"
          />
          <button
            type="submit"
            disabled={redeeming || !inviteInput.trim()}
            data-testid="redeem-share-link-btn"
            className="w-full py-2 px-4 text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer disabled:opacity-50"
          >
            {redeeming ? 'جاري الفتح...' : 'فتح المشاركة الآن'}
          </button>
        </form>
      </div>

      {/* Tabs: Incoming vs Outgoing Shares */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          data-testid="tab-incoming-shares"
          onClick={() => setActiveTab('incoming')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold rounded-xl border-2 cursor-pointer ${
            activeTab === 'incoming'
              ? 'bg-[#062D4C] text-white border-[#062D4C] shadow-[0_3px_0_#041E34]'
              : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/30'
          }`}
        >
          <Inbox className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">تمت مشاركته معي ({incomingShares.length})</span>
        </button>

        <button
          type="button"
          data-testid="tab-outgoing-shares"
          onClick={() => setActiveTab('outgoing')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold rounded-xl border-2 cursor-pointer ${
            activeTab === 'outgoing'
              ? 'bg-[#B92622] text-white border-[#062D4C] shadow-[0_3px_0_#041E34]'
              : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/30'
          }`}
        >
          <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">مشاركاتي الصادرة ({outgoingShares.length})</span>
        </button>
      </div>

      {/* Content Grid */}
      {cloudLoading && incomingShares.length === 0 && outgoingShares.length === 0 ? (
        <div className="py-12 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
          جاري تحميل المشاركات...
        </div>
      ) : activeTab === 'incoming' ? (
        incomingShares.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white/95 dark:bg-slate-900 p-10 text-center space-y-2">
            <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white">
              لا توجد مشاركات واردة حالياً
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
              عندما يشاركك صديق مسار تعلم أو كورساً أو مسابقة، أو عند لصق رابط دعوة بالأعلى، ستظهر هنا فوراً.
            </p>
          </div>
        ) : (
          <div data-testid="incoming-shares-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {incomingShares.map((s) => {
              const parsed = parseSharePayload(s.payloadJson);
              return (
                <article
                  key={s.id}
                  data-testid={`incoming-share-card-${s.id}`}
                  className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#B92622] dark:text-amber-300">
                      <span>{SHARE_ITEM_TYPE_LABELS[s.itemType]}</span>
                      <span>·</span>
                      <span className="text-[#062D4C] dark:text-slate-300">من @{s.ownerUsername}</span>
                    </div>
                    <h3 className="text-base font-extrabold text-[#062D4C] dark:text-white leading-snug">
                      {s.itemTitle}
                    </h3>
                    {s.itemSummary && (
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2">
                        {s.itemSummary}
                      </p>
                    )}
                    <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                      الصلاحية: {SHARE_ROLE_LABELS[s.role]}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#062D4C]/10 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => onOpenSharedItem(s)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-lg cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>فتح واستعراض</span>
                    </button>

                    {s.allowCopy && parsed && (
                      <button
                        type="button"
                        onClick={() => void onSaveCopyToMyAccount(s, parsed)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                      >
                        <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>حفظ نسخة</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : outgoingShares.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white/95 dark:bg-slate-900 p-10 text-center space-y-2">
          <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white">
            لم تقم بمشاركة أي محتوى بعد
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            اضغط زر &quot;مشاركة&quot; من أي مسار تعلم، كورس، مسابقة، مشروع، لوحة تعلم، أصل أو ملاحظة مختارة.
          </p>
        </div>
      ) : (
        <div data-testid="outgoing-shares-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {outgoingShares.map((s) => (
            <article
              key={s.id}
              data-testid={`outgoing-share-card-${s.id}`}
              className={`rounded-xl border-2 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4 ${
                s.revoked
                  ? 'border-rose-400 opacity-75 shadow-[0_4px_0_#B92622]'
                  : 'border-[#062D4C] dark:border-slate-600 shadow-[0_4px_0_#062D4C]'
              }`}
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                  <span className="text-[#B92622] dark:text-amber-300">
                    {SHARE_ITEM_TYPE_LABELS[s.itemType]}
                  </span>
                  <span className={s.revoked ? 'text-[#B92622]' : 'text-emerald-700 dark:text-emerald-400'}>
                    {s.revoked ? 'متوقفة' : 'نشطة'}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-[#062D4C] dark:text-white leading-snug">
                  {s.itemTitle}
                </h3>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {s.recipientUsername ? `مشارك مع @${s.recipientUsername}` : `رابط دعوة · رمز: ${s.shareCode}`}
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-[#062D4C]/10 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <select
                    aria-label="تحديث الصلاحية"
                    value={s.role}
                    onChange={(e) =>
                      void onUpdateSharePermissions(s.id, {
                        role: e.target.value as SharePermissionRole,
                      })
                    }
                    className="flex-1 rounded-lg border border-[#062D4C]/25 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-[#062D4C] dark:text-white"
                  >
                    <option value="viewer">عرض فقط (Viewer)</option>
                    <option value="collaborator">متعاون (Collaborator)</option>
                    <option value="owner">مالك مشارك (Owner)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => onOpenSharedItem(s)}
                    className="px-3 py-1.5 text-xs font-extrabold text-white bg-[#062D4C] rounded-lg cursor-pointer"
                  >
                    معاينة
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void onUpdateSharePermissions(s.id, { revoked: !s.revoked })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                  >
                    <ShieldOff className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{s.revoked ? 'إعادة التفعيل' : 'إيقاف المشاركة'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void onDeleteShare(s.id)}
                    aria-label={`حذف مشاركة ${s.itemTitle}`}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-500 hover:text-[#B92622] rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
