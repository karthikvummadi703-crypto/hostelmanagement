package com.hostelmanagement.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${firebase.config.path:serviceAccountKey.json}")
    private String firebaseConfigPath;

    @Value("${firebase.project.id:hostelmanagement-app}")
    private String projectId;

    @Bean
    public FirebaseApp firebaseApp() {
        if (!FirebaseApp.getApps().isEmpty()) {
            return FirebaseApp.getInstance();
        }

        FirebaseOptions options;
        try (InputStream serviceAccount = openCredentialsStream()) {
            options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .setProjectId(projectId)
                    .build();
        } catch (Exception e) {
            log.warn("Service account key not found at '{}'; falling back to Application Default Credentials: {}",
                    firebaseConfigPath, e.getMessage());
            options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.newBuilder().build())
                    .setProjectId(projectId)
                    .build();
        }

        return FirebaseApp.initializeApp(options);
    }

    private InputStream openCredentialsStream() throws IOException {
        if (firebaseConfigPath != null && firebaseConfigPath.startsWith("classpath:")) {
            return new ClassPathResource(firebaseConfigPath.substring("classpath:".length())).getInputStream();
        }
        return new FileInputStream(firebaseConfigPath);
    }

    @Bean
    public Firestore firestore(FirebaseApp firebaseApp) {
        return FirestoreClient.getFirestore(firebaseApp);
    }
}