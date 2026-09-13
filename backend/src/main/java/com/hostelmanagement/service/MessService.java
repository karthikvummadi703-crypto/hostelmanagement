package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Mess;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class MessService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "mess";

    public MessService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Mess getMessByHostel(String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        if (!querySnapshot.isEmpty()) {
            return querySnapshot.getDocuments().get(0).toObject(Mess.class);
        }
        return null;
    }

    public String saveMess(Mess mess) throws Exception {
        if (mess.getId() == null || mess.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            mess.setId(docRef.getId());
        }
        mess.setUpdatedAt(System.currentTimeMillis());
        firestore.collection(COLLECTION_NAME).document(mess.getId()).set(mess).get();
        return mess.getId();
    }
}
