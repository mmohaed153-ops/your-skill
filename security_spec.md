# Security Specification — مسار التعلم (Masar Platform)

## Ownership & Access Rules
1. All user-private platform data (`gamification`, `xpTransactions`, `dailyActivities`, `skills`, `quizzes`, `quizAttempts`, `reviewItems`, `certificates`, `favorites`, `practicalProjects`, `notifications`) lives under `/users/{userId}/...`.
   - `allow get`: `isOwner(userId) && isValidId(docId)`
   - `allow list`: `isOwner(userId) && existing().ownerId == request.auth.uid`
   - All client queries filter strictly with `where('ownerId', '==', user.uid)`.
2. **XP Anti-Farming Ledger (`/users/{userId}/xpTransactions/{txId}`)**:
   - Deterministic `txId` equals `rewardKey`.
   - Immutable after creation (`allow update, delete: if false;`), preventing duplicate claims or retroactive point tampering.
3. **Certificates & Verifications**:
   - `/users/{userId}/certificates/{certId}` is owner-only (`allow update: if false;`).
   - `/certificateVerifications/{verificationCode}` is strictly non-PII (`verificationCode`, `ownerId`, `recipientName`, `pathTitle`, `lessonsCount`, `completedAt`, `issuedAt`), allows exact `get` lookup by `isSignedIn() && isValidId(verificationCode)`, and denies listing (`allow list: if false;`).
4. **Leaderboard (`/leaderboard/{userId}`)**:
   - Strictly non-PII (`uid`, `displayName`, `username`, `avatarLetter`, `level`, `totalXp`, `weeklyXp`, `monthlyXp`, `weekKey`, `monthKey`, `currentStreak`, `badgesCount`, `updatedAt`). Never stores emails, phone numbers, or private tokens.
   - `allow get, list: if isSignedIn();`
   - `allow create, update, delete: if isOwner(userId);`
5. **Interactive Quizzes & Smart Review**:
   - `/users/{userId}/quizAttempts/{attemptId}` is append-only (`allow update: if false;`).
   - `/users/{userId}/reviewItems/{reviewId}` tracks only actual missed quiz questions with validated `wrongCount`/`correctCount`/`mastered` state.
6. **Practical Projects (`/users/{userId}/practicalProjects/{projectId}`)**:
   - Files attached to Practical Projects store binary chunks in `/users/{userId}/fileBlobs/{blobId}` using the same owner-only chunked rules.
