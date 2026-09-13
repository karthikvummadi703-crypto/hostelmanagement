package com.hostelmanagement;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class HostelManagementApplication {

    public static void main(String[] args) {
        SpringApplication.run(HostelManagementApplication.class, args);
        System.out.println("=================================================");
        System.out.println("🚀 Hostel Management Java Spring Boot Backend Started!");
        System.out.println("🌐 Server running on http://localhost:8080");
        System.out.println("=================================================");
    }
}
