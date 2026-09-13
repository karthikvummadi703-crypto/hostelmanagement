package com.hostelmanagement.controller;

import com.hostelmanagement.model.Complaint;
import com.hostelmanagement.service.ComplaintService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/complaints")
@CrossOrigin(origins = "*")
public class ComplaintController {

    private final ComplaintService complaintService;

    public ComplaintController(ComplaintService complaintService) {
        this.complaintService = complaintService;
    }

    @GetMapping
    public ResponseEntity<List<Complaint>> getComplaints(
            @RequestParam(required = false) String studentId,
            @RequestParam(required = false) String hostelId) throws Exception {

        if (studentId != null && !studentId.isEmpty()) {
            return ResponseEntity.ok(complaintService.getComplaintsByStudent(studentId));
        }
        if (hostelId != null && !hostelId.isEmpty()) {
            return ResponseEntity.ok(complaintService.getComplaintsByHostel(hostelId));
        }
        return ResponseEntity.badRequest().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Complaint> getComplaintById(@PathVariable String id) throws Exception {
        Complaint complaint = complaintService.getComplaintById(id);
        if (complaint == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(complaint);
    }

    @PostMapping
    public ResponseEntity<String> saveComplaint(@RequestBody Complaint complaint) throws Exception {
        String id = complaintService.saveComplaint(complaint);
        return ResponseEntity.ok(id);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Void> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> payload) throws Exception {
        String status = payload.get("status");
        String remarks = payload.get("adminRemarks");
        complaintService.updateStatus(id, status, remarks);
        return ResponseEntity.ok().build();
    }
}
