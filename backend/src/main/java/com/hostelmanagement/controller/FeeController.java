package com.hostelmanagement.controller;

import com.hostelmanagement.model.Fee;
import com.hostelmanagement.service.FeeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fees")
public class FeeController {

    private final FeeService feeService;

    public FeeController(FeeService feeService) {
        this.feeService = feeService;
    }

    @GetMapping
    public ResponseEntity<List<Fee>> getFees(
            @RequestParam(required = false) String studentId,
            @RequestParam(required = false) String hostelId) throws Exception {

        if (studentId != null && !studentId.isEmpty()) {
            return ResponseEntity.ok(feeService.getFeesByStudent(studentId));
        }
        if (hostelId != null && !hostelId.isEmpty()) {
            return ResponseEntity.ok(feeService.getFeesByHostel(hostelId));
        }
        return ResponseEntity.badRequest().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Fee> getFeeById(@PathVariable String id) throws Exception {
        Fee fee = feeService.getFeeById(id);
        if (fee == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(fee);
    }

    @PostMapping("/finalize")
    public ResponseEntity<Void> finalizeMonthFees(
            @RequestParam String hostelId,
            @RequestParam String monthKey) throws Exception {
        feeService.finalizeMonthFees(hostelId, monthKey);
        return ResponseEntity.ok().build();
    }

    @PostMapping
    public ResponseEntity<String> saveFee(@RequestBody Fee fee) throws Exception {
        String id = feeService.saveFee(fee);
        return ResponseEntity.ok(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFee(@PathVariable String id) throws Exception {
        feeService.deleteFee(id);
        return ResponseEntity.noContent().build();
    }
}
