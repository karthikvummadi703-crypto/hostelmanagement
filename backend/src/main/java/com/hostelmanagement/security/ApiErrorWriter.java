package com.hostelmanagement.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Single, shared JSON error writer so security filter chain and token filter
 * produce identical error bodies.
 */
public final class ApiErrorWriter {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private ApiErrorWriter() {
    }

    public static void write(HttpServletResponse response, int status, String error, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status);
        body.put("error", error);
        body.put("message", message);

        response.getWriter().write(OBJECT_MAPPER.writeValueAsString(body));
    }
}