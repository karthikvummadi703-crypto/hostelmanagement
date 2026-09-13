package com.hostelmanagement.model;

public class Fee {
    private String id;
    private String studentId;
    private String rollNo;
    private String studentName;
    private String hostelId;
    private Double totalAmount;
    private Double paidAmount;
    private Double pendingAmount;
    private String dueDate;
    private String status; // Paid, Partial, Pending, Overdue

    private String monthKey;
    private Double monthlyRent;
    private Double breakfastCost;
    private Double lunchCost;
    private Double dinnerCost;
    private Double customMealsCost;
    private Boolean isFinalized;
    private String finalizedAt;

    public Fee() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }
    public String getRollNo() { return rollNo; }
    public void setRollNo(String rollNo) { this.rollNo = rollNo; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }
    public String getHostelId() { return hostelId; }
    public void setHostelId(String hostelId) { this.hostelId = hostelId; }
    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }
    public Double getPaidAmount() { return paidAmount; }
    public void setPaidAmount(Double paidAmount) { this.paidAmount = paidAmount; }
    public Double getPendingAmount() { return pendingAmount; }
    public void setPendingAmount(Double pendingAmount) { this.pendingAmount = pendingAmount; }
    public String getDueDate() { return dueDate; }
    public void setDueDate(String dueDate) { this.dueDate = dueDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMonthKey() { return monthKey; }
    public void setMonthKey(String monthKey) { this.monthKey = monthKey; }
    public Double getMonthlyRent() { return monthlyRent; }
    public void setMonthlyRent(Double monthlyRent) { this.monthlyRent = monthlyRent; }
    public Double getBreakfastCost() { return breakfastCost; }
    public void setBreakfastCost(Double breakfastCost) { this.breakfastCost = breakfastCost; }
    public Double getLunchCost() { return lunchCost; }
    public void setLunchCost(Double lunchCost) { this.lunchCost = lunchCost; }
    public Double getDinnerCost() { return dinnerCost; }
    public void setDinnerCost(Double dinnerCost) { this.dinnerCost = dinnerCost; }
    public Double getCustomMealsCost() { return customMealsCost; }
    public void setCustomMealsCost(Double customMealsCost) { this.customMealsCost = customMealsCost; }
    public Boolean getIsFinalized() { return isFinalized; }
    public void setIsFinalized(Boolean finalized) { isFinalized = finalized; }
    public String getFinalizedAt() { return finalizedAt; }
    public void setFinalizedAt(String finalizedAt) { this.finalizedAt = finalizedAt; }
}
