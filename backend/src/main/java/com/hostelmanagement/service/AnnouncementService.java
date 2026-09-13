package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Announcement;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class AnnouncementService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "announcements";

    public AnnouncementService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Announcement getAnnouncementById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        return doc.exists() ? doc.toObject(Announcement.class) : null;
    }

    public List<Announcement> getAnnouncementsByHostel(String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        List<Announcement> list = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            list.add(doc.toObject(Announcement.class));
        }
        return list;
    }

    public String saveAnnouncement(Announcement announcement) throws Exception {
        if (announcement.getId() == null || announcement.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            announcement.setId(docRef.getId());
        }
        if (announcement.getTimestamp() == null) {
            announcement.setTimestamp(System.currentTimeMillis());
        }
        firestore.collection(COLLECTION_NAME).document(announcement.getId()).set(announcement).get();
        return announcement.getId();
    }

    public void deleteAnnouncement(String id) throws Exception {
        firestore.collection(COLLECTION_NAME).document(id).delete().get();
    }
}
