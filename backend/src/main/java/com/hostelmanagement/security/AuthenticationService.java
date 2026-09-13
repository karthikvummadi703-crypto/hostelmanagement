package com.hostelmanagement.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class AuthenticationService {

    public UserRecord verifyToken(String idToken) throws Exception {
        var decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);
        return FirebaseAuth.getInstance().getUser(decodedToken.getUid());
    }

    public void setUserRole(String uid, String role) throws Exception {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", role);
        FirebaseAuth.getInstance().setCustomUserClaims(uid, claims);
    }
}
