package com.hostelmanagement.model;

import java.util.Map;

public class Mess {
    private String id;
    private String hostelId;
    private String month;
    private Map<String, Object> weeklyMenu;
    private Double monthlyMessFee;
    private String notice;
    private Long updatedAt;

    public Mess() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getHostelId() { return hostelId; }
    public void setHostelId(String hostelId) { this.hostelId = hostelId; }
    public String getMonth() { return month; }
    public void setMonth(String month) { this.month = month; }
    public Map<String, Object> getWeeklyMenu() { return weeklyMenu; }
    public void setWeeklyMenu(Map<String, Object> weeklyMenu) { this.weeklyMenu = weeklyMenu; }
    public Double getMonthlyMessFee() { return monthlyMessFee; }
    public void setMonthlyMessFee(Double monthlyMessFee) { this.monthlyMessFee = monthlyMessFee; }
    public String getNotice() { return notice; }
    public void setNotice(String notice) { this.notice = notice; }
    public Long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Long updatedAt) { this.updatedAt = updatedAt; }
}
