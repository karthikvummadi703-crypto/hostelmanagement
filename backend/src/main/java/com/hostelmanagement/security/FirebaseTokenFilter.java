package com.hostelmanagement.security;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class FirebaseTokenFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(FirebaseTokenFilter.class);

    private final UserProfileService userProfileService;

    public FirebaseTokenFilter(UserProfileService userProfileService) {
        this.userProfileService = userProfileService;
    }

    /**
     * CORS preflight requests never carry an Authorization header, so they must
     * bypass token verification and be handled by the CORS configuration.
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")) {
            String idToken = header.substring(7);
            try {
                FirebaseToken decodedToken = FirebaseAuth.getInstance().verifyIdToken(idToken);
                AuthenticatedUser user = userProfileService.resolve(decodedToken.getUid(), decodedToken.getEmail());

                String role = (user.role() != null && !user.role().isBlank()) ? user.role() : "STUDENT";
                List<SimpleGrantedAuthority> authorities =
                        List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()));

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(user, null, authorities);
                SecurityContextHolder.getContext().setAuthentication(authentication);

                // Tenant isolation: requests that address a specific hostelId are
                // only valid when that hostel is the caller's own.
                if (!isOwnHostelRequest(request, user)) {
                    ApiErrorWriter.write(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden",
                            "Access denied: resource belongs to a different hostel.");
                    return;
                }
            } catch (Exception e) {
                // Token invalid, user unverified, or profile lookup failed; clear
                // security context so the request continues unauthenticated and is
                // rejected by the security filter chain with a JSON 401. Never log
                // the raw token or its contents.
                log.debug("Rejected Firebase ID token: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isOwnHostelRequest(HttpServletRequest request, AuthenticatedUser user) {
        String requestedHostelId = request.getParameter("hostelId");
        if (requestedHostelId == null || requestedHostelId.isEmpty()) {
            return true;
        }
        return user.hostelId() != null && user.hostelId().equals(requestedHostelId);
    }
}