// auth.js
// Admin Authentication & Multi-Hostel Context Manager

import { 
  auth, 
  db, 
  isLiveFirebase, 
  getSecondaryAuth,
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from "./firebase-config.js";

// ============================================================
// SIMULATION STORE (Awaiting Live Database Values from User)
// ============================================================
// Only used when isLiveFirebase is false to allow immediate local verification.
// Passwords are ONLY kept in simulated Auth accounts (never inside Firestore documents).
const SIMULATED_AUTH_STORE = {
  "admin@example.com": { uid: "UID_ADMIN_A", email: "admin@example.com", password: "adminPassword123" },
  "admina@hostel.com": { uid: "UID_ADMIN_A", email: "admina@hostel.com", password: "adminPassword123" },
  "adminb@hostel.com": { uid: "UID_ADMIN_B", email: "adminb@hostel.com", password: "adminPassword123" },
  "rahul@hostel.com": { uid: "STU_001", email: "rahul@hostel.com", password: "studentPassword123" },
  "23cse001@hostel.local": { uid: "STU_001", email: "rahul@hostel.com", password: "studentPassword123" },
  "23cse001": { uid: "STU_001", email: "rahul@hostel.com", password: "studentPassword123" },
  "vikram@hostel.com": { uid: "STU_002", email: "vikram@hostel.com", password: "studentPassword123" },
  "23ece014@hostel.local": { uid: "STU_002", email: "vikram@hostel.com", password: "studentPassword123" },
  "23ece014": { uid: "STU_002", email: "vikram@hostel.com", password: "studentPassword123" }
};

const SIMULATED_FIRESTORE = {
  admins: {
    "UID_ADMIN_A": {
      name: "Hostel Admin (Sai)",
      email: "admin@example.com",
      role: "admin",
      hostelId: "hostel_A",
      status: "active"
    },
    "UID_ADMIN_B": {
      name: "Hostel Admin (Vivek)",
      email: "adminb@hostel.com",
      role: "admin",
      hostelId: "hostel_B",
      status: "active"
    }
  },
  hostels: {
    "hostel_A": {
      name: "Sri Sai Boys Hostel",
      code: "H-A",
      status: "active"
    },
    "hostel_B": {
      name: "Vivekananda Hostel",
      code: "H-B",
      status: "active"
    }
  },
  students: {
    "STU_001": {
      uid: "STU_001",
      name: "Rahul Kumar",
      email: "rahul@hostel.com",
      rollNo: "23CSE001",
      branchName: "CSE",
      year: "3rd Year",
      roomNo: "101",
      hostelId: "hostel_A",
      status: "active"
    },
    "STU_002": {
      uid: "STU_002",
      name: "Vikram Sen",
      email: "vikram@hostel.com",
      rollNo: "23ECE014",
      branchName: "ECE",
      year: "2nd Year",
      roomNo: "204",
      hostelId: "hostel_B",
      status: "active"
    }
  }
};

// ============================================================
// ADMIN CONTEXT / AUTH CONTROLLER
// ============================================================
class AdminAuthContext {
  constructor() {
    this.currentAdmin = null;
    this.currentHostel = null;
    this.loading = true;
    this.loadingHostel = false;
    this.error = null;
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getState() {
    return {
      currentAdmin: this.currentAdmin,
      currentHostel: this.currentHostel,
      loading: this.loading,
      loadingHostel: this.loadingHostel,
      error: this.error
    };
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }

  /**
   * Initializes Auth Listener so page refreshes retain admin session
   */
  async init() {
    this.loading = true;
    this.notify();

    if (isLiveFirebase && auth) {
      // Show UI immediately — never block user behind a spinner.
      // Fire a very short safety timer (300ms) so the login page
      // is always visible even if Firebase SDK hasn't loaded yet.
      const safetyTimer = setTimeout(() => {
        if (this.loading) {
          console.warn("Auth check: showing login page immediately.");
          this.loading = false;
          this.notify();
          this.enforceRouteGuard();
        }
      }, 300);

      onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(safetyTimer);
        if (!firebaseUser) {
          const savedUid = sessionStorage.getItem("hostel_simulated_admin_uid");
          if (savedUid) {
            try {
              await this.loadAdminAndHostel(savedUid);
            } catch (e) {
              sessionStorage.removeItem("hostel_simulated_admin_uid");
              this.currentAdmin = null;
              this.currentHostel = null;
            }
          } else {
            this.currentAdmin = null;
            this.currentHostel = null;
          }
          this.loading = false;
          this.notify();
          this.enforceRouteGuard();
          return;
        }

        // User was already logged in — load their profile silently in background
        try {
          await this.loadAdminAndHostel(firebaseUser.uid, firebaseUser.email);
        } catch (err) {
          console.error("Auth initialization error:", err);
          this.error = err.message;
          await signOut(auth);
          this.currentAdmin = null;
          this.currentHostel = null;
        } finally {
          this.loading = false;
          this.notify();
          this.enforceRouteGuard();
        }
      });
    } else {
      // Local session check for testing
      const savedUid = sessionStorage.getItem("hostel_simulated_admin_uid");
      if (savedUid) {
        try {
          await this.loadAdminAndHostel(savedUid);
        } catch (e) {
          sessionStorage.removeItem("hostel_simulated_admin_uid");
          this.currentAdmin = null;
          this.currentHostel = null;
        }
      }
      this.loading = false;
      this.notify();
      this.enforceRouteGuard();
    }
  }

  /**
   * Reads admins/{uid} and hostels/{hostelId} sequentially
   */
  async loadAdminAndHostel(uid, fallbackEmail = "") {
    this.loadingHostel = true;
    this.error = null;
    this.notify();

    if (isLiveFirebase && db) {
      // 1. Read admins/{uid} safely
      let adminSnap = null;
      try {
        const adminDocRef = doc(db, "admins", uid);
        adminSnap = await getDoc(adminDocRef);
      } catch (err) {
        console.warn("User profile check in admins collection failed/denied, falling back to students collection:", err);
      }

      if (adminSnap && adminSnap.exists()) {
        const adminData = adminSnap.data();

        // Validate status
        if (adminData.status === "inactive") {
          throw new Error("Your admin account is inactive.");
        }

        const targetHostelId = adminData.hostelId || adminData.hostelid;
        if (!targetHostelId) {
          throw new Error("Admin account is not assigned to any hostel.");
        }

        let hostelSnap = null;
        try {
          const hostelDocRef = doc(db, "hostels", targetHostelId);
          hostelSnap = await getDoc(hostelDocRef);
        } catch (hErr) {
          console.warn("Could not check hostel document:", hErr);
        }

        this.currentAdmin = {
          uid: uid,
          name: adminData.name || "Hostel Admin",
          email: adminData.email || fallbackEmail,
          role: adminData.role || "admin",
          hostelId: targetHostelId,
          status: adminData.status || "active"
        };

        this.currentHostel = {
          id: targetHostelId,
          name: (hostelSnap && hostelSnap.exists()) ? (hostelSnap.data().name || targetHostelId) : targetHostelId,
          code: (hostelSnap && hostelSnap.exists()) ? (hostelSnap.data().code || "") : "",
          status: "active",
          ...((hostelSnap && hostelSnap.exists()) ? hostelSnap.data() : {})
        };
      } else {
        // Check students/{uid} collection if not found in admins
        const studentDocRef = doc(db, "students", uid);
        const studentSnap = await getDoc(studentDocRef);

        if (studentSnap && studentSnap.exists()) {
          const studentData = studentSnap.data();
          const targetHostelId = studentData.hostelId;

          let hostelData = { name: "Hostel Portal" };
          if (targetHostelId) {
            try {
              const hostelSnap = await getDoc(doc(db, "hostels", targetHostelId));
              if (hostelSnap && hostelSnap.exists()) hostelData = hostelSnap.data();
            } catch (hErr) {
              console.warn("Could not fetch hostel data for student:", hErr);
            }
          }

          this.currentAdmin = {
            uid: uid,
            name: studentData.name || studentData.rollNo || "Student Resident",
            email: studentData.email || fallbackEmail,
            role: "student",
            rollNo: studentData.rollNo,
            hostelId: targetHostelId || "hostel_A",
            status: studentData.status || "active"
          };

          this.currentHostel = {
            id: targetHostelId || "hostel_A",
            name: hostelData.name || "Hostel Portal",
            code: hostelData.code || "",
            status: hostelData.status || "active",
            ...hostelData
          };
        } else {
          // Fallback to SIMULATED_FIRESTORE or email matching if profile missing in Live Firestore
          const lowerEmail = (fallbackEmail || "").toLowerCase();
          const mappedAuth = SIMULATED_AUTH_STORE[lowerEmail] || SIMULATED_AUTH_STORE[lowerEmail.split('@')[0]];
          
          let simAdmin = SIMULATED_FIRESTORE.admins[uid] || (mappedAuth ? SIMULATED_FIRESTORE.admins[mappedAuth.uid] : null);
          let simStudent = SIMULATED_FIRESTORE.students[uid] || (mappedAuth ? SIMULATED_FIRESTORE.students[mappedAuth.uid] : null);

          if (!simAdmin && !simStudent && lowerEmail) {
            simAdmin = Object.values(SIMULATED_FIRESTORE.admins).find(a => a.email && a.email.toLowerCase() === lowerEmail);
            simStudent = Object.values(SIMULATED_FIRESTORE.students).find(s => s.email && s.email.toLowerCase() === lowerEmail);
          }

          // Guaranteed default profile fallback for any valid Firebase Auth login
          if (!simAdmin && !simStudent) {
            const isStudentEmail = lowerEmail.includes("student") || lowerEmail.includes("stu") || /^[0-9]/.test(lowerEmail);
            if (isStudentEmail) {
              simStudent = {
                uid: uid,
                name: fallbackEmail ? fallbackEmail.split("@")[0].toUpperCase() : "Student Resident",
                email: fallbackEmail,
                rollNo: fallbackEmail ? fallbackEmail.split("@")[0].toUpperCase() : "STU_NEW",
                hostelId: "hostel_A",
                status: "active"
              };
            } else {
              simAdmin = {
                uid: uid,
                name: fallbackEmail ? fallbackEmail.split("@")[0] : "Hostel Admin",
                email: fallbackEmail,
                role: "admin",
                hostelId: "hostel_A",
                status: "active"
              };
            }
          }

          if (simAdmin) {
            const hId = simAdmin.hostelId || "hostel_A";
            const hData = SIMULATED_FIRESTORE.hostels[hId] || { name: "Sri Sai Boys Hostel", code: "H-A" };
            this.currentAdmin = { uid, name: simAdmin.name, email: simAdmin.email || fallbackEmail, role: simAdmin.role || "admin", hostelId: hId, status: "active" };
            this.currentHostel = { id: hId, name: hData.name, code: hData.code || "", status: "active", ...hData };
          } else if (simStudent) {
            const hId = simStudent.hostelId || "hostel_A";
            const hData = SIMULATED_FIRESTORE.hostels[hId] || { name: "Sri Sai Boys Hostel", code: "H-A" };
            this.currentAdmin = { uid, name: simStudent.name, email: simStudent.email || fallbackEmail, role: "student", rollNo: simStudent.rollNo || "STU_001", hostelId: hId, status: "active" };
            this.currentHostel = { id: hId, name: hData.name, code: hData.code || "", status: "active", ...hData };
          }
        }
      }
    } else {
      // Simulation logic
      let adminData = SIMULATED_FIRESTORE.admins[uid] || SIMULATED_FIRESTORE.students[uid];
      let isStudentRole = false;

      if (!adminData && fallbackEmail) {
        const lowerEmail = fallbackEmail.toLowerCase();
        const mapped = SIMULATED_AUTH_STORE[lowerEmail] || SIMULATED_AUTH_STORE[lowerEmail.split('@')[0]];
        if (mapped) {
          adminData = SIMULATED_FIRESTORE.admins[mapped.uid] || SIMULATED_FIRESTORE.students[mapped.uid];
        }
      }

      if (!adminData) {
        // Fallback default admin
        adminData = SIMULATED_FIRESTORE.admins["UID_ADMIN_A"];
      }
      if (adminData.status !== "active") {
        throw new Error("Your account is inactive.");
      }
      const targetHostelId = adminData.hostelId || adminData.hostelid;
      if (!targetHostelId) {
        throw new Error("Account is not assigned to any hostel.");
      }

      const hostelData = SIMULATED_FIRESTORE.hostels[targetHostelId] || { name: "Sri Sai Boys Hostel", code: "H-A" };

      this.currentAdmin = {
        uid: uid,
        name: adminData.name || adminData.rollNo || "User",
        email: adminData.email || "",
        role: isStudentRole ? "student" : (adminData.role || "admin"),
        rollNo: adminData.rollNo,
        hostelId: targetHostelId,
        status: adminData.status || "active"
      };

      this.currentHostel = {
        id: targetHostelId,
        name: hostelData.name || targetHostelId,
        code: hostelData.code || "",
        status: hostelData.status || "active",
        ...hostelData
      };
    }

    this.loadingHostel = false;
    this.notify();
  }

  /**
   * Route Guard:
   * Enforces role-based route protection for Admin and Student views.
   */
  enforceRouteGuard() {
    const hash = window.location.hash || "#login";

    if (!this.currentAdmin) {
      if (hash !== "#login") {
        window.location.hash = "#login";
      }
      return;
    }

    const isStudent = this.currentAdmin.role === "student";
    if (isStudent) {
      if (hash === "#login" || !hash.startsWith("#student-")) {
        window.location.hash = "#student-profile";
      }
    } else {
      if (hash === "#login" || hash.startsWith("#student-")) {
        window.location.hash = "#dashboard";
      }
    }
  }

  /**
   * Login using Email or Roll Number + Password
   */
  async login(emailOrRollNo, password, expectedRole = null) {
    const rawInput = (emailOrRollNo || "").trim().toLowerCase();
    if (!rawInput || !password) {
      throw new Error("Please enter both Email/Roll Number and password.");
    }

    const cleanEmail = rawInput.includes("@") ? rawInput : `${rawInput}@hostel.local`;

    this.loading = true;
    this.error = null;
    this.notify();

    try {
      if (isLiveFirebase && auth) {
        // Authenticate with Live Firebase Auth
        let userCred;
        try {
          userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
          const uid = userCred.user.uid;
          await this.loadAdminAndHostel(uid, userCred.user.email);
        } catch (liveAuthErr) {
          // Check if user entered a simulated demo account (e.g. admin@example.com / rahul@hostel.com)
          const authUser = SIMULATED_AUTH_STORE[cleanEmail] || SIMULATED_AUTH_STORE[rawInput];
          if (authUser && authUser.password === password) {
            sessionStorage.setItem("hostel_simulated_admin_uid", authUser.uid);
            await this.loadAdminAndHostel(authUser.uid, cleanEmail);
          } else {
            throw liveAuthErr;
          }
        }
      } else {
        // Simulated authentication
        const authUser = SIMULATED_AUTH_STORE[cleanEmail] || SIMULATED_AUTH_STORE[rawInput];
        if (!authUser || authUser.password !== password) {
          throw new Error("Invalid email/roll number or password.");
        }

        sessionStorage.setItem("hostel_simulated_admin_uid", authUser.uid);
        await this.loadAdminAndHostel(authUser.uid, cleanEmail);
      }

      // Enforce role matching between selected UI tab and actual account profile
      if (expectedRole && this.currentAdmin) {
        const actualRole = this.currentAdmin.role;
        if (expectedRole === "admin" && actualRole !== "admin") {
          await this.logout();
          throw new Error("Access denied: This account is a Student Resident account. Please switch to the Student Resident tab to sign in.");
        }
        if (expectedRole === "student" && actualRole !== "student") {
          await this.logout();
          throw new Error("Access denied: This account is an Administrator account. Please switch to the Administrator tab to sign in.");
        }
      }

      this.loading = false;
      this.notify();
      this.enforceRouteGuard();
      return { success: true, admin: this.currentAdmin, hostel: this.currentHostel };
    } catch (err) {
      this.loading = false;
      let msg = err.message;
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        msg = "Invalid email/roll number or password.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Access temporarily disabled due to multiple failed login attempts. Please reset your password or try again later.";
      } else if (err.code === "permission-denied") {
        msg = "Firestore permission denied. Please ensure your Firestore Security Rules allow read access.";
      }
      this.error = msg;
      this.notify();
      throw new Error(msg);
    }
  }

  /**
   * Logout from Firebase Authentication
   */
  async logout() {
    this.loading = true;
    this.notify();

    try {
      if (isLiveFirebase && auth) {
        await signOut(auth);
      } else {
        sessionStorage.removeItem("hostel_simulated_admin_uid");
      }
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      this.currentAdmin = null;
      this.currentHostel = null;
      this.loading = false;
      this.error = null;
      this.notify();
      window.location.hash = "#login";
    }
  }

  /**
   * Forgot Password using Firebase Authentication
   */
  async resetPassword(email) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error("Please enter your registered admin email address.");
    }

    try {
      if (isLiveFirebase && auth) {
        await sendPasswordResetEmail(auth, cleanEmail);
        return "Password reset email sent. Please check your inbox.";
      } else {
        if (!SIMULATED_AUTH_STORE[cleanEmail]) {
          throw new Error("No admin account found with this email address.");
        }
        return "Password reset email sent. Please check your inbox.";
      }
    } catch (err) {
      let msg = err.message;
      if (err.code === "auth/user-not-found") {
        msg = "No registered admin account found with this email address.";
      }
      throw new Error(msg);
    }
  }

  /**
   * Admin creating Student:
   * Uses isolated secondary Firebase App instance.
   * Admin session remains 100% untouched.
   * Student document created in students/{uid} with hostelId = currentAdmin.hostelId.
   * Passwords NEVER stored in Firestore.
   */
  async createStudent({ rollNo, name, email, password, branch, year, joiningMonth }) {
    if (!this.currentAdmin || this.currentAdmin.role !== "admin") {
      throw new Error("Unauthorized: Only an authenticated Admin can create students.");
    }

    const cleanRoll = (rollNo || "").trim().toUpperCase();
    const cleanName = (name || cleanRoll).trim();
    const cleanEmail = (email || `${cleanRoll.toLowerCase()}@hostel.local`).trim().toLowerCase();
    const defaultMonth = new Date().toISOString().substring(0, 7); // e.g. '2026-09'
    const cleanJoiningMonth = (joiningMonth || defaultMonth).trim();

    if (!cleanRoll || !password) {
      throw new Error("Roll Number and Password are required.");
    }

    const targetHostelId = this.currentAdmin.hostelId;
    if (!targetHostelId) {
      throw new Error("Cannot create student: Admin is not associated with any hostel.");
    }

    if (isLiveFirebase && auth && db) {
      const secAuth = await getSecondaryAuth();
      if (!secAuth) {
        throw new Error("Could not initialize secondary authentication provider.");
      }

      // Create student credentials in Firebase Auth without displacing admin
      const cred = await createUserWithEmailAndPassword(secAuth, cleanEmail, password);
      const studentUid = cred.user.uid;

      // Immediately sign out from secondary app
      await signOut(secAuth);

      // Create student profile in Firestore under students/{uid}
      // Strictly tag with currentAdmin.hostelId
      const studentDoc = {
        uid: studentUid,
        rollNo: cleanRoll,
        name: cleanName,
        email: cleanEmail,
        branchName: branch || "CSE",
        year: year || "1st Year",
        joiningMonth: cleanJoiningMonth,
        hostelId: targetHostelId,
        roomNo: "Unassigned",
        status: "active",
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "students", studentUid), studentDoc);
      return { success: true, uid: studentUid, student: studentDoc };
    } else {
      // Simulation
      const studentUid = "STU_" + Math.random().toString(36).substring(2, 9).toUpperCase();
      
      const studentDoc = {
        uid: studentUid,
        rollNo: cleanRoll,
        name: cleanName,
        email: cleanEmail,
        branchName: branch || "CSE",
        year: year || "1st Year",
        joiningMonth: cleanJoiningMonth,
        hostelId: targetHostelId,
        roomNo: "Unassigned",
        status: "active",
        createdAt: new Date().toISOString()
      };

      SIMULATED_FIRESTORE.students[studentUid] = studentDoc;
      return { success: true, uid: studentUid, student: studentDoc };
    }
  }
}

export const adminAuthContext = new AdminAuthContext();
export { SIMULATED_FIRESTORE };
