package com.hostelmanagement.controller;

import com.hostelmanagement.model.Allotment;
import com.hostelmanagement.service.AllotmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/allotments")
public class AllotmentController {

    private final AllotmentService allotmentService;

    public AllotmentController(AllotmentService allotmentService) {
        this.allotmentService = allotmentService;
    }

    @GetMapping
    public ResponseEntity<List<Allotment>> getAllotmentsByHostel(
            @RequestParam String hostelId) throws Exception {
        return ResponseEntity.ok(allotmentService.getAllotmentsByHostel(hostelId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Allotment> getAllotmentById(@PathVariable String id) throws Exception {
        Allotment allotment = allotmentService.getAllotmentById(id);
        if (allotment == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(allotment);
    }

    @PostMapping
    public ResponseEntity<String> saveAllotment(@RequestBody Allotment allotment) throws Exception {
        String id = allotmentService.saveAllotment(allotment);
        return ResponseEntity.ok(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAllotment(@PathVariable String id) throws Exception {
        allotmentService.deleteAllotment(id);
        return ResponseEntity.noContent().build();
    }
}
