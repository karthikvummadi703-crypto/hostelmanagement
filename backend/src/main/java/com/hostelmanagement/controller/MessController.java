package com.hostelmanagement.controller;

import com.hostelmanagement.model.Mess;
import com.hostelmanagement.service.MessService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/mess")
@CrossOrigin(origins = "*")
public class MessController {

    private final MessService messService;

    public MessController(MessService messService) {
        this.messService = messService;
    }

    @GetMapping
    public ResponseEntity<Mess> getMessByHostel(@RequestParam String hostelId) throws Exception {
        Mess mess = messService.getMessByHostel(hostelId);
        if (mess == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(mess);
    }

    @PostMapping
    public ResponseEntity<String> saveMess(@RequestBody Mess mess) throws Exception {
        String id = messService.saveMess(mess);
        return ResponseEntity.ok(id);
    }
}
