package com.hostelmanagement.model;

public class Student {
    private String id;
    private String uid;
    private String rollNo;
    private String name;
    private String email;
    private String branchId;
    private String branchName;
    private String year;
    private String joiningMonth;
    private String hostelId;
    private String roomNo = "Unassigned";
    private String role = "student";
    private String status = "active";
    private String createdAt;

    public Student() {}

    public String getId() { return id != null ? id : uid; }
    public void setId(String id) { this.id = id; if (this.uid == null) this.uid = id; }
    public String getUid() { return uid != null ? uid : id; }
    public void setUid(String uid) { this.uid = uid; if (this.id == null) this.id = uid; }
    public String getRollNo() { return rollNo; }
    public void setRollNo(String rollNo) { this.rollNo = rollNo; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getBranchId() { return branchId; }
    public void setBranchId(String branchId) { this.branchId = branchId; }
    public String getBranchName() { return branchName; }
    public void setBranchName(String branchName) { this.branchName = branchName; }
    public String getYear() { return year; }
    public void setYear(String year) { this.year = year; }
    public String getJoiningMonth() { return joiningMonth; }
    public void setJoiningMonth(String joiningMonth) { this.joiningMonth = joiningMonth; }
    public String getHostelId() { return hostelId; }
    public void setHostelId(String hostelId) { this.hostelId = hostelId; }
    public String getRoomNo() { return roomNo; }
    public void setRoomNo(String roomNo) { this.roomNo = roomNo; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
