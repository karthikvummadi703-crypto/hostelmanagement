package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Branch;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class BranchService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "branches";

    public BranchService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Branch getBranchById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        return doc.exists() ? doc.toObject(Branch.class) : null;
    }

    public List<Branch> getAllBranches() throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME).get().get();
        List<Branch> branches = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            branches.add(doc.toObject(Branch.class));
        }
        return branches;
    }

    public String saveBranch(Branch branch) throws Exception {
        if (branch.getId() == null || branch.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            branch.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(branch.getId()).set(branch).get();
        return branch.getId();
    }

    public void deleteBranch(String id) throws Exception {
        firestore.collection(COLLECTION_NAME).document(id).delete().get();
    }
}
