package com.hostelmanagement.controller;

import com.hostelmanagement.model.Attendance;
import com.hostelmanagement.service.AttendanceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping
    public ResponseEntity<List<Attendance>> getAttendance(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String hostelId,
            @RequestParam(required = false) String studentId) throws Exception {

        if (studentId != null && !studentId.isEmpty()) {
            return ResponseEntity.ok(attendanceService.getStudentAttendance(studentId));
        }
        if (date != null && hostelId != null) {
            return ResponseEntity.ok(attendanceService.getAttendanceByDateAndHostel(date, hostelId));
        }
        return ResponseEntity.badRequest().build();
    }

    @PostMapping
    public ResponseEntity<String> saveAttendance(@RequestBody Attendance attendance) throws Exception {
        String id = attendanceService.saveAttendance(attendance);
        return ResponseEntity.ok(id);
    }

    @PostMapping("/batch")
    public ResponseEntity<Void> saveBatchAttendance(@RequestBody List<Attendance> attendanceList) throws Exception {
        attendanceService.saveBatchAttendance(attendanceList);
        return ResponseEntity.ok().build();
    }
}
