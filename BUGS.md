# Bug tracker

Audit of `main` @ `f000987` on 2026-09-23. Every finding has a stable ID; each fix lands as its own commit titled `fix(<module>): <ID> <description>` on branch `fix/bug-audit-2026-09`. Tightly coupled fixes may share a commit and list every ID.

Severity: **C** critical (security or data loss), **H** high, **M** medium, **L** low. Status: `open`, `fixed` (with short SHA), `deferred` (with reason).

Modules: `AUTH` auth transport + team helper + proxy + API routes · `TEAM` teams, members, invites, email, users · `CHAT` channels, messages, reactions · `TKT` tickets, sprints, comments, events, subtasks, links · `NOTIF` mentions, watchers · `FILE` attachments · `BOARD` board config, saved filters, board UI, hotkeys · `BRIEF` briefs, rate limit, LLM, crons · `UI` list/detail/profile/settings/theme/a11y · `INFRA` schema, migrations, tests, CI, lint, config.

## AUTH

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| AUTH-01 | C | `components/ConvexClientProvider.tsx` | Plain `ConvexProvider`; Convex never receives a token | `ConvexProviderWithAuth` + next-auth token hook | fixed | a575995 |
| AUTH-02 | C | `app/api/convex-token/route.ts` | HS256 token Convex cannot verify; dead code | RS256 via `jose`, `sub` = lowercased email, 1h expiry, 401 when signed out | fixed | a575995 |
| AUTH-03 | C | `convex/auth.config.ts` | `providers: []` on localhost; OIDC config with no JWKS | `customJwt` provider + `/.well-known/jwks.json`; fail closed | fixed | a575995 |
| AUTH-04 | C | `convex/teamHelper.ts` | Teamless/anonymous caller handed the first team in the DB | `requireTeam` throws `NO_TEAM`; `optionalTeam` returns null | fixed | 7cdad7c |
| AUTH-05 | C | `convex/teamHelper.ts` + all functions | Client `userEmail` trusted as identity; `'anonymous'` synthesized | Identity only from `ctx.auth`; remove `userEmail` args everywhere | fixed | 7cdad7c |
| AUTH-06 | C | `convex/teamHelper.ts` | `getMembership` auto-heal rewrites `teamMembers.userId` (membership hijack) | Remove auto-heal; `by_team_user` index | fixed | 7cdad7c |
| AUTH-07 | H | `convex/teamHelper.ts` | `requireTeam` inserts a team as a side effect | Remove insert | fixed | 7cdad7c |
| AUTH-08 | H | all Convex functions | Membership never asserted; removed users keep access | `requireTeam` requires a `teamMembers` row | fixed | 7cdad7c |
| AUTH-09 | C | `app/api/send-email/route.ts` | Unauthenticated open mail relay | Delete route | fixed | 480d8eb |
| AUTH-10 | H | `proxy.ts` | Most authenticated routes unprotected; `/settings/board` outside `(app)` | Protect all but public routes; move settings page | fixed | 597d4ba |
| AUTH-11 | M | `auth.ts` | `token.iss` overwritten for no consumer | Drop | fixed | b7dee09 |
| AUTH-12 | M | `convex/teamHelper.ts` | Full `users`/`teamMembers` scans per call | Indexes (INFRA-02) | fixed | 44d153c |
| AUTH-13 | M | `app/(auth)/sign-in/page.tsx`, `app/invite/accept/page.tsx` | `redirect` param dropped | Honour validated relative redirect | fixed | eb5f86b |

## TEAM

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| TEAM-01 | C | `convex/invites.ts`, `app/invite/accept/page.tsx` | `accept` never checks caller is invitee; token never verified; page just redirects | `by_token` index, `acceptByToken` verifies JWT + email match | fixed | cef1445 |
| TEAM-02 | C | `convex/invites.ts` `listForTeam` | Returns full invites incl. `token`, no role check | Owner/admin only; strip token | fixed | cef1445 |
| TEAM-03 | H | `convex/invites.ts` `revoke` | No role check | Owner/admin | fixed | cef1445 |
| TEAM-04 | H | `convex/invites.ts` `send` | Duplicate check not team-scoped | Scope to team | fixed | cef1445 |
| TEAM-05 | H | `convex/invites.ts` `accept` | No duplicate-membership check | No-op if member; set active team | fixed | cef1445 |
| TEAM-06 | H | `convex/invites.ts` | Hardcoded fallback signing secret | Throw when env missing | fixed | cef1445 |
| TEAM-07 | M | `convex/invites.ts` | Expired invites marked `revoked` (and rolled back) | `expired` status via cron | fixed | cef1445 |
| TEAM-08 | M | `convex/invites.ts` | Domain check only at send time | Re-check on accept | fixed | cef1445 |
| TEAM-09 | L | `convex/invites.ts` | Unused `reqUserId`; side-effect `requireTeam` | Clean up | fixed | cef1445 |
| TEAM-10 | H | `convex/teams.ts`, `TeamGuard`, `UserNav` | Single `users.teamId`; second team/invite orphans the first; no switching | Multi-team: active team + `myTeams` + `setActiveTeam` + switcher | fixed | 6b2dd1d |
| TEAM-11 | M | `convex/teams.ts` | Slug uniqueness not enforced | Check + suffix | fixed | 83e32fb |
| TEAM-12 | M | `convex/teams.ts` `update` | Membership lookup misses email-keyed rows | `requireRole` | fixed | 7cdad7c |
| TEAM-13 | H | `convex/teams.ts` `deleteTeam` | Leaves messages, tickets, sprints, comments, events, config, filters, attachments | Paginated cascade | fixed | 997b4e1 |
| TEAM-14 | M | `convex/teams.ts` `deleteTeam` | Unbounded loop in one transaction | Paginate | fixed | 997b4e1 |
| TEAM-15 | M | `convex/teams.ts` `myTeam` | Null-vs-fallback inconsistency | `optionalTeam` | fixed | 7cdad7c |
| TEAM-16 | C | `convex/teamMembers.ts` `listForTeam` | Roster exposed without membership check | Assert membership | fixed | 7cdad7c |
| TEAM-17 | H | `convex/teamMembers.ts` `remove` | Self-removal guard un-normalised | Normalise / compare ids | fixed | 7cdad7c |
| TEAM-18 | H | `convex/teamMembers.ts` `remove` | `users.teamId` not cleared for email-keyed rows | Lookup by canonical id | fixed | d50f087 |
| TEAM-19 | M | `convex/teamMembers.ts` `leave`/`remove` | Not removed from channels/watchers; active team not re-pointed | Cascade + re-point | fixed | d50f087 |
| TEAM-20 | M | `convex/teamMembers.ts` | No `transferOwnership` | Add mutation + UI | fixed | d50f087 |
| TEAM-21 | C | `convex/users.ts` `updateProfile` | Authenticates off `args.userEmail` | `ctx.auth` only | fixed | 7cdad7c |
| TEAM-22 | H | `convex/users.ts` `getProfile` | Raw doc for any id, no team scoping | Shared-team check; whitelist fields | fixed | 6d09b40 |
| TEAM-23 | H | `convex/users.ts` `getByUserId` | Public whole-doc read | Delete/restrict | fixed | 6d09b40 |
| TEAM-24 | M | `convex/users.ts` `me` | No email fallback → "account not found" | Resolve via identity | fixed | 7cdad7c |
| TEAM-25 | H | `convex/users.ts` `upsert` | Keys on `subject ?? email` → duplicates; client overwrites email/name | Key on identity; migration merges | open | |
| TEAM-26 | L | `convex/users.ts` `cleanPatch` | Fields can't be cleared | Accept `null` | fixed | 6d09b40 |
| TEAM-27 | M | `convex/users.ts`, `DiceBearAvatarPicker.tsx` | URL fields unvalidated | Server-side https validation | fixed | 6d09b40 |
| TEAM-28 | H | `convex/email.ts` | Send failures swallowed | Throw; `deliveryStatus` on invite | fixed | 06a1838 |
| TEAM-29 | H | `convex/email.ts` | HTML injection of team name / inviter / ticket title | `escapeHtml` | fixed | 06a1838 |
| TEAM-30 | H | `convex/email.ts` | Assignee string used as recipient (relay) | Resolve via `teamMembers` | fixed | 06a1838 |
| TEAM-31 | M | `convex/email.ts` | Invite JWT in query string | Short-lived, verified (TEAM-01); document | fixed | cef1445 |
| TEAM-32 | L | `convex/email.ts` | "7 days" hardcoded | Derive from constant | fixed | 06a1838 |
| TEAM-33 | L | `convex/email.ts` | Transport per email, no timeout | Module transporter + timeout | fixed | 06a1838 |
| TEAM-34 | L | `convex/email.ts` | Self-assign check uses caller-supplied email | Use identity | fixed | 06a1838 |
| TEAM-35 | H | `convex/email.ts` | Invite link falls back to `http://localhost:3000` | Require `APP_URL`; throw when missing | fixed | 06a1838 |
| TEAM-36 | H | `app/invite/accept/page.tsx` | Wrong Google account → silent failure | `acceptByToken` + mismatch message | fixed | cef1445 |
| TEAM-37 | M | `convex/invites.ts` `accept` | Not added to `#general` | Append to public channels | fixed | cef1445 |
| TEAM-38 | M | `convex/invites.ts` `pendingForMe` | `requireTeam` side effects | `requireAuth` + email match | fixed | 7cdad7c |
| TEAM-39 | M | `TeamSettings.tsx`, `convex/invites.ts` | "Invitation email sent" regardless of delivery | Delivery status + Resend | fixed | 06a1838 |
| TEAM-40 | L | `convex/invites.ts` `accept` | Returns only `teamId` | Return `{teamId, teamName}`; set active | fixed | cef1445 |
| TEAM-41 | M | `components/UserInit.tsx` | `upsert` fires before session, on every change | Run once when authenticated | fixed | 7cdad7c |

## CHAT

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| CHAT-01 | C | `convex/messages.ts` `byChannel`/`threadReplies` | Zero auth | Assert team + `memberIds` | fixed | 99fe331 |
| CHAT-02 | C | `convex/messages.ts` `send` | `authorId` = client display name | Store `userId` | fixed | 7cdad7c |
| CHAT-03 | C | `convex/messages.ts` `send` | No channel/team/membership check | Assert | fixed | 99fe331 |
| CHAT-04 | M | `convex/messages.ts` | `threadRootId` not validated to channel | Assert | fixed | 99fe331 |
| CHAT-05 | M | `convex/messages.ts` | `limit` unbounded | Clamp | fixed | 99fe331 |
| CHAT-06 | M | `convex/messages.ts` | Full `users` scan per fetch | Batch by author id | fixed | 99fe331 |
| CHAT-07 | M | `convex/messages.ts` | No edit/delete | Add gated mutations | fixed | 99fe331 |
| CHAT-08 | H | `convex/channels.ts` `byTeam`/`get` | Private channels visible to non-members | Filter by `memberIds` | fixed | 4cd217d |
| CHAT-09 | H | `convex/channels.ts` `get` | DM guard bypassed on falsy `userId` | Deny | fixed | 7cdad7c |
| CHAT-10 | H | `convex/channels.ts` `openDM` | `dmKey` on mutable id; duplicates; race | Canonical id; backfill; conflict re-check | fixed | 4cd217d |
| CHAT-11 | H | `convex/channels.ts` `create` | No membership/role check; no dedupe; creator-only members | Assert; dedupe; `addMember`/`join` | fixed | 4cd217d |
| CHAT-12 | H | `appendActivityEvent` call sites | Actor/team re-derived → `'anonymous'`/`'unassigned'` | Explicit actor param (TKT-22) | fixed | 326791b |
| CHAT-13 | L | `convex/channels.ts` | Dead code; un-normalised compare | Clean | fixed | 4cd217d |
| CHAT-14 | M | `convex/teams.ts` | `#general` members = creator only | Public channels open; add on accept | fixed | 4cd217d |
| CHAT-15 | H | `convex/reactions.ts` | No auth on `byMessage`/`toggle` | Assert membership via channel | fixed | 76833f5 |
| CHAT-16 | H | `convex/reactions.ts` `toggle` | All users `'anonymous'` → delete each other's reactions | AUTH-05 + test | fixed | 7cdad7c |
| CHAT-17 | M | `convex/reactions.ts`, schema | No uniqueness; duplicates survive toggle | Index + delete all | fixed | 76833f5 |
| CHAT-18 | L | `convex/reactions.ts` | `emoji` arbitrary string | Whitelist | fixed | 76833f5 |
| CHAT-19 | M | `components/chat/ReactionButton.tsx` | `group-hover:` never matches `group/item` → bar invisible | `group-hover/item:` | fixed | 2f016c5 |
| CHAT-20 | M | `components/chat/ChatPane.tsx` | Send failures swallowed | Catch + toast | fixed | 2f016c5 |
| CHAT-21 | L | `components/chat/StartDMButton.tsx` | Silent failure | Toast | fixed | 2f016c5 |
| CHAT-22 | L | `ChatPane.tsx`, `ChatHeader.tsx` | Duplicate `channels.get` subscription | Pass channel | fixed | 2f016c5 |
| CHAT-23 | L | `components/chat/ChatPane.tsx` | Autoscroll while reading history | Only near bottom | fixed | 2f016c5 |
| CHAT-24 | M | `components/CommandPalette.tsx` | DM/channel links go to placeholder page | `/chat/${id}`; `openDM` | fixed | 2f016c5 |
| CHAT-25 | M | `convex/messages.ts` | Mentions never extracted from messages | `extractMentionIds` in `send` | fixed | 99fe331 |

## TKT

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| TKT-01 | C | `convex/tickets.ts` `updateStatus` | No team check | `assertTicketInTeam` | open | |
| TKT-02 | C | `convex/tickets.ts` `update` | Auth only when assignee changes; 3× `requireTeam` | Hoist auth | open | |
| TKT-03 | C | `convex/tickets.ts` `bulk*` | Bypass per-ticket auth/assign rules | Shared assert per id | open | |
| TKT-04 | H | `convex/tickets.ts` `bulkDelete` | Orphans children + blobs | Cascade helper | open | |
| TKT-05 | H | `convex/tickets.ts` `search` | Cross-team; hardcoded project; empty needle leaks | Team filter; `[]` on empty | open | |
| TKT-06 | C | `convex/tickets.ts` attachment URL queries | Unauthenticated signed URLs | Auth + team via attachments row | open | |
| TKT-07 | H | `convex/tickets.ts` `generateUploadUrl` | Unauthenticated | `requireTeam` | open | |
| TKT-08 | H | `convex/tickets.ts`, schema | `!t.teamId` escape hatch; optional string teamId | Backfill; required id; drop hatch | open | |
| TKT-09 | H | `convex/tickets.ts` `nextKey`/`getByKey` | Global counter; `.unique()` can throw | Per-team counter; team-filtered lookup | open | |
| TKT-10 | M | `convex/tickets.ts` | `epicId` cross-team | Assert team | open | |
| TKT-11 | M | `convex/tickets.ts` `update` | Cannot unassign | `null` union | open | |
| TKT-12 | M | `convex/tickets.ts` | `dueThisWeek` includes all overdue | Lower bound | open | |
| TKT-13 | M | `convex/tickets.ts` `mode:'active'` | Returns backlog when no sprint; `.unique()` | `[]`; collect | open | |
| TKT-14 | M | `convex/tickets.ts` `listEpics` | Hardcoded project | Arg | open | |
| TKT-15 | H | `convex/tickets.ts` `create` | `assigneeId` unvalidated → mail relay | Resolve via members | open | |
| TKT-16 | L | `convex/tickets.ts` `touchTicket` | Swallows errors | Log | open | |
| TKT-17 | H | `convex/sprints.ts` `complete` | Rollover target unvalidated | Validate | open | |
| TKT-18 | H | `convex/sprints.ts` | `moveTicket`/`addToActiveSprint` no ticket team check | Assert | open | |
| TKT-19 | M | `convex/sprints.ts` | `plannedPoints` never recomputed | Recompute | open | |
| TKT-20 | M | `convex/sprints.ts` `complete` | Overwrites planned `endDate` | `completedAt` | open | |
| TKT-21 | M | `convex/sprints.ts` | No role check for lifecycle | `requireRole` | open | |
| TKT-22 | M | `convex/events.ts` | Actor re-derived; `'unassigned'` bucket | Explicit params; require team | fixed | 326791b |
| TKT-23 | H | `convex/events.ts` `forTicket` | Whole team history + all users per call | `by_ref` index; paginate | open | |
| TKT-24 | L | `convex/events.ts` | `pageSize` unclamped | Clamp | open | |
| TKT-25 | M | `convex/sprints.ts` | `.unique()` on active sprint | Collect + error | open | |
| TKT-26 | L | `convex/sprints.ts` | `durationDays` unvalidated; ordering inconsistent | Clamp; consistent | open | |
| TKT-27 | C | `convex/comments.ts` `byTicket` | No auth; emails via table scans | Assert; batch | open | |
| TKT-28 | H | `convex/comments.ts` `add` | No team check | Assert | open | |
| TKT-29 | H | `convex/comments.ts` `add` | `authorName` forges authorship | Drop arg | fixed | 7cdad7c |
| TKT-30 | M | `convex/comments.ts` | No edit/delete | Add gated + UI | open | |
| TKT-31 | M | `convex/comments.ts` | Mentioned ids unvalidated (cross-team injection) | Resolve via members | open | |
| TKT-32 | M | `convex/comments.ts` | Watcher + mention double notify | Exclusion set | open | |
| TKT-33 | H | `convex/subtasks.ts` | No parent team check anywhere | Assert | open | |
| TKT-34 | M | `convex/subtasks.ts` `reorder` | Duplicate orders | Persist full order | open | |
| TKT-35 | L | `convex/subtasks.ts` | `rename`/`reorder` no event/touch | Add | open | |
| TKT-36 | H | `convex/ticketLinks.ts` | No team check; leaks foreign ticket doc | Assert both; projection | open | |
| TKT-37 | M | `convex/ticketLinks.ts` | Contradictory mutual links | Reject inverse | open | |
| TKT-38 | M | `convex/ticketLinks.ts` | No cycle detection | Bounded DFS | open | |
| TKT-39 | M | `convex/ticketLinks.ts` `remove` | Anyone deletes any link | Assert | open | |
| TKT-40 | L | `convex/ticketLinks.ts` | Mirror not deduped; `remove` deletes one | Dedupe; delete all | open | |
| TKT-41 | L | `convex/tickets.ts` `update` | Event on every save (`updatedAt`) | Only on real change | open | |

## NOTIF

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| NOTIF-01 | H | `convex/mentions.ts` `markRead` | No ownership check | Assert | open | |
| NOTIF-02 | M | `convex/mentions.ts` | Id cast throws in `Promise.all` | `normalizeId` | open | |
| NOTIF-03 | M | `convex/mentions.ts` `forMe` | Not team-filtered | Filter | open | |
| NOTIF-04 | H | `convex/watchers.ts` | `isWatching` vs `unsubscribe` mismatch → stuck watching | Canonical ids | open | |
| NOTIF-05 | H | `convex/watchers.ts` | No team check; leaks emails | Assert | open | |
| NOTIF-06 | M | `convex/watchers.ts` | Self-notify on id mismatch | Canonical ids | open | |
| NOTIF-07 | M | `convex/watchers.ts` | Unbounded fan-out | Upsert per (user, ticket) | open | |
| NOTIF-08 | M | `convex/tickets.ts` `bulk*` | No notifications | Notify | open | |
| NOTIF-09 | H | dropdown, inbox, links, email | `/board?ticket=KEY` never handled | `/tickets/${key}` | open | |
| NOTIF-10 | M | `NotificationDropdown.tsx`, inbox | Queries before session; no loading state | Skip; skeleton | open | |
| NOTIF-11 | M | `lib/mentions.ts` | Regex excludes `\|`/`:` | Widen; tests | open | |
| NOTIF-12 | L | `lib/mentions.ts` | Code spans extracted; dedupe mismatch | Strip; dedupe | open | |
| NOTIF-13 | M | `convex/tickets.ts` | Description mentions never notify | Extract | open | |

## FILE

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| FILE-01 | H | `convex/attachments.ts` `remove` | No ownership/team check; irreversible | Uploader/admin + team | open | |
| FILE-02 | H | `convex/attachments.ts` `byTicket` | Signed URLs without team check | Assert | open | |
| FILE-03 | M | `convex/attachments.ts` `record` | Trusts storageId/size/mime | `getMetadata`; caps; allow-list | open | |
| FILE-04 | M | schema, `tickets.ts`, `TicketDetailClient.tsx` | Two attachment stores; creation uploads never shown | Migrate to table; drop column; remove dead code | open | |

## BOARD

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| BOARD-01 | H | `convex/boardConfig.ts`, `app/settings/board` | Any member rewrites board; page unguarded | `requireRole`; move page | open | |
| BOARD-02 | M | `convex/boardConfig.ts` | Columns/labels unvalidated | Literal unions | open | |
| BOARD-03 | M | `boardConfig` + `BoardClient.tsx` | WIP limits advisory | Enforce server-side; block drop | open | |
| BOARD-04 | L | `convex/boardConfig.ts` | `.first()` for one-row table | `.unique()` | open | |
| BOARD-05 | M | `convex/savedFilters.ts` | Owner check on unstable id | Canonical ids | open | |
| BOARD-06 | M | `convex/savedFilters.ts` | Personal filters not team-scoped | Filter | open | |
| BOARD-07 | L | `convex/savedFilters.ts` | Empty name; no cap; no update | Validate; cap; `update` | open | |
| BOARD-08 | M | `SavedFiltersDropdown.tsx` | All users share `'anonymous'` filters | AUTH-05 | fixed | 7cdad7c |
| BOARD-09 | L | `SavedFiltersDropdown.tsx` | Order-sensitive active detection | Sorted compare | open | |
| BOARD-10 | M | `BoardClient.tsx` | Sprint scope not in URL | Query string | open | |
| BOARD-11 | M | `BoardClient.tsx` | Drop to Unassigned sends `undefined` | `null` | open | |
| BOARD-12 | M | `BoardClient.tsx` | Optimistic override cleared early | Clear on data | open | |
| BOARD-13 | M | `TicketCard.tsx` | Subscription per card | Board-level query | open | |
| BOARD-14 | M | `BoardFilters.tsx`, `FilterBar.tsx` | Router push per keystroke | Debounce + replace | open | |
| BOARD-15 | L | `BoardFilters.tsx` | Clear wipes `lanes` | Targeted delete | open | |
| BOARD-16 | L | `BoardWithSwimlanes.tsx` | Unknown priority dropped | "Other" lane | open | |
| BOARD-17 | M | palette, swimlanes, bulk bar | Team queries with `{}` | AUTH-04/05 | fixed | 7cdad7c |
| BOARD-18 | M | `lib/hotkeys.tsx` | Escape spec never matches | Normalise spec | open | |
| BOARD-19 | H | `lib/hotkeys.tsx` | Hotkeys fire on focused button/link/select | Extend typing context | open | |
| BOARD-20 | L | `lib/hotkeys.tsx` | Ref written during render | Effect | open | |
| BOARD-21 | L | `lib/hotkeys.tsx` | App-wide re-render per hotkey | Ref bindings | open | |
| BOARD-22 | L | `BulkActionBar.tsx` | Selection not cleared | `onClear` | open | |
| BOARD-23 | M | `TicketCard.tsx` | Drag listeners wrap links | Drag handle | open | |
| BOARD-24 | L | `SprintProgress.tsx` | >100 % | Clamp | open | |

## BRIEF

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| BRIEF-01 | C | `briefActions.ts`, `ProviderComparison.tsx`, home page | Public action with any `userId` + `skipRateLimit`; dev UI in prod | `internalAction`; remove flag + component | open | |
| BRIEF-02 | H | `brief.ts`, `briefActions.ts` | All users → `'dev-user'` | `requireAuth` | fixed | 7cdad7c |
| BRIEF-03 | H | `brief.ts` `readContext` | Others' DMs fed into brief | Filter by membership | open | |
| BRIEF-04 | H | `lib/llm/anthropic.ts`, `google.ts` | Fabricated prose on missing key / error | Throw; `LLM_MOCK` only | open | |
| BRIEF-05 | H | `brief.ts`, `crons.ts` | No try/catch in cron loop; interval drift | Per-user catch; hourly cron; idempotent | open | |
| BRIEF-06 | H | `brief.ts` | Fragile hour parse; invalid tz throws | `formatToParts`; validate tz | open | |
| BRIEF-07 | M | `brief.ts`, `briefActions.ts` | `en-CA` split date | Shared helper | open | |
| BRIEF-08 | H | `brief.ts` vs `events.ts` | Mismatched sentinels; cross-team feed | Require team | open | |
| BRIEF-09 | M | `brief.ts` | Rolling 24h window | tz-local window | open | |
| BRIEF-10 | M | `brief.ts` | Misses email-assigned tickets | Canonical ids | open | |
| BRIEF-11 | M | `brief.ts` `todayForMe` | No email fallback | `requireUser` | open | |
| BRIEF-12 | L | `brief.ts`, `briefActions.ts` | Duplicate `hourlyTick` | Delete | open | |
| BRIEF-13 | M | `rateLimit.ts` | Keyed on caller id; first call bypasses | Identity key; evaluate first call | open | |
| BRIEF-14 | M | `rateLimit.ts`, `briefActions.ts` | Quota consumed before success | Record after / refund | open | |
| BRIEF-15 | L | `rateLimit.ts` | Sorted-history assumption | `Math.min` | open | |
| BRIEF-16 | M | `briefActions.ts` | Wrong `providerUsed` default | Return from `summarize` | open | |
| BRIEF-17 | M | `lib/llm/index.ts` | Unknown provider → Anthropic | Throw; validate | open | |
| BRIEF-18 | M | `lib/llm/types.ts` | `cacheKey` unused | Remove | open | |
| BRIEF-19 | M | `lib/llm/index.ts` | No timeout | `AbortSignal.timeout` | open | |
| BRIEF-20 | M | `lib/llm/anthropic.ts` | Stale models; inert header; `stop_reason`; empty content | Update; guard | open | |
| BRIEF-21 | M | `lib/llm/google.ts` | Quota code not retried; same-model fallback; no system role | Fix | open | |
| BRIEF-22 | L | both providers | Sleep after final retry | Guard | open | |
| BRIEF-23 | L | `briefActions.ts` | Errors flattened, unlogged | Log | open | |
| BRIEF-24 | M | `briefActions.test.ts` | 5 s timeout | `testTimeout` + mocks | open | |

## UI

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| UI-01 | M | `TicketsListClient.tsx` | Sort mixes types; lexical keys | Comparators | open | |
| UI-02 | M | `TicketRow.tsx` | Shift-range select dead | `onClick` | open | |
| UI-03 | M | `TicketsListClient.tsx` | No loading state | Skeleton | open | |
| UI-04 | L | `FilterBar.tsx` | `assignee` param has no control | Add select | open | |
| UI-05 | L | `TicketsListClient.tsx` | Select-all vs stale selection | Intersect | open | |
| UI-06 | M | `TicketDetailClient.tsx` | Unawaited mutations | try/catch + toast | open | |
| UI-07 | M | `DescriptionEditor.tsx`, `BacklogTicketRow.tsx` | State never re-syncs | Reset when clean | open | |
| UI-08 | M | `MentionAutocomplete.tsx` | Mouse-only; no ARIA; covers text | Keyboard + ARIA + caret | open | |
| UI-09 | L | `WatchButton.tsx` | Toggle before load | Disable | open | |
| UI-10 | L | `SubtaskChecklist.tsx` | `onCountChange` never called | Call | open | |
| UI-11 | H | `TeamSettings.tsx` | Delete button shown to non-owners while loading | Gate on loaded | open | |
| UI-12 | L | `app/settings/board/page.tsx` | Effect clobbers edits | Seed once | open | |
| UI-13 | L | `OnboardingClient.tsx` | `creating` never reset | Finally | open | |
| UI-14 | M | `RichTextEditor.tsx` | Hardcoded dark colours | Tokens | open | |
| UI-15 | L | privacy/terms pages | Forced dark bg | Tokens | open | |
| UI-16 | L | `RichTextEditor.tsx` vs `DescriptionEditor.tsx` | Two markdown renderers | Standardise | open | |
| UI-17 | L | `CommentThread.tsx`, `RichTextEditor.tsx` | Duplicate keys | Composite keys | open | |
| UI-18 | M | `BacklogClient.tsx` | Loads whole project | Server filter | open | |
| UI-19 | L | `EpicPill.tsx` | Whole project per pill | `getById` | open | |
| UI-20 | L | `lib/utils.ts` | `parseConvexError` truncates / leaks prefix | Handle data objects | open | |
| UI-21 | M | `lib/renderEvent.ts` | First field only; missing kinds; dead branches | List fields; add cases | open | |

## INFRA

| ID | Sev | Location | Bug | Fix | Status | Commit |
|---|---|---|---|---|---|---|
| INFRA-01 | — | repo root | No bug tracker | This file | fixed | 6b2ec9c |
| INFRA-02 | M | `convex/schema.ts` | Missing indexes; string teamIds | Add indexes; `v.id('teams')` | open | |
| INFRA-03 | M | `convex/migrations.ts` | Unpaginated; no id canonicalisation / backfills | Paginated migrations | open | |
| INFRA-04 | H | `.github/workflows/e2e.yml`, `playwright.config.ts` | No `e2e/`; missing `AUTH_URL`; fork secrets | Smoke spec; env; fork guard; artifacts | open | |
| INFRA-05 | M | `vitest.config.ts` | Single edge env; 5 s timeout | Projects; timeout | open | |
| INFRA-06 | M | eslint | 152 errors | Fix; lint in CI | open | |
| INFRA-07 | M | `convex/teams.test.ts` | Isolation test proves nothing | Same project; assert 0 | open | |
| INFRA-08 | H | `convex/*.test.ts` | No negative auth tests | `authorization.test.ts` | open | |
| INFRA-09 | M | `lib/llm/index.test.ts` | Providers fully mocked | Failure-path tests | open | |
| INFRA-10 | L | `next.config.ts` | No security headers / remote patterns | Add | open | |
| INFRA-11 | L | `README.md` | Template; no env docs | Document env + dev JWKS caveat | open | |
