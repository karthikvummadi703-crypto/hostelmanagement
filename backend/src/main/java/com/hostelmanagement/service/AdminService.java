package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Admin;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class AdminService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "admins";

    public AdminService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Admin getAdminById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        if (doc.exists()) {
            return doc.toObject(Admin.class);
        }
        return null;
    }

    public List<Admin> getAllAdmins() throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME).get().get();
        List<Admin> admins = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            admins.add(doc.toObject(Admin.class));
        }
        return admins;
    }

    public String saveAdmin(Admin admin) throws Exception {
        if (admin.getId() == null || admin.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            admin.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(admin.getId()).set(admin).get();
        return admin.getId();
    }

    public void deleteAdmin(String id) throws Exception {
        firestore.collection(COLLECTION_NAME).document(id).delete().get();
    }
}
