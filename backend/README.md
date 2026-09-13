# Hostel Management System - Java Spring Boot Backend

A RESTful backend service built with **Java 21**, **Spring Boot 3**, and **Firebase Admin SDK** to power the Hostel Management System.

---

## 🏗 System Architecture

```
HTML + CSS + Vanilla JS (Frontend: http://localhost:5500)
          │
          │ REST API Calls (HTTP / JSON)
          ▼
┌───────────────────────────────────────────┐
│     Java Spring Boot REST API Backend     │
│             (Port: 8080)                  │
│                                           │
│  • Token Verification & Security          │
│  • Role Validation (ADMIN / STUDENT)      │
│  • Multi-Hostel Isolation                 │
│  • Student Management & Allotment         │
│  • Attendance, Fees & Payment Records     │
│  • Mess & Complaints Tracking             │
│  • Announcements Engine                   │
└─────────────────────┬─────────────────────┘
                      │
                      ▼
               Firebase Services
         ┌─────────────────────────┐
         │ Authentication          │
         │ Cloud Firestore         │
         │ Firebase Storage        │
         └─────────────────────────┘
```

---

## 📂 Project Layout

```
backend/
├── pom.xml
├── README.md
└── src/
    └── main/
        ├── java/
        │   └── com/hostelmanagement/
        │       ├── HostelManagementApplication.java
        │       │
        │       ├── config/
        │       │   ├── FirebaseConfig.java
        │       │   └── SecurityConfig.java
        │       │
        │       ├── controller/
        │       │   ├── AdminController.java
        │       │   ├── AllotmentController.java
        │       │   ├── AnnouncementController.java
        │       │   ├── AttendanceController.java
        │       │   ├── BranchController.java
        │       │   ├── ComplaintController.java
        │       │   ├── FeeController.java
        │       │   ├── MessController.java
        │       │   ├── PaymentController.java
        │       │   ├── RoomController.java
        │       │   └── StudentController.java
        │       │
        │       ├── exception/
        │       │   ├── GlobalExceptionHandler.java
        │       │   └── ResourceNotFoundException.java
        │       │
        │       ├── model/
        │       │   ├── Admin.java
        │       │   ├── Allotment.java
        │       │   ├── Announcement.java
        │       │   ├── Attendance.java
        │       │   ├── Branch.java
        │       │   ├── Complaint.java
        │       │   ├── Fee.java
        │       │   ├── Mess.java
        │       │   ├── Payment.java
        │       │   ├── Room.java
        │       │   └── Student.java
        │       │
        │       ├── security/
        │       │   ├── AuthenticationService.java
        │       │   └── FirebaseTokenFilter.java
        │       │
        │       └── service/
        │           ├── AdminService.java
        │           ├── AllotmentService.java
        │           ├── AnnouncementService.java
        │           ├── AttendanceService.java
        │           ├── BranchService.java
        │           ├── ComplaintService.java
        │           ├── FeeService.java
        │           ├── MessService.java
        │           ├── PaymentService.java
        │           ├── RoomService.java
        │           └── StudentService.java
        │
        └── resources/
            └── application.properties
```

---

## 🚀 Getting Started & Running

### Prerequisites
- **Java 21 OpenJDK** installed and configured in `PATH`.
- Maven 3.8+ (or Maven wrapper).

### Build & Run Commands

From the root project directory:

```bash
# Navigate to backend directory
cd backend

# Build application
mvn clean package -DskipTests

# Run Spring Boot Application
mvn spring-boot:run
```

Or using `java -jar` after building:
```bash
java -jar target/hostelmanagement-backend-1.0.0.jar
```

The server runs on **`http://localhost:8080`**.

---

## 📡 REST API Documentation

| Module | Base Path | Methods Supported | Key Parameters |
|---|---|---|---|
| **Admins** | `/api/admins` | `GET`, `POST`, `DELETE` | `id` |
| **Students** | `/api/students` | `GET`, `POST`, `DELETE` | `hostelId`, `id` |
| **Branches** | `/api/branches` | `GET`, `POST`, `DELETE` | `id` |
| **Rooms** | `/api/rooms` | `GET`, `POST`, `DELETE` | `hostelId`, `id` |
| **Allotments** | `/api/allotments` | `GET`, `POST`, `DELETE` | `hostelId`, `id` |
| **Attendance** | `/api/attendance` | `GET`, `POST`, `POST /batch` | `date`, `hostelId`, `studentId` |
| **Fees** | `/api/fees` | `GET`, `POST`, `DELETE` | `studentId`, `hostelId` |
| **Mess** | `/api/mess` | `GET`, `POST` | `hostelId` |
| **Payments** | `/api/payments` | `GET`, `POST` | `studentId`, `hostelId` |
| **Complaints** | `/api/complaints` | `GET`, `POST`, `PATCH /status` | `studentId`, `hostelId` |
| **Announcements**| `/api/announcements` | `GET`, `POST`, `DELETE` | `hostelId` |

---

## 🔐 Security & Firebase Integration

- **Firebase Admin SDK** is initialized via `FirebaseConfig.java`.
- **FirebaseTokenFilter** validates standard `Authorization: Bearer <token>` HTTP headers.
- **CORS Configuration** allows requests from the frontend origin `http://localhost:5500`.
