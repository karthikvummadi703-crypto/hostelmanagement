package com.hostelmanagement.controller;

import com.hostelmanagement.model.Room;
import com.hostelmanagement.service.RoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @GetMapping
    public ResponseEntity<List<Room>> getAllRooms(
            @RequestParam(required = false) String hostelId) throws Exception {
        if (hostelId != null && !hostelId.isEmpty()) {
            return ResponseEntity.ok(roomService.getRoomsByHostel(hostelId));
        }
        return ResponseEntity.ok(roomService.getAllRooms());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Room> getRoomById(@PathVariable String id) throws Exception {
        Room room = roomService.getRoomById(id);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(room);
    }

    @PostMapping
    public ResponseEntity<String> saveRoom(@RequestBody Room room) throws Exception {
        String id = roomService.saveRoom(room);
        return ResponseEntity.ok(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRoom(@PathVariable String id) throws Exception {
        roomService.deleteRoom(id);
        return ResponseEntity.noContent().build();
    }
}
