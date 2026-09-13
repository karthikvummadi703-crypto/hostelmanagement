package com.hostelmanagement.model;

import java.util.List;

public class Room {
    private String id;
    private String roomNo;
    private String floor;
    private Integer capacity;
    private Integer occupied;
    private String hostelId;
    private String branchPreference;
    private String status;
    private List<String> studentIds;

    public Room() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRoomNo() { return roomNo; }
    public void setRoomNo(String roomNo) { this.roomNo = roomNo; }
    public String getFloor() { return floor; }
    public void setFloor(String floor) { this.floor = floor; }
    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }
    public Integer getOccupied() { return occupied; }
    public void setOccupied(Integer occupied) { this.occupied = occupied; }
    public String getHostelId() { return hostelId; }
    public void setHostelId(String hostelId) { this.hostelId = hostelId; }
    public String getBranchPreference() { return branchPreference; }
    public void setBranchPreference(String branchPreference) { this.branchPreference = branchPreference; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public List<String> getStudentIds() { return studentIds; }
    public void setStudentIds(List<String> studentIds) { this.studentIds = studentIds; }
}
