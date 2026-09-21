package com.hostelmanagement.security;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves the role and hostel (tenant) of a Firebase Auth user from their
 * Firestore profile. The admin profile at {@code admins/{uid}} is the single
 * source of truth; if absent the student profile at {@code students/{uid}} is
 * used. Results are cached briefly so per-request tenant enforcement does not
 * hammer Firestore.
 */
@Service
public class UserProfileService {

    private static final Logger log = LoggerFactory.getLogger(UserProfileService.class);

    private static final long CACHE_TTL_MS = 60_000L;

    private final Firestore firestore;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public UserProfileService(Firestore firestore) {
        this.firestore = firestore;
    }

    public AuthenticatedUser resolve(String uid, String email) throws Exception {
        long now = System.currentTimeMillis();
        CacheEntry entry = cache.get(uid);
        if (entry != null && now - entry.lookupAt < CACHE_TTL_MS) {
            return entry.user;
        }

        AuthenticatedUser user = loadFromFirestore(uid, email);
        cache.put(uid, new CacheEntry(user, now));
        return user;
    }

    private AuthenticatedUser loadFromFirestore(String uid, String email) throws Exception {
        DocumentSnapshot adminDoc = firestore.collection("admins").document(uid).get().get();
        if (adminDoc.exists()) {
            Map<String, Object> data = adminDoc.getData();
            String hostelId = firstNonBlank(data.get("hostelId"), data.get("hostelid"));
            String role = firstNonBlank(data.get("role"), "admin");
            return new AuthenticatedUser(uid, email, role, hostelId);
        }

        DocumentSnapshot studentDoc = firestore.collection("students").document(uid).get().get();
        if (studentDoc.exists()) {
            Map<String, Object> data = studentDoc.getData();
            String hostelId = firstNonBlank(data.get("hostelId"), null);
            return new AuthenticatedUser(uid, email, "student", hostelId);
        }

        // Account exists in Firebase Auth but has no profile document, so it is
        // not provisioned for any hostel. Tenant-scoped requests must be denied.
        log.debug("Firebase user {} has no admins/students profile; treating as unprovisioned", uid);
        return new AuthenticatedUser(uid, email, "STUDENT", null);
    }

    private static String firstNonBlank(Object value, Object fallback) {
        if (value instanceof String s && !s.isBlank()) {
            return s;
        }
        if (fallback instanceof String s && !s.isBlank()) {
            return s;
        }
        return null;
    }

    private record CacheEntry(AuthenticatedUser user, long lookupAt) {
    }
}