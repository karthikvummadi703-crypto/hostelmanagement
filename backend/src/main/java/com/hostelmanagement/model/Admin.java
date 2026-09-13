package com.hostelmanagement.model;

public class Admin {
    private String id;
    private String uid;
    private String name;
    private String email;
    private String role = "admin";
    private String hostelId;
    private String status = "active";

    public Admin() {}

    public Admin(String id, String uid, String name, String email, String role, String hostelId, String status) {
        this.id = id != null ? id : uid;
        this.uid = uid != null ? uid : id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.hostelId = hostelId;
        this.status = status;
    }

    public String getId() { return id != null ? id : uid; }
    public void setId(String id) { this.id = id; if (this.uid == null) this.uid = id; }
    public String getUid() { return uid != null ? uid : id; }
    public void setUid(String uid) { this.uid = uid; if (this.id == null) this.id = uid; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getHostelId() { return hostelId; }
    public void setHostelId(String hostelId) { this.hostelId = hostelId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
