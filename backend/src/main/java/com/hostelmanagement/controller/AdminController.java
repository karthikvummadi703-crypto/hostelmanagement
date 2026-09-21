package com.hostelmanagement.controller;

import com.hostelmanagement.model.Admin;
import com.hostelmanagement.service.AdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admins")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping
    public ResponseEntity<List<Admin>> getAllAdmins() throws Exception {
        return ResponseEntity.ok(adminService.getAllAdmins());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Admin> getAdminById(@PathVariable String id) throws Exception {
        Admin admin = adminService.getAdminById(id);
        if (admin == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(admin);
    }

    @PostMapping
    public ResponseEntity<String> saveAdmin(@RequestBody Admin admin) throws Exception {
        String id = adminService.saveAdmin(admin);
        return ResponseEntity.ok(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAdmin(@PathVariable String id) throws Exception {
        adminService.deleteAdmin(id);
        return ResponseEntity.noContent().build();
    }
}
