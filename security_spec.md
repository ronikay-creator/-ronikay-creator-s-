# Security Specification

## 1. Data Invariants
- All documents (subjects, students, journal_entries, attendance, assessments) MUST belong to a specific user (`userId`).
- A user can only read and write documents where `userId` matches their `auth.uid`.
- Sensitive data like student NISN and names must be protected.
- Updates must only change allowed fields.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

Attempting to bypass security with these payloads should result in `PERMISSION_DENIED`.

1. **Identity Spoofing (Create)**: Create a student with someone else's `userId`.
   `{ "name": "Hack", "class": "10A", "userId": "another_user_id" }`
2. **Identity Spoofing (Update)**: Update a student's `userId` to gain ownership of someone else's data.
   `{ "userId": "attacker_id" }`
3. **Blanket Read**: Attempting to list all students without a `userId` filter.
   `query(collection(db, "students"))`
4. **ID Poisoning**: Creating a subject with a 2MB string as ID.
5. **Type Poisoning**: Sending a string for a score field.
   `{ "score": "ninety" }`
6. **Boundary Violation**: Sending a score of 150.
7. **Shadow Update**: Adding an `isAdmin` field to a user profile.
8. **Relational Sync Break**: Creating an attendance record for a student that doesn't exist.
9. **PII Leak**: A user attempting to `get()` a student profile belonging to another teacher.
10. **State Shortcutting**: Updating a final grade after it has been locked.
11. **Timestamp Spoofing**: Sending a client-side timestamp for `updatedAt`.
12. **Unauthorized Delete**: Deleting a subject created by another teacher.

## 3. Test Runner (Draft)

A `firestore.rules.test.ts` will be implemented to verify these constraints.
