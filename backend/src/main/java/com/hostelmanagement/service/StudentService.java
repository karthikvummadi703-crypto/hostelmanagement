package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Student;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class StudentService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "students";

    public StudentService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Student getStudentById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        if (doc.exists()) {
            return doc.toObject(Student.class);
        }
        return null;
    }

    public List<Student> getStudentsByHostel(String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        List<Student> students = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            students.add(doc.toObject(Student.class));
        }
        return students;
    }

    public List<Student> getAllStudents() throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME).get().get();
        List<Student> students = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            students.add(doc.toObject(Student.class));
        }
        return students;
    }

    public String saveStudent(Student student) throws Exception {
        if (student.getId() == null || student.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            student.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(student.getId()).set(student).get();
        return student.getId();
    }

    public void deleteStudent(String id) throws Exception {
        firestore.collection(COLLECTION_NAME).document(id).delete().get();
    }
}
