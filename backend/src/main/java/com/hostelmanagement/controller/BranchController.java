package com.hostelmanagement.controller;

import com.hostelmanagement.model.Branch;
import com.hostelmanagement.service.BranchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchService branchService;

    public BranchController(BranchService branchService) {
        this.branchService = branchService;
    }

    @GetMapping
    public ResponseEntity<List<Branch>> getAllBranches() throws Exception {
        return ResponseEntity.ok(branchService.getAllBranches());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Branch> getBranchById(@PathVariable String id) throws Exception {
        Branch branch = branchService.getBranchById(id);
        if (branch == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(branch);
    }

    @PostMapping
    public ResponseEntity<String> saveBranch(@RequestBody Branch branch) throws Exception {
        String id = branchService.saveBranch(branch);
        return ResponseEntity.ok(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteBranch(@PathVariable String id) throws Exception {
        branchService.deleteBranch(id);
        return ResponseEntity.noContent().build();
    }
}
