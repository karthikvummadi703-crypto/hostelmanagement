package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Payment;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class PaymentService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "payments";

    public PaymentService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Payment getPaymentById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        return doc.exists() ? doc.toObject(Payment.class) : null;
    }

    public List<Payment> getPaymentsByStudent(String studentId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("studentId", studentId)
                .get().get();
        List<Payment> list = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            list.add(doc.toObject(Payment.class));
        }
        return list;
    }

    public List<Payment> getPaymentsByHostel(String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        List<Payment> list = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            list.add(doc.toObject(Payment.class));
        }
        return list;
    }

    public String savePayment(Payment payment) throws Exception {
        if (payment.getId() == null || payment.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            payment.setId(docRef.getId());
        }
        if (payment.getDate() == null) {
            payment.setDate(System.currentTimeMillis());
        }
        firestore.collection(COLLECTION_NAME).document(payment.getId()).set(payment).get();
        return payment.getId();
    }
}
