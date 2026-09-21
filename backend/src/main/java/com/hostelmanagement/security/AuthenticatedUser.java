package com.hostelmanagement.security;

/**
 * The authenticated caller as resolved from their Firestore profile.
 *
 * @param uid      Firebase Authentication user id
 * @param email    verified email address, if any
 * @param role     'admin' for management profiles, 'student' for residents
 * @param hostelId tenant this account belongs to; {@code null} when the
 *                 account has no provisioned profile
 */
public record AuthenticatedUser(String uid, String email, String role, String hostelId) {
}