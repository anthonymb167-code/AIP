// Security specification verification matrix for Kith Studio Firestore rules.
// Evaluates the Dirty Dozen adversarial payloads against DRAFT_firestore.rules / firestore.rules invariants.

export interface SecurityTestCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payloadSummary: string;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Cross-user companion access',
    collectionPath: '/users/userA/companions/default',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'User B (uid=userB) reads /users/userA/companions/default'
  },
  {
    id: 2,
    name: 'Unverified email write',
    collectionPath: '/users/userA',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'Auth token has email_verified: false'
  },
  {
    id: 3,
    name: 'Owner identity spoofing on journal create',
    collectionPath: '/users/userA/journals/entry1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'ownerId set to userB while authenticated as userA'
  },
  {
    id: 4,
    name: 'Shadow field injection on user profile',
    collectionPath: '/users/userA',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'Extra field isAdmin: true included in profile payload'
  },
  {
    id: 5,
    name: 'Immutable createdAt tampering on update',
    collectionPath: '/users/userA/journals/entry1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'createdAt included in affectedKeys on update'
  },
  {
    id: 6,
    name: 'Client-forged updatedAt timestamp',
    collectionPath: '/users/userA/companions/default',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'updatedAt != request.time'
  },
  {
    id: 7,
    name: 'Document ID poisoning (>128 chars)',
    collectionPath: '/users/userA/journals/' + 'a'.repeat(160),
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'isValidId(entryId) rejects >128 char IDs'
  },
  {
    id: 8,
    name: 'Invalid archetype enum injection',
    collectionPath: '/users/userA/companions/default',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'archetype set to invalid_archetype'
  },
  {
    id: 9,
    name: 'Out-of-range slider integer',
    collectionPath: '/users/userA/companions/default',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'coatLayering set to 9999 (exceeds 0..100)'
  },
  {
    id: 10,
    name: 'Unbounded nicknames array (>10 items)',
    collectionPath: '/users/userA/companions/default',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'nicknames array contains 15 items or non-string first element'
  },
  {
    id: 11,
    name: 'Oversized primaryName field',
    collectionPath: '/users/userA/companions/default',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'primaryName length 500 exceeds 48 char limit'
  },
  {
    id: 12,
    name: 'Cross-user journal list query',
    collectionPath: '/users/userA/journals',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payloadSummary: 'User B queries /users/userA/journals'
  }
];
