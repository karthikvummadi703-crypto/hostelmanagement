package com.hostelmanagement.controller;

import com.hostelmanagement.model.Payment;
import com.hostelmanagement.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping
    public ResponseEntity<List<Payment>> getPayments(
            @RequestParam(required = false) String studentId,
            @RequestParam(required = false) String hostelId) throws Exception {

        if (studentId != null && !studentId.isEmpty()) {
            return ResponseEntity.ok(paymentService.getPaymentsByStudent(studentId));
        }
        if (hostelId != null && !hostelId.isEmpty()) {
            return ResponseEntity.ok(paymentService.getPaymentsByHostel(hostelId));
        }
        return ResponseEntity.badRequest().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Payment> getPaymentById(@PathVariable String id) throws Exception {
        Payment payment = paymentService.getPaymentById(id);
        if (payment == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(payment);
    }

    @PostMapping
    public ResponseEntity<String> savePayment(@RequestBody Payment payment) throws Exception {
        String id = paymentService.savePayment(payment);
        return ResponseEntity.ok(id);
    }
}
