# Kith Studio — Firestore Security Specification

## 1. Data Invariants
1. Every document in `/users/{userId}` and its subcollections (`/companions/{companionId}`, `/journals/{entryId}`, `/stories/{storyId}`, `/activity/{logId}`) is strictly owned by `request.auth.uid == userId` with verified email (`request.auth.token.email_verified == true`).
2. `ownerId` (or `uid` on `/users/{userId}`) is immutable after creation and must equal `request.auth.uid`.
3. `createdAt` is immutable after creation and must equal `request.time` on creation; `updatedAt` must equal `request.time` on creation and update.
4. All document IDs (`userId`, `companionId`, `entryId`, `storyId`, `logId`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
5. No shadow/ghost fields: every write validates exact required and allowed keys via `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update.
6. All strings enforce `.size()` bounds and arrays enforce `.size() <= 10` plus element type validation.

## 2. The "Dirty Dozen" Attack Payloads
1. **Cross-user read/write**: User B attempts to read or write `/users/userA/companions/default`. -> `PERMISSION_DENIED`.
2. **Unverified email write**: Signed-in user with `email_verified: false` attempts to write `/users/{uid}`. -> `PERMISSION_DENIED`.
3. **Identity spoofing**: User A sets `ownerId: "userB"` inside `/users/userA/journals/j1`. -> `PERMISSION_DENIED`.
4. **Shadow field injection**: User A adds `"isAdmin": true` or `"role": "moderator"` to `/users/userA`. -> `PERMISSION_DENIED`.
5. **Immutable field mutation**: User A attempts to alter `createdAt` or `ownerId` on an existing `JournalEntry`. -> `PERMISSION_DENIED`.
6. **Client-forged timestamp**: User A sends a future `updatedAt` timestamp instead of `request.time`. -> `PERMISSION_DENIED`.
7. **ID poisoning**: User A attempts to create a journal entry with a 500-character or slash-containing ID. -> `PERMISSION_DENIED`.
8. **Invalid enum value**: User A sets `archetype: "malicious_mode"` or `ageTier: "bypass"`. -> `PERMISSION_DENIED`.
9. **Out-of-bounds slider integer**: User A sets `decadeStage: 99` or `coatLayering: 5000`. -> `PERMISSION_DENIED`.
10. **Unbounded array / non-string array element**: User A sets `nicknames` with 25 items or a numeric first item. -> `PERMISSION_DENIED`.
11. **Oversized content payload (Denial of Wallet)**: User A submits a 100KB `primaryName` or `title` exceeding field bounds. -> `PERMISSION_DENIED`.
12. **Blanket list scraping**: User B calls `list` on `/users/userA/journals`. -> `PERMISSION_DENIED`.
