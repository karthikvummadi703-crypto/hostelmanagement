package com.hostelmanagement.controller;

import com.hostelmanagement.model.Student;
import com.hostelmanagement.service.StudentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @GetMapping
    public ResponseEntity<List<Student>> getAllStudents(
            @RequestParam(required = false) String hostelId) throws Exception {
        if (hostelId != null && !hostelId.isEmpty()) {
            return ResponseEntity.ok(studentService.getStudentsByHostel(hostelId));
        }
        return ResponseEntity.ok(studentService.getAllStudents());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Student> getStudentById(@PathVariable String id) throws Exception {
        Student student = studentService.getStudentById(id);
        if (student == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(student);
    }

    @PostMapping
    public ResponseEntity<String> saveStudent(@RequestBody Student student) throws Exception {
        String id = studentService.saveStudent(student);
        return ResponseEntity.ok(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStudent(@PathVariable String id) throws Exception {
        studentService.deleteStudent(id);
        return ResponseEntity.noContent().build();
    }
}
