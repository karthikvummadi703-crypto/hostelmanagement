package com.hostelmanagement.config;

import com.hostelmanagement.security.ApiErrorWriter;
import com.hostelmanagement.security.FirebaseTokenFilter;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final FirebaseTokenFilter firebaseTokenFilter;

    /**
     * Comma-separated list of allowed frontend origins. Defaults to the local
     * development origin when the property is not supplied. This replaces the
     * previous hard-coded wildcard "*" so credentialed requests are restricted
     * to trusted origins.
     */
    @Value("${cors.allowed-origins:http://localhost:5500,http://127.0.0.1:5500}")
    private String allowedOrigins;

    public SecurityConfig(FirebaseTokenFilter firebaseTokenFilter) {
        this.firebaseTokenFilter = firebaseTokenFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) ->
                    ApiErrorWriter.write(response, HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized",
                        "Authentication required. Provide a valid Firebase ID token in the Authorization header."))
                .accessDeniedHandler((request, response, accessDeniedException) ->
                    ApiErrorWriter.write(response, HttpServletResponse.SC_FORBIDDEN, "Forbidden",
                        "You do not have permission to access this resource."))
            )
            .authorizeHttpRequests(auth -> auth
                // Allow CORS preflight requests without authentication.
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Public endpoints: health/root, error dispatch and actuator probes.
                .requestMatchers("/", "/error", "/actuator/**").permitAll()
                // Everything else (including all /api/** endpoints) requires a
                // successfully verified Firebase ID token.
                .anyRequest().authenticated()
            )
            .addFilterBefore(firebaseTokenFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();
        configuration.setAllowedOriginPatterns(origins.isEmpty() ? List.of("http://localhost:5500") : origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}