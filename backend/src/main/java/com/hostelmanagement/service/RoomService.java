package com.hostelmanagement.service;

import com.google.cloud.firestore.Firestore;
import com.hostelmanagement.model.Room;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class RoomService {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "rooms";

    public RoomService(Firestore firestore) {
        this.firestore = firestore;
    }

    public Room getRoomById(String id) throws Exception {
        var doc = firestore.collection(COLLECTION_NAME).document(id).get().get();
        return doc.exists() ? doc.toObject(Room.class) : null;
    }

    public List<Room> getRoomsByHostel(String hostelId) throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("hostelId", hostelId)
                .get().get();
        List<Room> rooms = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            rooms.add(doc.toObject(Room.class));
        }
        return rooms;
    }

    public List<Room> getAllRooms() throws Exception {
        var querySnapshot = firestore.collection(COLLECTION_NAME).get().get();
        List<Room> rooms = new ArrayList<>();
        for (var doc : querySnapshot.getDocuments()) {
            rooms.add(doc.toObject(Room.class));
        }
        return rooms;
    }

    public String saveRoom(Room room) throws Exception {
        if (room.getId() == null || room.getId().isEmpty()) {
            var docRef = firestore.collection(COLLECTION_NAME).document();
            room.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(room.getId()).set(room).get();
        return room.getId();
    }

    public void deleteRoom(String id) throws Exception {
        firestore.collection(COLLECTION_NAME).document(id).delete().get();
    }
}
