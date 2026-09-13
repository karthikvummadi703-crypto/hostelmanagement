package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Attendance;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class AttendanceService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "attendance";

    public AttendanceService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Attendance getAttendanceById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        return doc.exists() ? doc.toObject(Attendance.class) : null;
    }

    public List<Attendance> getAttendanceByDateAndHostel(String date, String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("date", date)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        List<Attendance> list = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            list.add(doc.toObject(Attendance.class));
        }
        return list;
    }

    public List<Attendance> getStudentAttendance(String studentId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("studentId", studentId)
                .get().get();
        List<Attendance> list = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            list.add(doc.toObject(Attendance.class));
        }
        return list;
    }

    public String saveAttendance(Attendance attendance) throws Exception {
        if (attendance.getId() == null || attendance.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            attendance.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(attendance.getId()).set(attendance).get();
        return attendance.getId();
    }

    public void saveBatchAttendance(List<Attendance> attendanceList) throws Exception {
        var batch = firestore.batch();
        for (Attendance att : attendanceList) {
            if (att.getId() == null || att.getId().isEmpty()) {
                var docRef = firestore.collection(COLLECTION_NAME).document();
                att.setId(docRef.getId());
            }
            var docRef = firestore.collection(COLLECTION_NAME).document(att.getId());
            batch.set(docRef, att);
        }
        batch.commit().get();
    }
}
