package com.hostelmanagement.model;

public class Allotment {
    private String id;
    private String studentId;
    private String studentName;
    private String rollNo;
    private String branchId;
    private String roomId;
    private String roomNo;
    private String hostelId;
    private String allotmentDate;
    private String status = "Active";

    public Allotment() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getRollNo() { return rollNo; }
    public void setRollNo(String rollNo) { this.rollNo = rollNo; }
    public String getBranchId() { return branchId; }
    public void setBranchId(String branchId) { this.branchId = branchId; }
    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
    public String getRoomNo() { return roomNo; }
    public void setRoomNo(String roomNo) { this.roomNo = roomNo; }
    public String getHostelId() { return hostelId; }
    public void setHostelId(String hostelId) { this.hostelId = hostelId; }
    public String getAllotmentDate() { return allotmentDate; }
    public void setAllotmentDate(String allotmentDate) { this.allotmentDate = allotmentDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
