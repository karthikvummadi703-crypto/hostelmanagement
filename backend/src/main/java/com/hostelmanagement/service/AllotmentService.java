package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Allotment;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class AllotmentService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "allotments";

    public AllotmentService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Allotment getAllotmentById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        return doc.exists() ? doc.toObject(Allotment.class) : null;
    }

    public List<Allotment> getAllotmentsByHostel(String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        List<Allotment> allotments = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            allotments.add(doc.toObject(Allotment.class));
        }
        return allotments;
    }

    public String saveAllotment(Allotment allotment) throws Exception {
        if (allotment.getId() == null || allotment.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            allotment.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(allotment.getId()).set(allotment).get();
        return allotment.getId();
    }

    public void deleteAllotment(String id) throws Exception {
        firestore.collection(COLLECTION_NAME).document(id).delete().get();
    }
}
