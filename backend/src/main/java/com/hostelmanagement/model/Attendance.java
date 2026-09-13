package com.hostelmanagement.model;

public class Attendance {
    private String id;
    private String studentId;
    private String rollNo;
    private String studentName;
    private String roomNo;
    private String hostelId;
    private String date; // YYYY-MM-DD
    private String status; // Present, Absent, Leave
    private String remarks;

    private String meal;
    private Double mealCost;
    private java.util.List<String> presentStudentUids;

    public Attendance() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }
    public String getRollNo() { return rollNo; }
    public void setRollNo(String rollNo) { this.rollNo = rollNo; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getRoomNo() { return roomNo; }
    public void setRoomNo(String roomNo) { this.roomNo = roomNo; }
    public String getHostelId() { return hostelId; }
    public void setHostelId(String hostelId) { this.hostelId = hostelId; }
    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getMeal() { return meal; }
    public void setMeal(String meal) { this.meal = meal; }
    public Double getMealCost() { return mealCost; }
    public void setMealCost(Double mealCost) { this.mealCost = mealCost; }
    public java.util.List<String> getPresentStudentUids() { return presentStudentUids; }
    public void setPresentStudentUids(java.util.List<String> presentStudentUids) { this.presentStudentUids = presentStudentUids; }
}
