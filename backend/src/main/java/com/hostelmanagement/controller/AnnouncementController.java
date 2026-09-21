package com.hostelmanagement.controller;

import com.hostelmanagement.model.Announcement;
import com.hostelmanagement.service.AnnouncementService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;

    public AnnouncementController(AnnouncementService announcementService) {
        this.announcementService = announcementService;
    }

    @GetMapping
    public ResponseEntity<List<Announcement>> getAnnouncementsByHostel(
            @RequestParam String hostelId) throws Exception {
        return ResponseEntity.ok(announcementService.getAnnouncementsByHostel(hostelId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Announcement> getAnnouncementById(@PathVariable String id) throws Exception {
        Announcement announcement = announcementService.getAnnouncementById(id);
        if (announcement == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(announcement);
    }

    @PostMapping
    public ResponseEntity<String> saveAnnouncement(@RequestBody Announcement announcement) throws Exception {
        String id = announcementService.saveAnnouncement(announcement);
        return ResponseEntity.ok(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable String id) throws Exception {
        announcementService.deleteAnnouncement(id);
        return ResponseEntity.noContent().build();
    }
}
