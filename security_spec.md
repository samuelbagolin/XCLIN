# Security Specification for XCLIN

## Data Invariants
- Every document must have a `clinicId` (except possibly the `clinics` collection itself which is the root, but I structured it as `/clinics/{clinicId}`).
- Users can only access data belonging to their `clinicId`.
- Only `clinic_admin` role can manage users and financial data.
- Medical records are sensitive and primarily managed by `professionals` and `clinic_admins`.

## The "Dirty Dozen" Payloads
1. Attempt to create a user profile for a different clinic.
2. Attempt to read a patient from another clinic.
3. Attempt to update another user's role (escalation).
4. Attempt to create an appointment without a valid professional ID.
5. Attempt to delete a medical record (immutability).
6. Attempt to modify `ownerId` of a clinic.
7. Attempt to read financial transactions as a `professional` or `patient`.
8. Attempt to create a clinic document with a spoofed `ownerId`.
9. Attempt to inject a massive string into a patient's name.
10. Attempt to update `updatedAt` with a client-provided timestamp.
11. Attempt to list all clinics without being an owner.
12. Attempt to create a medical record for a patient in a different clinic.

## Test Runner (Simplified for brevity, but identifying key checks)
- Verify `allow list` on `/patients` rejects queries WITHOUT `clinicId` filter or unauthorized access.
- Verify `isValidUserProfile` blocks `role` changes unless by clinic_admin.
