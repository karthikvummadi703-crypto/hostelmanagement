// services/db-service.js
// Production-Grade Firestore Data Layer for Hostel Management System

import { 
  db, 
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  isLiveFirebase, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  serverTimestamp 
} from "../firebase-config.js";
import { 
  deleteDoc, 
  updateDoc, 
  runTransaction, 
  orderBy, 
  limit 
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// ============================================================
// 1. BRANCH SERVICE
// ============================================================
export const branchService = {
  async getBranches(hostelId) {
    if (!hostelId) return [];
    try {
      const q = query(collection(db, "branches"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      const branches = [];
      snap.forEach(d => branches.push({ id: d.id, ...d.data() }));
      return branches;
    } catch (err) {
      console.error("Error fetching branches:", err);
      return [];
    }
  },

  async addBranch(hostelId, { code, name }) {
    if (!hostelId) throw new Error("Hostel context missing");
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    if (!cleanCode || !cleanName) throw new Error("Branch code and name are required.");

    const branchId = `${hostelId}_${cleanCode}`;
    await setDoc(doc(db, "branches", branchId), {
      id: branchId,
      hostelId,
      code: cleanCode,
      name: cleanName,
      createdAt: serverTimestamp()
    });
    return { id: branchId, code: cleanCode, name: cleanName };
  },

  async deleteBranch(branchId) {
    await deleteDoc(doc(db, "branches", branchId));
    return true;
  }
};

// ============================================================
// 2. ROOM SERVICE
// ============================================================
export const roomService = {
  async getRooms(hostelId) {
    if (!hostelId) return [];
    try {
      const q = query(collection(db, "rooms"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      const rooms = [];
      snap.forEach(d => rooms.push({ id: d.id, ...d.data() }));
      return rooms.sort((a, b) => String(a.roomNo).localeCompare(String(b.roomNo)));
    } catch (err) {
      console.error("Error fetching rooms:", err);
      return [];
    }
  },

  async addRoom(hostelId, { roomNo, capacity, branchPreference = "All", floor = "1" }) {
    if (!hostelId) throw new Error("Hostel context missing");
    const cleanRoomNo = roomNo.trim().toUpperCase();
    const parsedCapacity = parseInt(capacity, 10) || 4;
    if (!cleanRoomNo) throw new Error("Room number is required.");

    const roomId = `${hostelId}_R_${cleanRoomNo}`;
    const roomData = {
      id: roomId,
      hostelId,
      roomNo: cleanRoomNo,
      floor,
      capacity: parsedCapacity,
      occupied: 0,
      studentIds: [],
      branchPreference,
      status: "available", // 'available' | 'full'
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, "rooms", roomId), roomData);
    return roomData;
  },

  async deleteRoom(roomId) {
    await deleteDoc(doc(db, "rooms", roomId));
    return true;
  }
};

// ============================================================
// 3. STUDENT SERVICE
// ============================================================
export const studentService = {
  async getStudents(hostelId, { branch = "", search = "", unallocatedOnly = false } = {}) {
    if (!hostelId) return [];
    try {
      const q = query(collection(db, "students"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      let students = [];
      snap.forEach(d => students.push({ id: d.id, ...d.data() }));

      if (branch && branch !== "All Branches") {
        students = students.filter(s => s.branchName === branch || s.branchId === branch);
      }

      if (unallocatedOnly) {
        students = students.filter(s => !s.roomNo || s.roomNo === "Unassigned" || s.roomNo === "—");
      }

      if (search) {
        const queryLower = search.toLowerCase();
        students = students.filter(s => 
          (s.name && s.name.toLowerCase().includes(queryLower)) ||
          (s.rollNo && s.rollNo.toLowerCase().includes(queryLower)) ||
          (s.email && s.email.toLowerCase().includes(queryLower)) ||
          (s.roomNo && s.roomNo.toLowerCase().includes(queryLower))
        );
      }

      return students;
    } catch (err) {
      console.error("Error fetching students:", err);
      return [];
    }
  },

  async updateStudentStatus(studentUid, status) {
    await updateDoc(doc(db, "students", studentUid), {
      status,
      updatedAt: serverTimestamp()
    });
    return true;
  },

  async deleteStudent(studentUid) {
    if (!studentUid) throw new Error("Student ID is required.");
    if (isLiveFirebase && db) {
      try {
        const studentRef = doc(db, "students", studentUid);
        const studentSnap = await getDoc(studentRef);
        if (studentSnap && studentSnap.exists()) {
          const data = studentSnap.data();
          if (data.roomId) {
            try {
              const roomRef = doc(db, "rooms", data.roomId);
              const roomSnap = await getDoc(roomRef);
              if (roomSnap && roomSnap.exists()) {
                const rData = roomSnap.data();
                const updatedIds = (rData.studentIds || []).filter(id => id !== studentUid);
                await updateDoc(roomRef, {
                  studentIds: updatedIds,
                  occupied: updatedIds.length,
                  status: updatedIds.length >= (rData.capacity || 4) ? "full" : "available"
                });
              }
            } catch (rErr) {
              console.warn("Could not auto-deallocate room for deleted student:", rErr);
            }
          }
          await deleteDoc(studentRef);
        }
      } catch (err) {
        console.warn("Firestore delete student error:", err);
      }
    }
    return true;
  }
};

// ============================================================
// 4. ATOMIC ALLOTMENT SERVICE (Firestore Transaction)
// ============================================================
export const allotmentService = {
  /**
   * Allocates a student to a room atomically using runTransaction
   * Prevents over-booking beyond capacity and updates both room and student records.
   */
  async allocateStudent(hostelId, studentUid, roomId) {
    return await runTransaction(db, async (transaction) => {
      const roomRef = doc(db, "rooms", roomId);
      const studentRef = doc(db, "students", studentUid);

      const roomSnap = await transaction.get(roomRef);
      const studentSnap = await transaction.get(studentRef);

      if (!roomSnap.exists()) throw new Error("Selected room does not exist.");
      if (!studentSnap.exists()) throw new Error("Selected student does not exist.");

      const roomData = roomSnap.data();
      const currentOccupied = roomData.occupied || 0;
      const capacity = roomData.capacity || 4;

      if (currentOccupied >= capacity) {
        throw new Error(`Room ${roomData.roomNo} is full (Capacity: ${capacity}).`);
      }

      const currentStudentIds = roomData.studentIds || [];
      if (!currentStudentIds.includes(studentUid)) {
        currentStudentIds.push(studentUid);
      }

      const newOccupied = currentStudentIds.length;
      const newStatus = newOccupied >= capacity ? "full" : "available";

      // 1. Update room
      transaction.update(roomRef, {
        occupied: newOccupied,
        studentIds: currentStudentIds,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 2. Update student
      transaction.update(studentRef, {
        roomId: roomId,
        roomNo: roomData.roomNo,
        updatedAt: serverTimestamp()
      });

      return { roomNo: roomData.roomNo, occupied: newOccupied };
    });
  },

  /**
   * Deallocates a student from their currently assigned room
   */
  async deallocateStudent(hostelId, studentUid) {
    return await runTransaction(db, async (transaction) => {
      const studentRef = doc(db, "students", studentUid);
      const studentSnap = await transaction.get(studentRef);
      if (!studentSnap.exists()) throw new Error("Student not found.");

      const studentData = studentSnap.data();
      const roomId = studentData.roomId;

      if (roomId) {
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await transaction.get(roomRef);
        if (roomSnap.exists()) {
          const roomData = roomSnap.data();
          const currentStudentIds = (roomData.studentIds || []).filter(id => id !== studentUid);
          const newOccupied = currentStudentIds.length;

          transaction.update(roomRef, {
            occupied: newOccupied,
            studentIds: currentStudentIds,
            status: newOccupied >= roomData.capacity ? "full" : "available",
            updatedAt: serverTimestamp()
          });
        }
      }

      transaction.update(studentRef, {
        roomId: "",
        roomNo: "Unassigned",
        updatedAt: serverTimestamp()
      });

      return true;
    });
  },

  /**
   * Clears existing allotments and reallocates all students based on branch preferences and room capacity.
   */
  async reallocateAll(hostelId) {
    if (!hostelId) throw new Error("Hostel context required");

    const [students, rooms] = await Promise.all([
      studentService.getStudents(hostelId),
      roomService.getRooms(hostelId)
    ]);

    if (!students.length) throw new Error("No students found to allocate.");
    if (!rooms.length) throw new Error("No rooms available for allocation.");

    // Reset all room occupied states
    for (const r of rooms) {
      await updateDoc(doc(db, "rooms", r.id), {
        occupied: 0,
        studentIds: [],
        status: "available",
        updatedAt: serverTimestamp()
      });
      r.occupied = 0;
      r.studentIds = [];
      r.status = "available";
    }

    // Reset all student room assignments
    for (const s of students) {
      await updateDoc(doc(db, "students", s.id), {
        roomId: "",
        roomNo: "Unassigned",
        updatedAt: serverTimestamp()
      });
    }

    // Perform auto-allocation matching student branch to room branchPreference first, then general rooms
    let allocatedCount = 0;
    for (const s of students) {
      const studentBranch = (s.branchName || s.branchId || "").toUpperCase();
      
      let targetRoom = rooms.find(r => 
        (r.branchPreference || "ALL").toUpperCase() === studentBranch && (r.occupied || 0) < (r.capacity || 4)
      );

      if (!targetRoom) {
        targetRoom = rooms.find(r => 
          ((r.branchPreference || "ALL").toUpperCase() === "ALL" || (r.branchPreference || "ALL").toUpperCase() === "ANY") &&
          (r.occupied || 0) < (r.capacity || 4)
        );
      }

      if (!targetRoom) {
        targetRoom = rooms.find(r => (r.occupied || 0) < (r.capacity || 4));
      }

      if (targetRoom) {
        targetRoom.occupied = (targetRoom.occupied || 0) + 1;
        targetRoom.studentIds = targetRoom.studentIds || [];
        targetRoom.studentIds.push(s.id);
        targetRoom.status = targetRoom.occupied >= (targetRoom.capacity || 4) ? "full" : "available";

        await updateDoc(doc(db, "rooms", targetRoom.id), {
          occupied: targetRoom.occupied,
          studentIds: targetRoom.studentIds,
          status: targetRoom.status,
          updatedAt: serverTimestamp()
        });

        await updateDoc(doc(db, "students", s.id), {
          roomId: targetRoom.id,
          roomNo: targetRoom.roomNo,
          updatedAt: serverTimestamp()
        });

        allocatedCount++;
      }
    }

    return { total: students.length, allocated: allocatedCount };
  }
};

// ============================================================
// 5. ATTENDANCE SERVICE
// ============================================================
export const attendanceService = {
  async isMonthFinalized(hostelId, monthKey) {
    if (!hostelId || !monthKey) return false;
    const cleanMonthKey = String(monthKey).replace(/-/g, "_");
    const docId = `${hostelId}_${cleanMonthKey}`;
    try {
      const snap = await getDoc(doc(db, "monthlyFinalizations", docId));
      return snap.exists() && snap.data().isFinalized === true;
    } catch (err) {
      console.warn("Error checking month finalization:", err);
      return false;
    }
  },

  async finalizeMonth(hostelId, monthKey, adminUid = "") {
    if (!hostelId || !monthKey) throw new Error("Hostel ID and Month Key are required.");
    const cleanMonthKey = String(monthKey).replace(/-/g, "_");
    const docId = `${hostelId}_${cleanMonthKey}`;

    const finRecord = {
      id: docId,
      hostelId,
      monthKey: cleanMonthKey,
      isFinalized: true,
      finalizedBy: adminUid,
      finalizedAt: serverTimestamp()
    };

    await setDoc(doc(db, "monthlyFinalizations", docId), finRecord);

    // Freeze and store student fee calculations in database
    await feeService.finalizeMonthlyFees(hostelId, cleanMonthKey);
    return finRecord;
  },

  async getAttendance(hostelId, dateStr, meal) {
    if (!hostelId || !dateStr || !meal) return null;
    const cleanMealKey = meal.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docId = `${hostelId}_${dateStr}_${cleanMealKey}`;
    try {
      const snap = await getDoc(doc(db, "attendance", docId));
      if (snap.exists()) {
        return snap.data();
      }
    } catch (err) {
      console.warn("Attendance fetch error:", err);
    }
    return null;
  },

  async saveAttendance(hostelId, dateStr, meal, presentStudentUids, mealCost = 0) {
    if (!hostelId || !dateStr || !meal) throw new Error("Invalid attendance parameters");

    // Extract monthKey YYYY_MM from dateStr YYYY-MM-DD
    const monthKey = dateStr.slice(0, 7).replace(/-/g, "_");
    const locked = await this.isMonthFinalized(hostelId, monthKey);
    if (locked) {
      throw new Error(`Attendance records for ${dateStr.slice(0, 7)} are FINALIZED and locked against modifications.`);
    }

    const cleanMealKey = meal.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docId = `${hostelId}_${dateStr}_${cleanMealKey}`;
    const record = {
      id: docId,
      hostelId,
      date: dateStr,
      meal,
      presentStudentUids,
      totalPresent: presentStudentUids.length,
      mealCost: Number(mealCost) || 0,
      recordedAt: serverTimestamp()
    };
    await setDoc(doc(db, "attendance", docId), record);
    return record;
  }
};

// ============================================================
// 6. COMPLAINTS SERVICE
// ============================================================
export const complaintService = {
  async getComplaints(hostelId) {
    if (!hostelId) return [];
    try {
      const q = query(collection(db, "complaints"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      const complaints = [];
      snap.forEach(d => complaints.push({ id: d.id, ...d.data() }));
      return complaints.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (err) {
      console.error("Error fetching complaints:", err);
      return [];
    }
  },

  async addComplaint(hostelId, { studentName, roomNo, category, description, studentUid = "" }) {
    const complaintId = `CMP_${Date.now()}`;
    const data = {
      id: complaintId,
      hostelId,
      studentUid,
      studentName: studentName || "Anonymous Resident",
      roomNo: roomNo || "N/A",
      category,
      description,
      status: "Pending", // 'Pending' | 'In Progress' | 'Resolved'
      createdAt: serverTimestamp(),
      resolvedAt: null
    };
    await setDoc(doc(db, "complaints", complaintId), data);
    return data;
  },

  async updateComplaintStatus(complaintId, newStatus) {
    await updateDoc(doc(db, "complaints", complaintId), {
      status: newStatus,
      resolvedAt: newStatus === "Resolved" ? serverTimestamp() : null
    });
    return true;
  }
};

// ============================================================
// 7. ANNOUNCEMENTS SERVICE
// ============================================================
export const announcementService = {
  async getAnnouncements(hostelId) {
    if (!hostelId) return [];
    try {
      const q = query(collection(db, "announcements"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      return list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (err) {
      console.error("Error fetching announcements:", err);
      return [];
    }
  },

  async addAnnouncement(hostelId, { title, content, audience = "All Students", author = "Warden Office" }) {
    const id = `ANN_${Date.now()}`;
    const data = {
      id,
      hostelId,
      title: title.trim(),
      content: content.trim(),
      audience,
      status: "Published",
      author,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "announcements", id), data);
    return data;
  },

  async deleteAnnouncement(announcementId) {
    await deleteDoc(doc(db, "announcements", announcementId));
    return true;
  }
};

// ============================================================
// 8. MESS TIMETABLE SERVICE
// ============================================================
export const messService = {
  async getMessTimetable(hostelId) {
    if (!hostelId) return null;
    const snap = await getDoc(doc(db, "hostels", hostelId));
    if (snap.exists() && snap.data().messSchedule) {
      return snap.data().messSchedule;
    }
    return {
      breakfast: "07:30 AM – 09:00 AM",
      lunch: "12:30 PM – 02:00 PM",
      dinner: "07:30 PM – 09:00 PM",
      menuToday: "Breakfast: Idli, Vada, Chutney | Lunch: Rice, Dal, Paneer | Dinner: Roti, Veg Pulao"
    };
  },

  async saveMessTimetable(hostelId, messSchedule) {
    await updateDoc(doc(db, "hostels", hostelId), {
      messSchedule,
      updatedAt: serverTimestamp()
    });
    return messSchedule;
  }
};

// ============================================================
// 9. PAYMENTS & FEE SERVICE
// ============================================================
export const paymentService = {
  async getPayments(hostelId) {
    if (!hostelId) return [];
    try {
      const q = query(collection(db, "payments"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      return list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (err) {
      console.error("Error fetching payments:", err);
      return [];
    }
  },

  /**
   * Guard: checks if a UTR/transaction number already exists in this hostel's payments.
   * Prevents duplicate submissions from both admin and student sides.
   */
  async checkDuplicateUTR(hostelId, utrNumber) {
    if (!hostelId || !utrNumber) return false;
    try {
      const cleanUTR = String(utrNumber).trim();
      // Check student UTR field
      const q1 = query(
        collection(db, "payments"),
        where("hostelId", "==", hostelId),
        where("utrNumber", "==", cleanUTR)
      );
      const snap1 = await getDocs(q1);
      if (!snap1.empty) return true;

      // Check admin transactionId field
      const q2 = query(
        collection(db, "payments"),
        where("hostelId", "==", hostelId),
        where("transactionId", "==", cleanUTR)
      );
      const snap2 = await getDocs(q2);
      return !snap2.empty;
    } catch (err) {
      console.warn("Duplicate UTR check failed (non-critical):", err);
      return false;
    }
  },

  /**
   * Admin records a manual/offline payment for a student.
   * source: "admin" | billingMonth: YYYY-MM format
   */
  async recordPayment(hostelId, { studentUid, studentName, rollNo, amount, transactionId, billingMonth = "", adminEmail = "" }) {
    if (!hostelId || !studentUid) throw new Error("Hostel and student are required.");
    const cleanUTR = (transactionId || `ADM_${Date.now()}`).trim();
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) throw new Error("Amount must be greater than zero.");

    // Duplicate guard
    const isDuplicate = await this.checkDuplicateUTR(hostelId, cleanUTR);
    if (isDuplicate) throw new Error(`Transaction ID "${cleanUTR}" already exists in the ledger.`);

    const paymentId = `PAY_ADM_${Date.now()}`;
    const data = {
      id: paymentId,
      hostelId,
      studentUid,
      studentId: studentUid,
      studentName,
      rollNo,
      amount: numAmount,
      transactionId: cleanUTR,
      utrNumber: cleanUTR, // Unified field — both admin and student use this
      billingMonth: billingMonth || new Date().toISOString().slice(0, 7),
      source: "admin",   // "admin" | "student"
      status: "Verified", // Admin-recorded payments are pre-verified
      notes: "Recorded directly by administrator",
      createdAt: serverTimestamp(),
      verifiedAt: serverTimestamp(),
      verifiedBy: adminEmail || "admin",
      rejectionReason: null
    };
    await setDoc(doc(db, "payments", paymentId), data);

    // Auto-update student feePaid/feeRemaining
    try {
      const studentRef = doc(db, "students", studentUid);
      const stuSnap = await getDoc(studentRef);
      if (stuSnap.exists()) {
        const d = stuSnap.data();
        await updateDoc(studentRef, {
          feeRemaining: Math.max(0, (d.feeRemaining || 0) - numAmount),
          feePaid: (d.feePaid || 0) + numAmount,
          updatedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Could not update student fee balance after admin record:", err);
    }

    return data;
  },

  /**
   * Admin verifies a student-submitted UTR payment.
   * Uses a Firestore transaction to guarantee atomic read→write.
   * All reads must happen BEFORE any writes.
   */
  async verifyPayment(paymentId, studentUid, amount, adminEmail = "", notes = "") {
    return await runTransaction(db, async (transaction) => {
      // --- ALL READS FIRST ---
      const paymentRef = doc(db, "payments", paymentId);
      const paySnap = await transaction.get(paymentRef);
      if (!paySnap.exists()) throw new Error("Payment record not found.");

      const payData = paySnap.data();
      if (payData.status === "Verified") throw new Error("This payment has already been verified.");
      if (payData.status === "Rejected") throw new Error("This payment was rejected. Reopen or create a new record.");

      let studentRef = null;
      let stuSnap = null;
      if (studentUid) {
        studentRef = doc(db, "students", studentUid);
        stuSnap = await transaction.get(studentRef);
      }

      // --- ALL WRITES AFTER ALL READS ---
      transaction.update(paymentRef, {
        status: "Verified",
        verifiedAt: serverTimestamp(),
        verifiedBy: adminEmail || "admin",
        notes: notes || "Verified by administrator"
      });

      if (studentRef && stuSnap && stuSnap.exists()) {
        const currentData = stuSnap.data();
        const currentRemaining = currentData.feeRemaining || 0;
        const currentPaid = currentData.feePaid || 0;
        const numAmount = parseFloat(amount) || 0;
        const newRemaining = Math.max(0, currentRemaining - numAmount);
        const newPaid = currentPaid + numAmount;

        transaction.update(studentRef, {
          feeRemaining: newRemaining,
          feePaid: newPaid,
          updatedAt: serverTimestamp()
        });
      }

      return { success: true, amount: parseFloat(amount) || 0 };
    });
  },

  /**
   * Admin rejects a student-submitted payment with a mandatory reason.
   * This does NOT update fee balance — the payment was not accepted.
   */
  async rejectPayment(paymentId, adminEmail = "", reason = "Payment could not be verified") {
    if (!paymentId) throw new Error("Payment ID is required.");
    if (!reason || reason.trim().length < 3) throw new Error("Please provide a rejection reason (minimum 3 characters).");

    const paymentRef = doc(db, "payments", paymentId);
    const paySnap = await getDoc(paymentRef);
    if (!paySnap.exists()) throw new Error("Payment record not found.");
    if (paySnap.data().status === "Verified") throw new Error("Cannot reject an already verified payment.");

    await updateDoc(paymentRef, {
      status: "Rejected",
      rejectionReason: reason.trim(),
      rejectedBy: adminEmail || "admin",
      rejectedAt: serverTimestamp()
    });
    return true;
  }
};

// ============================================================
// 10. HOSTEL SETTINGS & SEED DATA SERVICE
// ============================================================
export const hostelSettingsService = {
  async getSettings(hostelId) {
    if (!hostelId) return null;
    const snap = await getDoc(doc(db, "hostels", hostelId));
    if (snap.exists()) return snap.data();
    return null;
  },

  async updateSettings(hostelId, updates) {
    await updateDoc(doc(db, "hostels", hostelId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return true;
  },

  /**
   * One-click initial seeder for branches, rooms, and notices
   * Makes the live hostel immediately realistic and operational.
   */
  async seedInitialData(hostelId) {
    if (!hostelId) throw new Error("Hostel ID required");

    // 1. Seed Branches
    const defaultBranches = [
      { code: "CSE", name: "Computer Science & Engineering" },
      { code: "ECE", name: "Electronics & Communication Engineering" },
      { code: "EEE", name: "Electrical & Electronics Engineering" },
      { code: "ME", name: "Mechanical Engineering" },
      { code: "CIVIL", name: "Civil Engineering" },
      { code: "IT", name: "Information Technology" }
    ];
    for (const b of defaultBranches) {
      await branchService.addBranch(hostelId, b);
    }

    // 2. Seed Sample Rooms
    const sampleRooms = [
      { roomNo: "101", capacity: 4, block: "Block A", branchPreference: "CSE" },
      { roomNo: "102", capacity: 4, block: "Block A", branchPreference: "CSE" },
      { roomNo: "103", capacity: 3, block: "Block A", branchPreference: "ECE" },
      { roomNo: "201", capacity: 4, block: "Block B", branchPreference: "All" },
      { roomNo: "202", capacity: 2, block: "Block B", branchPreference: "All" },
      { roomNo: "203", capacity: 3, block: "Block B", branchPreference: "EEE" }
    ];
    for (const r of sampleRooms) {
      await roomService.addRoom(hostelId, r);
    }

    // 3. Seed Sample Announcements
    await announcementService.addAnnouncement(hostelId, {
      title: "Water Pipeline Scheduled Maintenance",
      content: "Maintenance is scheduled today from 02:00 PM to 04:00 PM. Please store adequate water.",
      audience: "All Students"
    });
    await announcementService.addAnnouncement(hostelId, {
      title: "Hostel Warden Room Inspection",
      content: "Mandatory room cleanliness and electrical appliance inspection this Saturday 10:00 AM.",
      audience: "All Students"
    });

    // 4. Update hostel fee configuration defaults
    await this.updateSettings(hostelId, {
      feePerMeal: 50,
      monthlyRent: 2000,
      upiId: "ellora.hostel@upi",
      wardenName: "Chief Warden",
      wardenPhone: "+91 98765 43210"
    });

    return true;
  }
};

// ============================================================
// 11. DASHBOARD ANALYTICS SERVICE
// ============================================================
export const analyticsService = {
  async getMetrics(hostelId) {
    if (!hostelId) {
      return { totalStudents: 0, totalRooms: 0, occupiedRooms: 0, availableRooms: 0, pendingComplaints: 0 };
    }

    const [students, rooms, complaints] = await Promise.all([
      studentService.getStudents(hostelId),
      roomService.getRooms(hostelId),
      complaintService.getComplaints(hostelId)
    ]);

    const totalStudents = students.length;
    const totalRooms = rooms.length;
    let occupiedCount = 0;
    let availableCount = 0;

    rooms.forEach(r => {
      if ((r.occupied || 0) > 0) {
        occupiedCount++;
      }
      if ((r.occupied || 0) < (r.capacity || 4)) {
        availableCount++;
      }
    });

    const pendingComplaints = complaints.filter(c => c.status !== "Resolved").length;

    return {
      totalStudents,
      totalRooms,
      occupiedRooms: occupiedCount,
      availableRooms: availableCount,
      pendingComplaints
    };
  }
};

// ============================================================
// 12. CSV EXPORT SERVICE
// ============================================================
export const exportService = {
  async exportStudentsCSV(hostelId, hostelName = "Hostel") {
    const students = await studentService.getStudents(hostelId);
    const headers = ["Roll No", "Name", "Email", "Branch", "Year", "Room", "Fee Remaining", "Status"];
    const rows = students.map(s => [
      `"${s.rollNo || ''}"`,
      `"${s.name || ''}"`,
      `"${s.email || ''}"`,
      `"${s.branchName || ''}"`,
      `"${s.year || ''}"`,
      `"${s.roomNo || 'Unassigned'}"`,
      `"${s.feeRemaining || 0}"`,
      `"${s.status || 'active'}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${hostelName.replace(/\s+/g, "_")}_Students_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

// ============================================================
// 13. FEE CONFIG SERVICE (Month-specific pricing)
// ============================================================
export const feeService = {
  async getFeeConfig(hostelId, monthStr) {
    if (!hostelId || !monthStr) return { 
      monthlyRent: 2000, 
      costPerMeal: 50,
      breakfastPrice: 30,
      lunchPrice: 50,
      dinnerPrice: 45,
      customMeals: []
    };
    // Normalize month key so both "2026_09" (admin select) and "2026-09"
    // (student <input type="month">) resolve to the same document.
    const cleanMonthStr = String(monthStr).replace(/-/g, "_");
    const docId = `${hostelId}_${cleanMonthStr}`;
    try {
      const snap = await getDoc(doc(db, "fees", docId));
      if (snap.exists()) {
        const data = snap.data();
        return {
          monthlyRent: data.monthlyRent || 2000,
          costPerMeal: data.costPerMeal || 50,
          breakfastPrice: data.breakfastPrice !== undefined ? data.breakfastPrice : 30,
          lunchPrice: data.lunchPrice !== undefined ? data.lunchPrice : 50,
          dinnerPrice: data.dinnerPrice !== undefined ? data.dinnerPrice : 45,
          customMeals: data.customMeals || [],
          monthKey: cleanMonthStr,
          ...data
        };
      }
    } catch (err) {
      console.warn("Fee config fetch warning:", err);
    }
    return { 
      monthlyRent: 2000, 
      costPerMeal: 50,
      breakfastPrice: 30,
      lunchPrice: 50,
      dinnerPrice: 45,
      customMeals: [],
      monthKey: cleanMonthStr 
    };
  },

  async saveFeeConfig(hostelId, monthStr, monthlyRent, costPerMeal, detailedPrices = {}) {
    if (!hostelId || !monthStr) throw new Error("Hostel ID and Month are required");
    const cleanMonthStr = String(monthStr).replace(/-/g, "_");
    const docId = `${hostelId}_${cleanMonthStr}`;
    const data = {
      id: docId,
      hostelId,
      monthKey: cleanMonthStr,
      monthlyRent: Number(monthlyRent) || 0,
      costPerMeal: Number(costPerMeal) || 0,
      breakfastPrice: detailedPrices.breakfastPrice !== undefined ? Number(detailedPrices.breakfastPrice) : 30,
      lunchPrice: detailedPrices.lunchPrice !== undefined ? Number(detailedPrices.lunchPrice) : 50,
      dinnerPrice: detailedPrices.dinnerPrice !== undefined ? Number(detailedPrices.dinnerPrice) : 45,
      customMeals: detailedPrices.customMeals || [],
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, "fees", docId), data, { merge: true });
    return data;
  },

  async finalizeMonthlyFees(hostelId, monthKey) {
    if (!hostelId || !monthKey) return;
    const cleanMonthKey = String(monthKey).replace(/-/g, "_");
    const formattedMonthHyphen = cleanMonthKey.replace("_", "-");

    const feeConfig = await this.getFeeConfig(hostelId, cleanMonthKey);
    const students = await studentService.getStudents(hostelId);

    for (const student of students) {
      const studentUid = student.uid || student.id;
      
      // Skip fee generation for months prior to student joining date
      const joiningMonth = student.joiningMonth ? String(student.joiningMonth).replace(/_/g, "-").substring(0, 7) : "";
      const currentMonthKey = formattedMonthHyphen.substring(0, 7);
      if (joiningMonth && currentMonthKey < joiningMonth) {
        continue;
      }

      const { records } = await studentPortalService.getStudentAttendance(studentUid, hostelId, { monthStr: formattedMonthHyphen, meal: "All" });

      let bfCount = 0;
      let lunchCount = 0;
      let dinnerCount = 0;
      let customMealsCount = 0;
      let customMealsCost = 0;

      const customMealPriceMap = {};
      if (feeConfig.customMeals && Array.isArray(feeConfig.customMeals)) {
        feeConfig.customMeals.forEach(cm => {
          if (cm && cm.name) {
            customMealPriceMap[cm.name.toLowerCase()] = Number(cm.price) || 0;
          }
        });
      }

      records.forEach(r => {
        if (r.isPresent) {
          if (r.meal === "Breakfast") bfCount++;
          else if (r.meal === "Lunch") lunchCount++;
          else if (r.meal === "Dinner") dinnerCount++;
          else {
            customMealsCount++;
            const mealLower = (r.meal || "").toLowerCase();
            const price = customMealPriceMap[mealLower] || 0;
            customMealsCost += price;
          }
        }
      });

      const rent = Number(feeConfig.monthlyRent) || 2000;
      const bfPrice = feeConfig.breakfastPrice !== undefined ? Number(feeConfig.breakfastPrice) : 30;
      const lunchPrice = feeConfig.lunchPrice !== undefined ? Number(feeConfig.lunchPrice) : 50;
      const dinnerPrice = feeConfig.dinnerPrice !== undefined ? Number(feeConfig.dinnerPrice) : 45;

      const bfCost = bfCount * bfPrice;
      const lunchCost = lunchCount * lunchPrice;
      const dinnerCost = dinnerCount * dinnerPrice;

      const total = rent + bfCost + lunchCost + dinnerCost + customMealsCost;

      const payments = await studentPortalService.getStudentPayments(studentUid, hostelId);
      let paid = 0;
      payments.forEach(p => {
        if (p.status === "Verified" || p.status === "Approved") {
          paid += Number(p.amount) || 0;
        }
      });

      const net = Math.max(0, total - paid);

      const docId = `${hostelId}_${studentUid}_${cleanMonthKey}`;
      const finalizedDoc = {
        id: docId,
        hostelId,
        studentUid,
        rollNo: student.rollNo || "",
        studentName: student.name || "",
        monthKey: cleanMonthKey,
        monthlyRent: rent,
        bfCount,
        bfPrice,
        breakfastCost: bfCost,
        lunchCount,
        lunchPrice,
        lunchCost,
        dinnerCount,
        dinnerPrice,
        dinnerCost,
        customMealsCount,
        customMealsCost,
        totalAmount: total,
        paidAmount: paid,
        pendingAmount: net,
        isFinalized: true,
        isPublished: true,
        publishedAt: serverTimestamp(),
        finalizedAt: serverTimestamp()
      };

      await setDoc(doc(db, "finalizedFees", docId), finalizedDoc);
    }
  }
};

// ============================================================
// 14. PAYMENT SETTINGS & QR UPLOAD SERVICE
// ============================================================
export const paymentSettingsService = {
  async uploadQR(hostelId, file) {
    if (!hostelId || !file) throw new Error("Hostel ID and image file are required.");
    
    let qrUrl = "";
    if (storage) {
      try {
        const qrRef = ref(storage, `qr/${hostelId}/payment_qr_${Date.now()}.${file.name.split('.').pop()}`);
        const snapshot = await uploadBytes(qrRef, file);
        qrUrl = await getDownloadURL(snapshot.ref);
      } catch (err) {
        console.warn("Firebase Storage upload failed/denied, falling back to Data URL:", err);
      }
    }

    if (!qrUrl) {
      // Fallback Data URL (base64) so QR upload always succeeds
      qrUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Failed to read QR image file."));
        reader.readAsDataURL(file);
      });
    }

    await setDoc(doc(db, "hostels", hostelId), {
      qrUrl,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return qrUrl;
  }
};

// ============================================================
// 15. STUDENT PORTAL SERVICE (Hostel Isolated & UID Auth Scoped)
// ============================================================
export const studentPortalService = {
  /**
   * Fetches authentic student profile from students/{uid}
   */
  async getStudentProfile(studentUid) {
    if (!studentUid) return null;
    try {
      const snap = await getDoc(doc(db, "students", studentUid));
      if (!snap.exists()) return null;
      const data = snap.data();
      
      // Resolve hostel name
      let hostelName = "Unknown Hostel";
      if (data.hostelId) {
        const hSnap = await getDoc(doc(db, "hostels", data.hostelId));
        if (hSnap.exists()) hostelName = hSnap.data().name || hSnap.data().title || "Hostel";
      }

      // Resolve branch name if branchId exists
      let branchName = data.branchName || data.branch || "General";
      if (data.branchId) {
        const bSnap = await getDoc(doc(db, "branches", data.branchId));
        if (bSnap.exists()) branchName = bSnap.data().name || bSnap.data().code || branchName;
      }

      return {
        uid: studentUid,
        id: studentUid,
        rollNo: data.rollNo || "--",
        name: data.name || data.fullName || `Student (${data.rollNo || ''})`,
        email: data.email || `${(data.rollNo || 'student').toLowerCase()}@hostel.local`,
        branchId: data.branchId || "",
        branchName,
        year: data.year || "1st Year",
        joiningMonth: data.joiningMonth || "",
        hostelId: data.hostelId || "",
        hostelName,
        status: data.status || "active",
        role: "student",
        roomNo: data.roomNo || "Unassigned",
        createdAt: data.createdAt
      };
    } catch (err) {
      console.error("Error fetching student profile:", err);
      return null;
    }
  },

  /**
   * Fetches allotted room info and roommates
   */
  async getStudentRoom(studentUid, hostelId) {
    if (!hostelId || !studentUid) return null;
    try {
      const q = query(collection(db, "rooms"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      let allottedRoom = null;
      
      snap.forEach(d => {
        const r = d.data();
        const studentIds = r.studentIds || [];
        if (studentIds.includes(studentUid)) {
          allottedRoom = { id: d.id, ...r };
        }
      });

      if (!allottedRoom) return null;

      // Fetch roommates
      const roommates = [];
      if (allottedRoom.studentIds && allottedRoom.studentIds.length > 0) {
        for (const sUid of allottedRoom.studentIds) {
          if (sUid !== studentUid) {
            const sSnap = await getDoc(doc(db, "students", sUid));
            if (sSnap.exists()) {
              const sData = sSnap.data();
              roommates.push({
                name: sData.name || sData.rollNo,
                rollNo: sData.rollNo,
                branch: sData.branchName || sData.branch || ""
              });
            }
          }
        }
      }

      return {
        ...allottedRoom,
        roommates
      };
    } catch (err) {
      console.error("Error fetching student room:", err);
      return null;
    }
  },

  /**
   * Fetches attendance records for the student
   */
  async getStudentAttendance(studentUid, hostelId, { monthStr = "", meal = "All" } = {}) {
    if (!hostelId || !studentUid) return { records: [], summary: { total: 0, present: 0, absent: 0, rate: 0 } };
    try {
      const studentSnap = await getDoc(doc(db, "students", studentUid));
      const rollNo = studentSnap.exists() ? studentSnap.data().rollNo : null;

      const q = query(collection(db, "attendance"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      const records = [];

      snap.forEach(d => {
        const att = d.data();
        if (monthStr) {
          const formattedMonth = monthStr.replace(/_/g, "-");
          if (!att.date.startsWith(formattedMonth)) return;
        }
        if (meal && meal !== "All" && att.meal !== meal) return;

        const isPresent = (att.presentStudentUids || []).includes(studentUid);
        records.push({
          date: att.date,
          meal: att.meal,
          isPresent,
          mealCost: att.mealCost || 0
        });
      });

      records.sort((a, b) => b.date.localeCompare(a.date));

      const total = records.length;
      const present = records.filter(r => r.isPresent).length;
      const absent = total - present;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        records,
        summary: { total, present, absent, rate }
      };
    } catch (err) {
      console.error("Error fetching student attendance:", err);
      return { records: [], summary: { total: 0, present: 0, absent: 0, rate: 0 } };
    }
  },

  /**
   * Calculates monthly fee dues using applicable fee config and recorded attendance.
   * Student portal ONLY reads published/finalized fee records from database.
   * Unpublished months return notPublishedYet state so live attendance does NOT alter fees.
   */
  async calculateStudentFeeDues(studentUid, hostelId, monthStr, { allowUnpublished = false } = {}) {
    if (!hostelId || !studentUid || !monthStr) {
      return { monthlyRent: 0, breakfastCost: 0, lunchCost: 0, dinnerCost: 0, customMealsCost: 0, total: 0, paid: 0, net: 0, bfCount: 0, lunchCount: 0, dinnerCount: 0, customMealsCount: 0, isFinalized: false, isPublished: false };
    }
    try {
      const cleanMonthKey = String(monthStr).replace(/-/g, "_");
      const formattedMonthHyphen = cleanMonthKey.replace("_", "-");

      // Check student joining month first
      const studentProfile = await this.getStudentProfile(studentUid);
      const joiningMonth = studentProfile?.joiningMonth ? String(studentProfile.joiningMonth).replace(/_/g, "-").substring(0, 7) : "";
      const targetMonthKey = formattedMonthHyphen.substring(0, 7);

      if (joiningMonth && targetMonthKey < joiningMonth) {
        return {
          monthlyRent: 0,
          breakfastCost: 0,
          lunchCost: 0,
          dinnerCost: 0,
          customMealsCost: 0,
          total: 0,
          paid: 0,
          net: 0,
          bfCount: 0,
          lunchCount: 0,
          dinnerCount: 0,
          customMealsCount: 0,
          isFinalized: false,
          isPublished: false,
          notJoinedYet: true,
          joiningMonth
        };
      }

      // Fetch all verified payments for student up to now
      const payments = await this.getStudentPayments(studentUid, hostelId);
      let paid = 0;
      payments.forEach(p => {
        if (p.status === "Verified" || p.status === "Approved") {
          paid += Number(p.amount) || 0;
        }
      });

      // 1. Check if finalized/published snapshot exists in database
      const finDocId = `${hostelId}_${studentUid}_${cleanMonthKey}`;
      const finSnap = await getDoc(doc(db, "finalizedFees", finDocId));

      if (finSnap.exists()) {
        const finData = finSnap.data();
        const total = Number(finData.totalAmount) || 0;
        const net = Math.max(0, total - paid);
        return {
          monthlyRent: finData.monthlyRent || 0,
          breakfastCost: finData.breakfastCost || 0,
          lunchCost: finData.lunchCost || 0,
          dinnerCost: finData.dinnerCost || 0,
          customMealsCost: finData.customMealsCost || 0,
          total: total,
          paid: paid,
          net: net,
          bfCount: finData.bfCount || 0,
          lunchCount: finData.lunchCount || 0,
          dinnerCount: finData.dinnerCount || 0,
          customMealsCount: finData.customMealsCount || 0,
          isFinalized: true,
          isPublished: true,
          finalizedAt: finData.finalizedAt
        };
      }

      // If month is NOT published yet and call is from Student Portal (allowUnpublished = false):
      if (!allowUnpublished) {
        return {
          monthlyRent: 0,
          breakfastCost: 0,
          lunchCost: 0,
          dinnerCost: 0,
          customMealsCost: 0,
          total: 0,
          paid: paid,
          net: 0,
          bfCount: 0,
          lunchCount: 0,
          dinnerCount: 0,
          customMealsCount: 0,
          isFinalized: false,
          isPublished: false,
          notPublishedYet: true,
          message: `Fee statement for ${formattedMonthHyphen} has not been published yet.`
        };
      }

      // Allow unpublished calculation ONLY for Admin preview:
      const feeConfig = await feeService.getFeeConfig(hostelId, cleanMonthKey);
      const { records } = await this.getStudentAttendance(studentUid, hostelId, { monthStr: formattedMonthHyphen, meal: "All" });

      let bfCount = 0;
      let lunchCount = 0;
      let dinnerCount = 0;
      let customMealsCount = 0;
      let customMealsCost = 0;

      const customMealPriceMap = {};
      if (feeConfig.customMeals && Array.isArray(feeConfig.customMeals)) {
        feeConfig.customMeals.forEach(cm => {
          if (cm && cm.name) {
            customMealPriceMap[cm.name.toLowerCase()] = Number(cm.price) || 0;
          }
        });
      }

      records.forEach(r => {
        if (r.isPresent) {
          if (r.meal === "Breakfast") bfCount++;
          else if (r.meal === "Lunch") lunchCount++;
          else if (r.meal === "Dinner") dinnerCount++;
          else {
            customMealsCount++;
            const mealLower = (r.meal || "").toLowerCase();
            const price = customMealPriceMap[mealLower] || 0;
            customMealsCost += price;
          }
        }
      });

      const rent = feeConfig.monthlyRent || 2000;
      const bfCost = bfCount * (feeConfig.breakfastPrice !== undefined ? feeConfig.breakfastPrice : 30);
      const lunchCost = lunchCount * (feeConfig.lunchPrice !== undefined ? feeConfig.lunchPrice : 50);
      const dinnerCost = dinnerCount * (feeConfig.dinnerPrice !== undefined ? feeConfig.dinnerPrice : 45);

      const total = rent + bfCost + lunchCost + dinnerCost + customMealsCost;
      const net = Math.max(0, total - paid);

      return {
        monthlyRent: rent,
        breakfastCost: bfCost,
        lunchCost,
        dinnerCost,
        customMealsCost,
        total,
        paid,
        net,
        bfCount,
        lunchCount,
        dinnerCount,
        customMealsCount,
        isFinalized: isOverallFinalized
      };
    } catch (err) {
      console.error("Error calculating student fee dues:", err);
      return { monthlyRent: 0, breakfastCost: 0, lunchCost: 0, dinnerCost: 0, customMealsCost: 0, total: 0, paid: 0, net: 0, bfCount: 0, lunchCount: 0, dinnerCount: 0, customMealsCount: 0, isFinalized: false };
    }
  },

  /**
   * Fetches payment records submitted by the student
   */
  async getStudentPayments(studentUid, hostelId) {
    if (!hostelId || !studentUid) return [];
    try {
      const q = query(
        collection(db, "payments"),
        where("hostelId", "==", hostelId),
        where("studentUid", "==", studentUid)
      );
      const snap = await getDocs(q);
      const payments = [];
      snap.forEach(d => {
        const p = d.data();
        payments.push({ id: d.id, ...p });
      });
      return payments.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (err) {
      console.error("Error fetching student payments:", err);
      return [];
    }
  },

  /**
   * Submits a new payment reference (UTR)
   */
  async submitStudentPayment(hostelId, studentUid, rollNo, { amount, utrNumber, paymentDate, remarks, billingMonth = "" }) {
    if (!hostelId || !studentUid) throw new Error("Missing payment submission parameters.");
    const cleanUTR = (utrNumber || "").trim();
    if (!cleanUTR) throw new Error("Transaction / UTR reference number is required.");

    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) throw new Error("Payment amount must be greater than zero.");

    // Duplicate UTR guard — prevents the same receipt being submitted twice
    const isDuplicate = await paymentService.checkDuplicateUTR(hostelId, cleanUTR);
    if (isDuplicate) throw new Error(`UTR "${cleanUTR}" has already been submitted. Contact the warden if this is an error.`);

    // Fetch student name for the ledger
    let studentName = rollNo || "Student";
    try {
      const sSnap = await getDoc(doc(db, "students", studentUid));
      if (sSnap.exists()) studentName = sSnap.data().name || sSnap.data().rollNo || rollNo;
    } catch (_) {}

    const paymentId = `PAY_STU_${Date.now()}`;
    const paymentData = {
      id: paymentId,
      hostelId,
      studentUid,
      studentId: studentUid,
      studentName,
      rollNo: rollNo || "",
      amount: numAmount,
      utrNumber: cleanUTR,
      transactionId: cleanUTR, // Unified field — admin ledger uses this too
      date: paymentDate || new Date().toISOString().slice(0, 10),
      billingMonth: billingMonth || new Date().toISOString().slice(0, 7),
      remarks: (remarks || "Fee Payment").trim(),
      source: "student",  // "admin" | "student"
      status: "Pending Verification", // Pending Verification | Verified | Rejected
      createdAt: serverTimestamp(),
      verifiedAt: null,
      verifiedBy: null,
      rejectionReason: null,
      rejectedBy: null
    };

    await setDoc(doc(db, "payments", paymentId), paymentData);
    return paymentData;
  },

  /**
   * Fetches complaints raised by the student
   */
  async getStudentComplaints(studentUid, hostelId) {
    if (!hostelId || !studentUid) return [];
    try {
      const q = query(
        collection(db, "complaints"),
        where("hostelId", "==", hostelId),
        where("studentUid", "==", studentUid)
      );
      const snap = await getDocs(q);
      const complaints = [];
      snap.forEach(d => {
        const c = d.data();
        complaints.push({ id: d.id, ...c });
      });
      return complaints.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (err) {
      console.error("Error fetching student complaints:", err);
      return [];
    }
  },

  /**
   * Submits a new complaint ticket
   */
  async submitStudentComplaint(hostelId, studentUid, rollNo, studentName, roomNo, { category, description }) {
    if (!hostelId || !studentUid || !description) throw new Error("Description is required.");
    
    const complaintId = `CMP_${Date.now()}`;
    const complaintData = {
      id: complaintId,
      hostelId,
      studentUid,
      studentId: studentUid,
      studentName: studentName || rollNo,
      rollNo: rollNo || "",
      roomNo: roomNo || "Unassigned",
      category: category || "General",
      description: description.trim(),
      status: "Pending", // Pending | In Progress | Resolved | Rejected
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, "complaints", complaintId), complaintData);
    return complaintData;
  },

  /**
   * Fetches mess menu for student's hostel
   */
  async getStudentMess(hostelId) {
    if (!hostelId) return null;
    // Primary source: messSchedule stored on the hostels/{hostelId} document,
    // which is exactly where the admin's messService.saveMessTimetable writes.
    try {
      const snap = await getDoc(doc(db, "hostels", hostelId));
      if (snap.exists() && snap.data().messSchedule) {
        return snap.data().messSchedule;
      }
    } catch (err) {
      console.error("Error fetching mess menu:", err);
    }
    // Backward-compatible fallback to a standalone mess collection.
    try {
      const snap = await getDoc(doc(db, "mess", hostelId));
      if (snap.exists()) return snap.data();
    } catch (err) {
      console.error("Error fetching legacy mess menu:", err);
    }
    return null;
  },

  /**
   * Fetches hostel announcements
   */
  async getStudentAnnouncements(hostelId) {
    if (!hostelId) return [];
    try {
      const q = query(collection(db, "announcements"), where("hostelId", "==", hostelId));
      const snap = await getDocs(q);
      const announcements = [];
      snap.forEach(d => announcements.push({ id: d.id, ...d.data() }));
      return announcements.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    } catch (err) {
      console.error("Error fetching announcements:", err);
      return [];
    }
  }
};

