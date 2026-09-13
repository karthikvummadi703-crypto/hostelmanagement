package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Complaint;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class ComplaintService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "complaints";

    public ComplaintService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Complaint getComplaintById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        return doc.exists() ? doc.toObject(Complaint.class) : null;
    }

    public List<Complaint> getComplaintsByStudent(String studentId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("studentId", studentId)
                .get().get();
        List<Complaint> list = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            list.add(doc.toObject(Complaint.class));
        }
        return list;
    }

    public List<Complaint> getComplaintsByHostel(String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        List<Complaint> list = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            list.add(doc.toObject(Complaint.class));
        }
        return list;
    }

    public String saveComplaint(Complaint complaint) throws Exception {
        if (complaint.getId() == null || complaint.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            complaint.setId(docRef.getId());
        }
        if (complaint.getCreatedAt() == null) {
            complaint.setCreatedAt(System.currentTimeMillis());
        }
        firestore.collection(COLLECTION_NAME).document(complaint.getId()).set(complaint).get();
        return complaint.getId();
    }

    public void updateStatus(String id, String status, String remarks) throws Exception {
        var docRef = firestore.collection(COLLECTION_NAME).document(id);
        var doc = docRef.get().get();
        if (doc.exists()) {
            var complaint = doc.toObject(Complaint.class);
            if (complaint != null) {
                complaint.setStatus(status);
                complaint.setAdminRemarks(remarks);
                complaint.setResolvedAt(System.currentTimeMillis());
                docRef.set(complaint).get();
            }
        }
    }
}
