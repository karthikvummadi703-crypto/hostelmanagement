package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Fee;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class FeeService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "fees";

    public FeeService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Fee getFeeById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        return doc.exists() ? doc.toObject(Fee.class) : null;
    }

    public List<Fee> getFeesByStudent(String studentId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("studentId", studentId)
                .get().get();
        List<Fee> fees = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            fees.add(doc.toObject(Fee.class));
        }
        return fees;
    }

    public List<Fee> getFeesByHostel(String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        List<Fee> fees = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            fees.add(doc.toObject(Fee.class));
        }
        return fees;
    }

    public void finalizeMonthFees(String hostelId, String monthKey) throws Exception {
        String cleanMonthKey = monthKey.replace("-", "_");
        var docRef = firestore.collection("monthlyFinalizations").document(hostelId + "_" + cleanMonthKey);
        java.util.Map<String, Object> map = new java.util.HashMap<>();
        map.put("id", hostelId + "_" + cleanMonthKey);
        map.put("hostelId", hostelId);
        map.put("monthKey", cleanMonthKey);
        map.put("isFinalized", true);
        map.put("finalizedAt", com.google.cloud.firestore.FieldValue.serverTimestamp());
        docRef.set(map).get();
    }

    public String saveFee(Fee fee) throws Exception {
        if (fee.getId() == null || fee.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            fee.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(fee.getId()).set(fee).get();
        return fee.getId();
    }

    public void deleteFee(String id) throws Exception {
        firestore.collection(COLLECTION_NAME).document(id).delete().get();
    }
}
