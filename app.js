// app.js
// Production Full-Stack Controller for Hostel Management System
// Build v20260920A (cache-busted module imports)

console.log("[hostel] build v20260920A");

import { adminAuthContext } from "./auth.js?v=20260920A";
import { auth, isLiveFirebase, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "./firebase-config.js?v=20260920A";
import { 
  branchService, 
  roomService, 
  studentService, 
  allotmentService, 
  attendanceService, 
  complaintService, 
  announcementService, 
  messService, 
  paymentService, 
  feeService,
  paymentSettingsService,
  hostelSettingsService, 
  analyticsService, 
  exportService,
  studentPortalService
} from "./services/db-service.js?v=20260920A";

// Global Toast Notification Helper
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "⚠️" : "ℹ️";
  toast.innerHTML = `<span>${icon}</span> <div>${escapeHtml(message)}</div>`;
  
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

// Global cached state for fast client-side filtering
let appState = {
  branches: [],
  rooms: [],
  students: [],
  complaints: [],
  announcements: [],
  payments: [],
  messSchedule: null,
  hostelSettings: null
};

// Payment filter state (persisted across re-renders)
let payFilterState = {
  status: "all", // "all" | "Pending Verification" | "Verified" | "Rejected"
  month: ""      // YYYY-MM or empty
};

// Cached DOM references — avoid repeated getElementById on every render cycle
const DOM = {};
function cacheDOM() {
  DOM.loginView = document.getElementById("view-login");
  DOM.adminView = document.getElementById("view-admin");
  DOM.studentView = document.getElementById("view-student");
  DOM.loadingOverlay = document.getElementById("loading-overlay");
  DOM.adminNameHeader = document.getElementById("admin-display-name");
  DOM.adminEmailHeader = document.getElementById("admin-display-email");
  DOM.adminWelcomeName = document.getElementById("admin-welcome-name");
  DOM.headerHostelEl = document.getElementById("header-hostel-display");
  DOM.dashboardHostelEl = document.getElementById("dashboard-hostel-display");
  DOM.sidebarHostelEl = document.getElementById("sidebar-hostel-subtitle");
  DOM.totalStudentsEl = document.getElementById("stat-total-students");
  DOM.totalRoomsEl = document.getElementById("stat-total-rooms");
  DOM.occupiedRoomsEl = document.getElementById("stat-occupied-rooms");
  DOM.availableRoomsEl = document.getElementById("stat-available-rooms");
}

// ============================================================
// MAIN STATE SYNCHRONIZATION
// ============================================================
async function renderState(authState) {
  const { currentAdmin, currentHostel, loading, loadingHostel, error } = authState;

  // Only show the loading overlay when an authenticated user's data is being fetched.
  // Never show it during the initial unauthenticated page load — login must be visible immediately.
  if (DOM.loadingOverlay) {
    const showOverlay = loading && currentAdmin !== null;
    DOM.loadingOverlay.style.display = showOverlay ? "flex" : "none";
  }

  // Unauthenticated — always show login page immediately
  if (!currentAdmin) {
    if (DOM.loginView) DOM.loginView.style.display = "flex";
    if (DOM.adminView) DOM.adminView.style.display = "none";
    if (DOM.studentView) DOM.studentView.style.display = "none";
    if (!loading && error) showToast(error, "error");
    return;
  }

  // Authenticated Student
  if (currentAdmin.role === "student") {
    if (DOM.loginView) DOM.loginView.style.display = "none";
    if (DOM.adminView) DOM.adminView.style.display = "none";
    if (DOM.studentView) DOM.studentView.style.display = "flex";

    try {
      await renderStudentPortal(currentAdmin, currentHostel);
    } catch (err) {
      console.error("Error rendering student portal:", err);
    }
    return;
  }

  // Authenticated Admin
  if (DOM.loginView) DOM.loginView.style.display = "none";
  if (DOM.studentView) DOM.studentView.style.display = "none";
  if (DOM.adminView) DOM.adminView.style.display = "flex";

  // Render Admin Details
  if (DOM.adminNameHeader) DOM.adminNameHeader.textContent = currentAdmin.name || "Hostel Admin";
  if (DOM.adminEmailHeader) DOM.adminEmailHeader.textContent = currentAdmin.email || "";
  if (DOM.adminWelcomeName) DOM.adminWelcomeName.textContent = currentAdmin.name || "Hostel Admin";

  // Render Dynamic Hostel Name
  if (loadingHostel) {
    const loadingHtml = '<span class="hostel-loading-pulse">Loading hostel information...</span>';
    if (DOM.headerHostelEl) DOM.headerHostelEl.innerHTML = loadingHtml;
    if (DOM.dashboardHostelEl) DOM.dashboardHostelEl.innerHTML = loadingHtml;
    if (DOM.sidebarHostelEl) DOM.sidebarHostelEl.textContent = "Loading hostel...";
  } else if (currentHostel) {
    const hostelHtml = `
      <div class="hostel-badge-content">
        <span class="hostel-icon">🏠</span>
        <span class="hostel-title">${escapeHtml(currentHostel.name)}</span>
        ${currentHostel.code ? `<span class="hostel-code">${escapeHtml(currentHostel.code)}</span>` : ""}
      </div>
    `;
    if (DOM.headerHostelEl) DOM.headerHostelEl.innerHTML = hostelHtml;
    if (DOM.dashboardHostelEl) {
      DOM.dashboardHostelEl.innerHTML = `
        <div class="welcome-hostel-badge">
          <span class="hostel-icon">🏠</span>
          <span class="hostel-main-name">${escapeHtml(currentHostel.name)}</span>
          <span class="hostel-status-pill">Active Hostel</span>
        </div>
      `;
    }
    if (DOM.sidebarHostelEl) DOM.sidebarHostelEl.textContent = currentHostel.name;

    document.querySelectorAll(".active-hostel-name-inline").forEach(el => {
      el.textContent = currentHostel.name;
    });

    // Load All Module Data safely
    try {
      await refreshAllData(currentAdmin.hostelId);
    } catch (rErr) {
      console.warn("Refresh all data warning:", rErr);
    }
  }
}

// Master refresh from Firestore
async function refreshAllData(hostelId) {
  if (!hostelId) return;

  try {
    const [
      branches,
      rooms,
      students,
      complaints,
      announcements,
      payments,
      messSchedule,
      settings,
      metrics
    ] = await Promise.all([
      branchService.getBranches(hostelId),
      roomService.getRooms(hostelId),
      studentService.getStudents(hostelId),
      complaintService.getComplaints(hostelId),
      announcementService.getAnnouncements(hostelId),
      paymentService.getPayments(hostelId),
      messService.getMessTimetable(hostelId),
      hostelSettingsService.getSettings(hostelId),
      analyticsService.getMetrics(hostelId)
    ]);

    appState = {
      branches,
      rooms,
      students,
      complaints,
      announcements,
      payments,
      messSchedule,
      hostelSettings: settings
    };

    // Render components
    renderAnalytics(metrics);
    renderBranches();
    renderRooms();
    renderStudents();
    initAllotmentPage();
    renderComplaints();
    renderAnnouncements();
    renderMessTimetable();
    renderPayments();
    renderSettingsForms();
    await renderMealPricingForm();
    try {
      await loadPublishedBills();
    } catch (bErr) {
      console.warn("Published bills auto-load warning:", bErr);
    }
  } catch (err) {
    console.error("Error refreshing dashboard data:", err);
  }
}

// ============================================================
// 1. DASHBOARD OVERVIEW RENDERING
// ============================================================
function renderAnalytics(metrics) {
  if (DOM.totalStudentsEl) DOM.totalStudentsEl.textContent = metrics.totalStudents;
  if (DOM.totalRoomsEl) DOM.totalRoomsEl.textContent = metrics.totalRooms;
  if (DOM.occupiedRoomsEl) DOM.occupiedRoomsEl.textContent = metrics.occupiedRooms;
  if (DOM.availableRoomsEl) DOM.availableRoomsEl.textContent = metrics.availableRooms;

  const roomTotalStat = document.getElementById("rooms-stat-total");
  const roomOccStat = document.getElementById("rooms-stat-occupied");
  const roomUnoccStat = document.getElementById("rooms-stat-unoccupied");
  if (roomTotalStat) roomTotalStat.textContent = metrics.totalRooms;
  if (roomOccStat) roomOccStat.textContent = metrics.occupiedRooms;
  if (roomUnoccStat) roomUnoccStat.textContent = metrics.availableRooms;
}

function handleDashboardSearch() {
  const query = (document.getElementById("dashboard-search-input")?.value || "").trim().toLowerCase();
  const resultsContainer = document.getElementById("dashboard-search-results");
  if (!resultsContainer) return;

  if (!query) {
    resultsContainer.style.display = "none";
    return;
  }

  const matches = appState.students.filter(s => 
    (s.name && s.name.toLowerCase().includes(query)) ||
    (s.rollNo && s.rollNo.toLowerCase().includes(query)) ||
    (s.roomNo && s.roomNo.toLowerCase().includes(query)) ||
    (s.email && s.email.toLowerCase().includes(query))
  );

  if (matches.length === 0) {
    resultsContainer.innerHTML = `<div class="result" style="color:#64748b;">No matching resident found for "${escapeHtml(query)}"</div>`;
    resultsContainer.style.display = "block";
    return;
  }

  resultsContainer.innerHTML = matches.map(s => `
    <div class="result">
      <b>${escapeHtml(s.rollNo)} — ${escapeHtml(s.name)}</b>
      <span>${escapeHtml(s.branchName || "CSE")} · Room: ${s.roomNo && s.roomNo !== "Unassigned" ? escapeHtml(s.roomNo) : "Pending"} · Fee Remaining: ₹${(s.feeRemaining || 0).toLocaleString()}</span>
      <button type="button" onclick="location.hash='#students'">View in Directory</button>
    </div>
  `).join("");
  resultsContainer.style.display = "block";
}

// ============================================================
// 2. STUDENTS RENDERING
// ============================================================
function renderStudents() {
  const tbody = document.getElementById("admin-students-tbody");
  if (!tbody) return;

  const branchFilter = document.getElementById("filter-students-branch")?.value || "All Branches";
  const searchFilter = (document.getElementById("input-search-students")?.value || "").toLowerCase();

  let list = appState.students;
  if (branchFilter !== "All Branches") {
    list = list.filter(s => s.branchName === branchFilter || s.branchId === branchFilter);
  }
  if (searchFilter) {
    list = list.filter(s => 
      (s.name && s.name.toLowerCase().includes(searchFilter)) ||
      (s.rollNo && s.rollNo.toLowerCase().includes(searchFilter)) ||
      (s.roomNo && s.roomNo.toLowerCase().includes(searchFilter))
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:#94a3b8;">No students found matching current filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(s => `
    <tr>
      <td><b>${escapeHtml(s.rollNo)}</b></td>
      <td>${escapeHtml(s.name)}</td>
      <td><small style="color:#64748b;">${escapeHtml(s.email)}</small></td>
      <td>${escapeHtml(s.branchName || "CSE")}</td>
      <td>${escapeHtml(s.year || "3rd Year")}<br><small style="color:#64748b;">Joined: ${escapeHtml(s.joiningMonth || "Current")}</small></td>
      <td>
        ${s.roomNo && s.roomNo !== "Unassigned" 
          ? `<b style="color:var(--primary);">Room ${escapeHtml(s.roomNo)}</b>` 
          : `<span style="color:#94a3b8;">Pending</span>`}
      </td>
      <td>₹${(s.feeRemaining || 0).toLocaleString()}</td>
      <td><em class="${s.status === 'active' ? 'green' : 'red'}">${s.status === 'active' ? 'Active' : 'Inactive'}</em></td>
      <td>
        <div style="display:flex;gap:6px;">
          ${s.roomNo && s.roomNo !== "Unassigned" 
            ? `<button type="button" class="btn-sm btn-deallocate" data-uid="${s.uid}" style="background:#fee2e2;color:#b91c1c;padding:5px 9px;font-size:11px;">Deallocate</button>` 
            : `<button type="button" class="btn-sm btn-to-allot" data-uid="${s.uid}" style="background:#dbeafe;color:#1d4ed8;padding:5px 9px;font-size:11px;">Allot Room</button>`}
          <button type="button" class="btn-sm btn-edit-student" data-uid="${s.uid}" data-id="${s.id || ''}" style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;padding:5px 9px;font-size:11px;border-radius:6px;cursor:pointer;">Edit</button>
          <button type="button" class="btn-sm btn-delete-student" data-uid="${s.uid}" data-name="${escapeHtml(s.name || s.rollNo)}" style="background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;padding:5px 9px;font-size:11px;border-radius:6px;cursor:pointer;">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");

  // Attach dynamic student action handlers
  document.querySelectorAll(".btn-deallocate").forEach(b => {
    b.addEventListener("click", async (e) => {
      const uid = e.target.dataset.uid;
      if (!confirm("Remove this student from their assigned room?")) return;
      try {
        await allotmentService.deallocateStudent(adminAuthContext.currentAdmin.hostelId, uid);
        showToast("Room deallocated successfully.", "success");
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  document.querySelectorAll(".btn-to-allot").forEach(b => {
    b.addEventListener("click", (e) => {
      const uid = e.target.dataset.uid;
      window.location.hash = "#allotment";
      const select = document.getElementById("allotment-student-select");
      if (select) select.value = uid;
    });
  });

  document.querySelectorAll(".btn-edit-student").forEach(b => {
    b.addEventListener("click", () => {
      const uid = b.dataset.uid;
      const id = b.dataset.id || uid;
      const s = appState.students.find(x => x.uid === uid || x.id === id || x.uid === id);
      if (!s) return;

      const modal = document.getElementById("modal-edit-student");
      if (!modal) return;

      document.getElementById("edit-student-uid").value = id;
      document.getElementById("edit-student-roll").value = s.rollNo || "";
      document.getElementById("edit-student-name").value = s.name || "";
      document.getElementById("edit-student-email").value = s.email || "";
      document.getElementById("edit-student-joining-month").value = s.joiningMonth || "2026-01";

      const statusSel = document.getElementById("edit-student-status");
      if (statusSel) statusSel.value = s.status === "inactive" ? "inactive" : "active";

      const branchSel = document.getElementById("edit-student-branch");
      if (branchSel) {
        const branchOpts = (appState.branches || []).map(x => `<option value="${escapeHtml(x.code)}">${escapeHtml(x.code)} - ${escapeHtml(x.name)}</option>`).join("");
        branchSel.innerHTML = branchOpts || '<option value="CSE">CSE</option>';
        branchSel.value = s.branchName || s.branchId || "CSE";
      }

      const yearSel = document.getElementById("edit-student-year");
      if (yearSel && s.year) yearSel.value = s.year;

      modal.style.display = "flex";
    });
  });

  document.querySelectorAll(".btn-delete-student").forEach(b => {
    b.addEventListener("click", async (e) => {
      const uid = e.target.dataset.uid;
      const name = e.target.dataset.name;
      const pwd = window.prompt(
        `Delete student "${name}"?\n\nTo also delete their Firebase Login credentials, enter the student's current password.\nLeave blank to only remove their data (login account will remain).`,
        ""
      );
      if (pwd === null) return;
      try {
        const result = await studentService.deleteStudent(uid, { password: pwd });
        appState.students = appState.students.filter(s => s.uid !== uid && s.id !== uid);
        if (result.authDeleted) {
          showToast(`Student "${name}" deleted. Login credentials removed too.`, "success");
        } else {
          showToast(`Student "${name}" deleted. Login credential was not removed (no/incorrect password) — delete it in the Firebase Console to fully revoke access.`, "warning");
        }
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  // Populate Student Dropdowns across other modules
  populateStudentDropdowns();
}

function populateStudentDropdowns() {
  const calcSelect = document.getElementById("fee-calc-student-select");
  const paySelect = document.getElementById("record-payment-student-select");

  const optionsHtml = '<option value="">Select student...</option>' + 
    appState.students.map(s => `<option value="${s.uid}">${escapeHtml(s.rollNo)} — ${escapeHtml(s.name)}</option>`).join("");

  if (calcSelect) calcSelect.innerHTML = optionsHtml;
  if (paySelect) paySelect.innerHTML = optionsHtml;
}

// ============================================================
// 3. BRANCHES RENDERING
// ============================================================
function renderBranches() {
  const container = document.getElementById("branches-chips-container");
  if (!container) return;

  if (appState.branches.length === 0) {
    container.innerHTML = '<span style="color:#94a3b8;">No branches configured yet. Add a branch above.</span>';
    return;
  }

  container.innerHTML = appState.branches.map(b => `
    <div class="branch-chip-item" style="display:inline-flex;align-items:center;gap:8px;background:var(--primary-light);padding:8px 14px;border-radius:8px;">
      <b style="color:var(--primary);">${escapeHtml(b.code)}</b>
      <span style="font-size:12px;color:#475569;">${escapeHtml(b.name)}</span>
      <button type="button" class="btn-delete-branch" data-id="${b.id}" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;" title="Delete Branch">&times;</button>
    </div>
  `).join("");

  document.querySelectorAll(".btn-delete-branch").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if (!confirm("Delete this academic branch?")) return;
      try {
        await branchService.deleteBranch(id);
        showToast("Branch removed.", "info");
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });

  // Update Branch Dropdowns
  const studentBranchSelect = document.getElementById("new-student-branch");
  const filterBranchSelect = document.getElementById("filter-students-branch");
  const roomBranchSelect = document.getElementById("new-room-branch-pref");

  const branchOpts = appState.branches.map(b => `<option value="${escapeHtml(b.code)}">${escapeHtml(b.code)} - ${escapeHtml(b.name)}</option>`).join("");
  
  if (studentBranchSelect) studentBranchSelect.innerHTML = branchOpts || '<option value="CSE">CSE</option>';
  if (filterBranchSelect) {
    const currentVal = filterBranchSelect.value;
    filterBranchSelect.innerHTML = '<option value="All Branches">All Branches</option>' + 
      appState.branches.map(b => `<option value="${escapeHtml(b.code)}">${escapeHtml(b.code)}</option>`).join("");
    filterBranchSelect.value = currentVal || "All Branches";
  }
  if (roomBranchSelect) {
    roomBranchSelect.innerHTML = '<option value="All">All Branches (General)</option>' + branchOpts;
  }
}

// ============================================================
// 4. ROOMS RENDERING
// ============================================================
function renderRooms() {
  const tbody = document.getElementById("rooms-table-tbody");
  if (!tbody) return;

  if (appState.rooms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8;">No rooms registered yet. Add a room using the form above.</td></tr>`;
    return;
  }

  tbody.innerHTML = appState.rooms.map(r => {
    const occ = r.occupied || 0;
    const cap = r.capacity || 4;
    const pct = Math.min(100, Math.round((occ / cap) * 100));
    const isFull = occ >= cap;

    return `
      <tr>
        <td><b>Room ${escapeHtml(r.roomNo)}</b></td>
        <td>${escapeHtml(r.floor || "1")}</td>
        <td>${cap} Beds</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${isFull ? 'var(--danger)' : 'var(--primary)'};"></div>
            </div>
            <span style="font-size:11px;font-weight:700;">${occ}/${cap}</span>
          </div>
        </td>
        <td>${escapeHtml(r.branchPreference || "All")}</td>
        <td><em class="${isFull ? 'red' : 'green'}">${isFull ? 'Full' : 'Available'}</em></td>
        <td>
          <button type="button" class="btn-delete-room" data-id="${r.id}" style="background:#fee2e2;color:#b91c1c;padding:5px 9px;font-size:11px;border-radius:6px;">Delete</button>
        </td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".btn-delete-room").forEach(b => {
    b.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if (!confirm("Are you sure you want to delete this room?")) return;
      try {
        await roomService.deleteRoom(id);
        showToast("Room deleted.", "info");
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

// ============================================================
// ============================================================
// 5. ALLOTMENT PAGE — PREMIUM REDESIGN MODULE
// ============================================================

// Internal state for the allotment page
const allotState = {
  selectedStudentUids: new Set(),
  selectedRoomIds: new Set(),
  searchStudent: '',
  searchRoom: '',
  filterBranch: '',
  filterFloor: '',
};

function initAllotmentPage() {
  // Set hostel name in header badge
  const hostelEl = document.getElementById('allot-hostel-name');
  if (hostelEl && adminAuthContext.currentHostel) {
    hostelEl.textContent = adminAuthContext.currentHostel.name || 'Your Hostel';
  }

  // Reset state and inputs
  allotState.selectedStudentUids = new Set();
  allotState.selectedRoomIds = new Set();
  allotState.searchStudent = '';
  allotState.searchRoom = '';
  allotState.filterBranch = '';
  allotState.filterFloor = '';

  const ss = document.getElementById('allot-student-search');
  const rs = document.getElementById('allot-room-search');
  if (ss) ss.value = '';
  if (rs) rs.value = '';

  renderBranchChips();
  renderBranchFilter();
  renderFloorFilter();
  renderStudentPanel();
  renderRoomGrid();
  updateAllotmentSummary();
}

function renderBranchChips() {
  const container = document.getElementById('allot-quick-branches');
  if (!container) return;
  const branches = appState.branches || [];
  if (branches.length === 0) {
    container.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">No branches configured.</span>';
    return;
  }
  container.innerHTML = branches.map(b => `
    <button type="button" class="branch-chip" data-branch="${escapeHtml(b.name || b.code)}" data-code="${escapeHtml(b.code)}">
      All ${escapeHtml(b.code)}
    </button>
  `).join('');
  container.querySelectorAll('.branch-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const wasActive = chip.classList.contains('active');
      container.querySelectorAll('.branch-chip').forEach(c => c.classList.remove('active'));
      if (!wasActive) chip.classList.add('active');
      selectAllByBranch(chip.dataset.branch, chip.dataset.code, !wasActive);
    });
  });
}

function renderBranchFilter() {
  const sel = document.getElementById('allot-branch-filter');
  if (!sel) return;
  const branches = appState.branches || [];
  sel.innerHTML = '<option value="">All Branches</option>' +
    branches.map(b => `<option value="${escapeHtml(b.name || b.code)}">${escapeHtml(b.code)} — ${escapeHtml(b.name)}</option>`).join('');
  sel.value = allotState.filterBranch;
}

function renderFloorFilter() {
  const sel = document.getElementById('allot-floor-filter');
  if (!sel) return;
  const rooms = appState.rooms || [];
  const floors = [...new Set(rooms.map(r => r.floor).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All Floors</option>' +
    floors.map(f => `<option value="${escapeHtml(f)}">Floor ${escapeHtml(f)}</option>`).join('');
  sel.value = allotState.filterFloor;
}

function getFilteredStudents() {
  const search = (allotState.searchStudent || '').toLowerCase();
  const branch = allotState.filterBranch || '';
  return (appState.students || []).filter(s => {
    const matchBranch = !branch || s.branchName === branch || s.branchId === branch;
    const matchSearch = !search ||
      (s.rollNo && s.rollNo.toLowerCase().includes(search)) ||
      (s.name && s.name.toLowerCase().includes(search));
    return matchBranch && matchSearch;
  });
}

function getFilteredRooms() {
  const search = (allotState.searchRoom || '').toLowerCase();
  const floor = allotState.filterFloor || '';
  return (appState.rooms || []).filter(r => {
    const matchFloor = !floor || String(r.floor) === String(floor);
    const matchSearch = !search || (r.roomNo && String(r.roomNo).toLowerCase().includes(search));
    return matchFloor && matchSearch;
  });
}

function renderStudentPanel() {
  const container = document.getElementById('allot-student-list');
  if (!container) return;
  const students = getFilteredStudents();
  if (students.length === 0) {
    container.innerHTML = `<div class="allot-empty-state"><div class="allot-empty-icon">👤</div><p>${(allotState.searchStudent || allotState.filterBranch) ? 'No matching students found.' : 'No eligible students available.'}</p></div>`;
    updateAllotmentSummary();
    return;
  }
  container.innerHTML = students.map(s => {
    const isAllotted = s.roomNo && s.roomNo !== 'Unassigned' && s.roomNo !== '—';
    const isSelected = allotState.selectedStudentUids.has(s.uid || s.id);
    const branch = escapeHtml(s.branchName || s.branchId || '—');
    const year = s.year ? ` • ${escapeHtml(s.year)} Year` : '';
    return `<div class="student-row ${isSelected ? 'selected' : ''} ${isAllotted ? 'allotted' : ''}" data-uid="${escapeHtml(s.uid || s.id)}" data-allotted="${isAllotted ? '1' : '0'}" ${isAllotted ? 'title="Already allotted"' : ''}>
      <div class="student-row-check">${isAllotted ? '<span class="allotted-dot">✓</span>' : `<input type="checkbox" class="allot-student-cb" ${isSelected ? 'checked' : ''} />`}</div>
      <div class="student-row-info"><strong>${escapeHtml(s.rollNo || 'N/A')}</strong><span>${escapeHtml(s.name || s.rollNo || '')} • ${branch}${year}</span></div>
      <div class="student-row-status">${isAllotted ? `<span class="allot-badge allot-badge-green">Allotted<br/><small>${escapeHtml(s.roomNo)}</small></span>` : '<span class="allot-badge allot-badge-amber">Not Allotted</span>'}</div>
    </div>`;
  }).join('');
  container.querySelectorAll('.student-row:not(.allotted)').forEach(row => {
    row.addEventListener('click', (e) => { if (e.target.type === 'checkbox') return; toggleStudentRow(row.dataset.uid); });
    const cb = row.querySelector('.allot-student-cb');
    if (cb) cb.addEventListener('change', () => toggleStudentRow(row.dataset.uid));
  });
  updateAllotmentSummary();
}

function renderRoomGrid() {
  const container = document.getElementById('allot-room-grid');
  if (!container) return;
  const rooms = getFilteredRooms();
  if (rooms.length === 0) {
    container.innerHTML = `<div class="allot-empty-state" style="grid-column:1/-1"><div class="allot-empty-icon">🏠</div><p>${(allotState.searchRoom || allotState.filterFloor) ? 'No matching rooms found.' : 'No rooms available.'}</p></div>`;
    return;
  }
  container.innerHTML = rooms.map(r => {
    const cap = r.capacity || 4;
    const occ = r.occupied || 0;
    const avail = cap - occ;
    const isFull = avail <= 0;
    const isSelected = allotState.selectedRoomIds.has(r.id);
    const statusLabel = isFull ? 'Full' : occ === 0 ? 'Available' : 'Partial';
    const statusClass = isFull ? 'room-status-full' : occ === 0 ? 'room-status-available' : 'room-status-partial';
    const dots = Array.from({ length: cap }, (_, i) => `<span class="bed-dot ${i < occ ? 'occupied' : 'free'}"></span>`).join('');
    return `<div class="room-card ${isSelected ? 'selected' : ''} ${isFull ? 'full' : ''}" data-room-id="${escapeHtml(r.id)}" data-available="${avail}">
      <div class="room-card-top"><div class="room-card-number">Room ${escapeHtml(r.roomNo)}</div><span class="room-status-badge ${statusClass}">${statusLabel}</span></div>
      <div class="room-card-floor">Floor ${escapeHtml(r.floor || '—')}</div>
      <div class="room-card-stats">
        <div><span>${cap}</span><label>Capacity</label></div>
        <div><span>${occ}</span><label>Occupied</label></div>
        <div class="available-stat"><span>${avail}</span><label>Available</label></div>
      </div>
      <div class="room-bed-dots">${dots}</div>
      ${!isFull ? `<button type="button" class="room-select-btn ${isSelected ? 'selected' : ''}">${isSelected ? '✓ Selected' : 'Select Room'}</button>` : '<div class="room-full-label">FULL — Cannot Select</div>'}
    </div>`;
  }).join('');
  container.querySelectorAll('.room-card:not(.full)').forEach(card => {
    const fn = () => toggleRoomCard(card.dataset.roomId);
    card.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') return; fn(); });
    const btn = card.querySelector('.room-select-btn');
    if (btn) btn.addEventListener('click', fn);
  });
}

function toggleStudentRow(uid) {
  if (!uid) return;
  if (allotState.selectedStudentUids.has(uid)) allotState.selectedStudentUids.delete(uid);
  else allotState.selectedStudentUids.add(uid);
  const row = document.querySelector(`.student-row[data-uid="${uid}"]`);
  if (row) {
    const isSel = allotState.selectedStudentUids.has(uid);
    row.classList.toggle('selected', isSel);
    const cb = row.querySelector('.allot-student-cb');
    if (cb) cb.checked = isSel;
  }
  updateAllotmentSummary();
}

function selectAllByBranch(branchName, branchCode, activate) {
  (appState.students || []).forEach(s => {
    const sb = s.branchName || s.branchId || '';
    const match = sb === branchName || (branchCode && sb.toUpperCase() === branchCode.toUpperCase());
    const isAllotted = s.roomNo && s.roomNo !== 'Unassigned' && s.roomNo !== '—';
    if (match && !isAllotted) {
      const uid = s.uid || s.id;
      if (activate) allotState.selectedStudentUids.add(uid);
      else allotState.selectedStudentUids.delete(uid);
    }
  });
  renderStudentPanel();
  updateAllotmentSummary();
}

function toggleRoomCard(roomId) {
  if (!roomId) return;
  if (allotState.selectedRoomIds.has(roomId)) allotState.selectedRoomIds.delete(roomId);
  else allotState.selectedRoomIds.add(roomId);
  const card = document.querySelector(`.room-card[data-room-id="${roomId}"]`);
  if (card) {
    const isSel = allotState.selectedRoomIds.has(roomId);
    card.classList.toggle('selected', isSel);
    const btn = card.querySelector('.room-select-btn');
    if (btn) { btn.textContent = isSel ? '✓ Selected' : 'Select Room'; btn.classList.toggle('selected', isSel); }
  }
  // Update room count badge
  const rc = document.getElementById('allot-selected-room-count');
  if (rc) { const n = allotState.selectedRoomIds.size; rc.textContent = n + ' selected'; rc.style.display = n > 0 ? 'inline-flex' : 'none'; }
  updateAllotmentSummary();
}

function updateAllotmentSummary() {
  const studentCount = allotState.selectedStudentUids.size;
  const roomCount = allotState.selectedRoomIds.size;
  let availableBeds = 0;
  allotState.selectedRoomIds.forEach(rId => {
    const room = (appState.rooms || []).find(r => r.id === rId);
    if (room) availableBeds += Math.max(0, (room.capacity || 4) - (room.occupied || 0));
  });
  const sc = document.getElementById('allot-selected-student-count');
  if (sc) { sc.textContent = studentCount + ' selected'; sc.style.display = studentCount > 0 ? 'inline-flex' : 'none'; }
  const statS = document.getElementById('allot-stat-students');
  const statB = document.getElementById('allot-stat-beds');
  const statR = document.getElementById('allot-stat-rooms');
  const statusEl = document.getElementById('allot-capacity-status');
  const allotBtn = document.getElementById('btn-allot-confirm-open');
  if (statS) statS.textContent = studentCount;
  if (statB) statB.textContent = availableBeds;
  if (statR) statR.textContent = roomCount;
  let canAllot = false;
  if (studentCount === 0) { if (statusEl) statusEl.innerHTML = ''; }
  else if (roomCount === 0) { if (statusEl) statusEl.innerHTML = '<span class="capacity-warn">⚠ Select at least one room</span>'; }
  else if (studentCount > availableBeds) { if (statusEl) statusEl.innerHTML = `<span class="capacity-warn">⚠ Not enough beds — ${studentCount} students, ${availableBeds} available</span>`; }
  else { if (statusEl) statusEl.innerHTML = `<span class="capacity-ok">✓ Capacity available — ${availableBeds - studentCount} beds remaining</span>`; canAllot = true; }
  if (allotBtn) { allotBtn.disabled = !canAllot; }
}

function openAllotModal() {
  const sc = allotState.selectedStudentUids.size;
  const rc = allotState.selectedRoomIds.size;
  if (sc === 0) { showToast('Please select at least one student.', 'error'); return; }
  if (rc === 0) { showToast('Please select at least one room.', 'error'); return; }
  let beds = 0;
  const roomNames = [];
  allotState.selectedRoomIds.forEach(rId => {
    const r = (appState.rooms || []).find(x => x.id === rId);
    if (r) { beds += Math.max(0, (r.capacity || 4) - (r.occupied || 0)); roomNames.push('Room ' + r.roomNo); }
  });
  const ms = document.getElementById('allot-modal-students');
  const mr = document.getElementById('allot-modal-rooms');
  const mb = document.getElementById('allot-modal-beds');
  if (ms) ms.textContent = sc;
  if (mr) mr.textContent = roomNames.join(', ');
  if (mb) mb.textContent = beds;
  document.getElementById('allot-confirm-modal').style.display = 'flex';
}

async function confirmAllotment() {
  const btn = document.getElementById('btn-allot-confirm');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Allocating...'; }
  const studentUids = [...allotState.selectedStudentUids];
  const roomIds = [...allotState.selectedRoomIds];
  try {
    const queue = roomIds.map(rId => {
      const r = (appState.rooms || []).find(x => x.id === rId);
      return { id: rId, avail: r ? Math.max(0, (r.capacity || 4) - (r.occupied || 0)) : 0 };
    }).filter(r => r.avail > 0);
    let ri = 0, bl = queue[0]?.avail || 0;
    for (const uid of studentUids) {
      if (ri >= queue.length) { showToast('Ran out of beds. Some students not allocated.', 'error'); break; }
      if (bl <= 0) { ri++; if (ri >= queue.length) break; bl = queue[ri].avail; }
      await allotmentService.allocateStudent(adminAuthContext.currentAdmin.hostelId, uid, queue[ri].id);
      bl--;
    }
    document.getElementById('allot-confirm-modal').style.display = 'none';
    showToast(`✓ ${studentUids.length} student(s) successfully allotted!`, 'success');
    allotState.selectedStudentUids = new Set();
    allotState.selectedRoomIds = new Set();
    await refreshAllData(adminAuthContext.currentAdmin.hostelId);
  } catch (err) {
    showToast(err.message || 'Unable to complete allocation. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm Allocation'; }
  }
}

function openReallocateModal() {
  document.getElementById('reallot-confirm-modal').style.display = 'flex';
}

async function confirmReallocation() {
  const btn = document.getElementById('btn-reallocate-confirm');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Reallocating...'; }
  try {
    const res = await allotmentService.reallocateAll(adminAuthContext.currentAdmin.hostelId);
    document.getElementById('reallot-confirm-modal').style.display = 'none';
    showToast(`✓ Reallocated ${res.allocated} of ${res.total} students!`, 'success');
    await refreshAllData(adminAuthContext.currentAdmin.hostelId);
  } catch (err) {
    showToast(err.message || 'Reallocation failed. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Continue — Reallocate'; }
  }
}

// Local memory state for custom meal items
let currentCustomMeals = [];

async function fetchAttendanceHistory() {
  const dateInput = document.getElementById("history-attendance-date");
  const mealSelect = document.getElementById("history-attendance-meal");
  const tbody = document.getElementById("history-attendance-tbody");
  const header = document.getElementById("history-summary-header");

  if (!dateInput || !mealSelect || !tbody) return;

  const dateStr = dateInput.value || new Date().toISOString().slice(0, 10);
  const meal = mealSelect.value;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">Loading attendance history...</td></tr>';

  const record = await attendanceService.getAttendance(adminAuthContext.currentAdmin.hostelId, dateStr, meal);

  if (!record) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#ef4444;font-weight:600;">No attendance recorded for ${escapeHtml(meal)} on ${escapeHtml(dateStr)}.</td></tr>`;
    if (header) header.style.display = "none";
    return;
  }

  const presentSet = new Set(record.presentStudentUids || []);
  const totalStudents = appState.students.length;
  const presentCount = presentSet.size;
  const absentCount = totalStudents - presentCount;

  if (header) {
    header.textContent = `📊 Attendance Record for ${meal} (${dateStr}): ${presentCount} Present / ${absentCount} Absent (Total ${totalStudents})`;
    header.style.display = "block";
  }

  if (totalStudents === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">No students registered in hostel.</td></tr>';
    return;
  }

  tbody.innerHTML = appState.students.map(s => {
    const isPresent = presentSet.has(s.uid);
    const itemCost = isPresent ? (record.mealCost || 0) : 0;
    return `
      <tr>
        <td><b>${escapeHtml(s.rollNo)}</b></td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.branchName || "CSE")}</td>
        <td>Room ${escapeHtml(s.roomNo || "Pending")}</td>
        <td>
          <b style="color: ${isPresent ? '#16a34a' : '#dc2626'}; font-size:12px;">
            ${isPresent ? '✓ Present' : '✗ Absent'}
          </b>
        </td>
        <td>${escapeHtml(meal)}</td>
        <td><b>₹${itemCost}</b></td>
      </tr>
    `;
  }).join("");
}

async function renderMealPricingForm() {
  const monthStr = document.getElementById("fee-month-select")?.value || "2026_09";
  const feeCfg = await feeService.getFeeConfig(adminAuthContext.currentAdmin.hostelId, monthStr);

  const bfInput = document.getElementById("meal-price-breakfast");
  const luInput = document.getElementById("meal-price-lunch");
  const diInput = document.getElementById("meal-price-dinner");
  const rentInput = document.getElementById("fee-monthly-rent");

  if (bfInput) bfInput.value = feeCfg.breakfastPrice !== undefined ? feeCfg.breakfastPrice : 30;
  if (luInput) luInput.value = feeCfg.lunchPrice !== undefined ? feeCfg.lunchPrice : 50;
  if (diInput) diInput.value = feeCfg.dinnerPrice !== undefined ? feeCfg.dinnerPrice : 45;
  if (rentInput) rentInput.value = feeCfg.monthlyRent || 2000;

  currentCustomMeals = feeCfg.customMeals || [];
  renderCustomMealChips();
  populateMealDropdowns();
}

function renderCustomMealChips() {
  const container = document.getElementById("custom-meals-chips-container");
  if (!container) return;

  if (currentCustomMeals.length === 0) {
    container.innerHTML = '<span style="color:#94a3b8; font-size:12px;">No custom meal items added yet. Add one above.</span>';
    return;
  }

  container.innerHTML = currentCustomMeals.map((item, index) => `
    <div class="branch-chip-item" style="display:inline-flex;align-items:center;gap:8px;background:#e2e8f0;padding:6px 12px;border-radius:6px;margin-right:6px;margin-bottom:6px;">
      <b style="color:var(--primary);font-size:12px;">${escapeHtml(item.name)}</b>
      <span style="font-size:11px;color:#16a34a;font-weight:700;">₹${item.price}</span>
      <button type="button" class="btn-remove-custom-item" data-index="${index}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;" title="Remove Item">&times;</button>
    </div>
  `).join("");

  document.querySelectorAll(".btn-remove-custom-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      currentCustomMeals.splice(idx, 1);
      renderCustomMealChips();
      populateMealDropdowns();
    });
  });
}

function populateMealDropdowns() {
  const markSelect = document.getElementById("attendance-meal");
  const historySelect = document.getElementById("history-attendance-meal");

  const standardOpts = `
    <option value="Breakfast">🌅 Breakfast</option>
    <option value="Lunch">☀️ Lunch</option>
    <option value="Dinner">🌙 Dinner</option>
  `;

  const customOpts = currentCustomMeals.map(m => `<option value="${escapeHtml(m.name)}">☕ ${escapeHtml(m.name)} (₹${m.price})</option>`).join("");
  const fullOpts = standardOpts + customOpts;

  if (markSelect) {
    const cur = markSelect.value;
    markSelect.innerHTML = fullOpts;
    markSelect.value = cur || "Lunch";
  }
  if (historySelect) {
    const cur = historySelect.value;
    historySelect.innerHTML = fullOpts;
    historySelect.value = cur || "Breakfast";
  }
}

// ============================================================
// 6. ATTENDANCE RENDERING
// ============================================================
async function loadAttendanceRoster() {
  const tbody = document.getElementById("attendance-table-tbody");
  const dateInput = document.getElementById("attendance-date");
  const mealSelect = document.getElementById("attendance-meal");
  const finalizedBadge = document.getElementById("attendance-finalized-badge");
  const saveBtn = document.getElementById("btn-save-attendance");

  if (!tbody || !dateInput || !mealSelect) return;

  const dateStr = dateInput.value || new Date().toISOString().slice(0, 10);
  const meal = mealSelect.value;
  const monthKey = dateStr.slice(0, 7).replace(/-/g, "_");

  // Check month finalization status
  const isLocked = await attendanceService.isMonthFinalized(adminAuthContext.currentAdmin.hostelId, monthKey);

  if (finalizedBadge) finalizedBadge.style.display = isLocked ? "block" : "none";
  if (saveBtn) {
    saveBtn.disabled = isLocked;
    saveBtn.style.opacity = isLocked ? "0.5" : "1";
    saveBtn.style.cursor = isLocked ? "not-allowed" : "pointer";
    saveBtn.textContent = isLocked ? "🔒 Month Finalized (Locked)" : "Save Daily Attendance";
  }

  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">Loading roster...</td></tr>';

  const existing = await attendanceService.getAttendance(adminAuthContext.currentAdmin.hostelId, dateStr, meal);
  const presentUids = new Set(existing ? existing.presentStudentUids || [] : []);

  if (appState.students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">No registered students to mark.</td></tr>';
    return;
  }

  tbody.innerHTML = appState.students.map(s => {
    const isChecked = presentUids.has(s.uid);
    return `
      <tr>
        <td><input type="checkbox" class="attendance-check" data-uid="${s.uid}" ${isChecked ? "checked" : ""} ${isLocked ? "disabled" : ""}></td>
        <td><b>${escapeHtml(s.rollNo)}</b></td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.branchName || "CSE")}</td>
        <td>Room ${escapeHtml(s.roomNo || "Pending")}</td>
      </tr>
    `;
  }).join("");
}

// ============================================================
// 6b. PUBLISHED BILLS (FINALIZED MONTHS) RENDERING
// ============================================================
function formatPublishedMonthLabel(monthKey) {
  const m = String(monthKey || "");
  const parts = m.split("_");
  if (parts.length !== 2) return m;
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const idx = parseInt(parts[1], 10) - 1;
  return `${names[idx] || parts[1]} ${parts[0]}`;
}

async function loadPublishedBills() {
  const tbody = document.getElementById("published-bills-tbody");
  const hostelId = adminAuthContext.currentAdmin?.hostelId;
  if (!tbody || !hostelId) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">Loading published bills...</td></tr>';
  try {
    const months = await attendanceService.getPublishedMonths(hostelId);
    if (!months.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">No published bills yet.</td></tr>';
      return;
    }
    tbody.innerHTML = months.map(m => {
      const t = m.totals || { billed: 0, paid: 0, pending: 0, students: 0 };
      return `
        <tr>
          <td><b>${escapeHtml(formatPublishedMonthLabel(m.monthKey))}</b></td>
          <td>${t.students}</td>
          <td>₹${Number(t.billed).toLocaleString()}</td>
          <td style="color:#15803d;">₹${Number(t.paid).toLocaleString()}</td>
          <td style="color:#b45309;">₹${Number(t.pending).toLocaleString()}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="btn-view-published" data-month="${escapeHtml(m.monthKey)}" style="font-size:11px;padding:4px 10px;background:#dbeafe;color:#1d4ed8;">👁 View</button>
              <button type="button" class="btn-delete-published" data-month="${escapeHtml(m.monthKey)}" style="font-size:11px;padding:4px 10px;background:#fee2e2;color:#b91c1c;">🗑 Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#dc2626;">${escapeHtml(err.message)}</td></tr>`;
  }
}

async function openPublishedBillDetails(monthKey) {
  const modal = document.getElementById("modal-published-bill-details");
  const titleEl = document.getElementById("published-bill-details-title");
  const tbody = document.getElementById("published-bill-details-tbody");
  const hostelId = adminAuthContext.currentAdmin?.hostelId;
  if (!modal || !tbody || !hostelId) return;
  if (titleEl) titleEl.textContent = formatPublishedMonthLabel(monthKey);
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">Loading...</td></tr>';
  modal.style.display = "flex";
  try {
    const rows = await attendanceService.getPublishedMonthDetails(hostelId, monthKey);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">No statements found for this month.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const mess = (Number(r.breakfastCost) || 0) + (Number(r.lunchCost) || 0) + (Number(r.dinnerCost) || 0) + (Number(r.customMealsCost) || 0);
      return `
        <tr>
          <td><b>${escapeHtml(r.rollNo || "")}</b></td>
          <td>${escapeHtml(r.studentName || "")}</td>
          <td>₹${Number(r.monthlyRent || 0).toLocaleString()}</td>
          <td>₹${Number(mess).toLocaleString()}</td>
          <td>₹${Number(r.totalAmount || 0).toLocaleString()}</td>
          <td style="color:#15803d;">₹${Number(r.paidAmount || 0).toLocaleString()}</td>
          <td style="color:#b45309;">₹${Number(r.pendingAmount || 0).toLocaleString()}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:#dc2626;">${escapeHtml(err.message)}</td></tr>`;
  }
}

// ============================================================
// 7. COMPLAINTS RENDERING
// ============================================================
function renderComplaints() {
  const tbody = document.getElementById("complaints-table-tbody");
  if (!tbody) return;

  if (appState.complaints.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#94a3b8;">No complaints filed. All systems normal.</td></tr>';
    return;
  }

  tbody.innerHTML = appState.complaints.map(c => `
    <tr>
      <td><b>${escapeHtml(c.id)}</b></td>
      <td>${escapeHtml(c.studentName)}</td>
      <td>Room ${escapeHtml(c.roomNo)}</td>
      <td><span class="badge-pill" style="background:#eef2ff;color:var(--primary);">${escapeHtml(c.category)}</span></td>
      <td>${escapeHtml(c.description)}</td>
      <td>
        <em class="${c.status === 'Resolved' ? 'green' : c.status === 'In Progress' ? 'blue' : 'yellow'}">
          ${escapeHtml(c.status)}
        </em>
      </td>
      <td>
        ${c.status !== 'Resolved' ? `
          <div style="display:flex;gap:4px;">
            ${c.status === 'Pending' ? `<button type="button" class="btn-complaint-prog" data-id="${c.id}" style="font-size:11px;padding:4px 8px;background:#dbeafe;color:#1d4ed8;">In Progress</button>` : ""}
            <button type="button" class="btn-complaint-resolve" data-id="${c.id}" style="font-size:11px;padding:4px 8px;background:#dcfce7;color:#15803d;">Resolve</button>
          </div>
        ` : `<span style="font-size:11px;color:#15803d;font-weight:700;">✓ Resolved</span>`}
      </td>
    </tr>
  `).join("");

  document.querySelectorAll(".btn-complaint-prog").forEach(b => {
    b.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      await complaintService.updateComplaintStatus(id, "In Progress");
      showToast("Complaint marked In Progress.", "info");
      await refreshAllData(adminAuthContext.currentAdmin.hostelId);
    });
  });

  document.querySelectorAll(".btn-complaint-resolve").forEach(b => {
    b.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      await complaintService.updateComplaintStatus(id, "Resolved");
      showToast("Complaint marked Resolved.", "success");
      await refreshAllData(adminAuthContext.currentAdmin.hostelId);
    });
  });
}

// ============================================================
// 8. ANNOUNCEMENTS RENDERING
// ============================================================
function renderAnnouncements() {
  const tbody = document.getElementById("announcements-table-tbody");
  const dashList = document.getElementById("dashboard-announcements-list");

  // Dashboard feed
  if (dashList) {
    if (appState.announcements.length === 0) {
      dashList.innerHTML = '<p style="color:#94a3b8;">No announcements posted.</p>';
    } else {
      dashList.innerHTML = appState.announcements.slice(0, 3).map(a => `
        <div class="announcement-item">
          <div class="announcement-badge">NOTICE</div>
          <div>
            <b>${escapeHtml(a.title)}</b>
            <p>${escapeHtml(a.content)}</p>
          </div>
        </div>
      `).join("");
    }
  }

  // Announcements Table
  if (tbody) {
    if (appState.announcements.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8;">No announcements created yet.</td></tr>';
      return;
    }
    tbody.innerHTML = appState.announcements.map(a => `
      <tr>
        <td><b>${escapeHtml(a.title)}</b></td>
        <td>${a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toLocaleDateString() : "Today"}</td>
        <td>${escapeHtml(a.audience)}</td>
        <td><em class="green">${escapeHtml(a.status)}</em></td>
        <td>
          <button type="button" class="btn-delete-ann" data-id="${a.id}" style="background:#fee2e2;color:#b91c1c;padding:5px 9px;font-size:11px;border-radius:6px;">Delete</button>
        </td>
      </tr>
    `).join("");

    document.querySelectorAll(".btn-delete-ann").forEach(b => {
      b.addEventListener("click", async (e) => {
        const id = e.target.dataset.id;
        if (!confirm("Delete this announcement?")) return;
        await announcementService.deleteAnnouncement(id);
        showToast("Announcement removed.", "info");
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      });
    });
  }
}

// ============================================================
// 9. MESS TIMETABLE RENDERING
// ============================================================
function renderMessTimetable() {
  const schedule = appState.messSchedule || {};

  const bfDisp = document.getElementById("display-mess-bf");
  const luDisp = document.getElementById("display-mess-lu");
  const diDisp = document.getElementById("display-mess-di");
  if (bfDisp) bfDisp.textContent = schedule.breakfast || "07:30 AM – 09:00 AM";
  if (luDisp) luDisp.textContent = schedule.lunch || "12:30 PM – 02:00 PM";
  if (diDisp) diDisp.textContent = schedule.dinner || "07:30 PM – 09:00 PM";

  const bfInput = document.getElementById("mess-timing-breakfast");
  const luInput = document.getElementById("mess-timing-lunch");
  const diInput = document.getElementById("mess-timing-dinner");
  const menuInput = document.getElementById("mess-menu-today");
  if (bfInput) bfInput.value = schedule.breakfast || "07:30 AM – 09:00 AM";
  if (luInput) luInput.value = schedule.lunch || "12:30 PM – 02:00 PM";
  if (diInput) diInput.value = schedule.dinner || "07:30 PM – 09:00 PM";
  if (menuInput && schedule.menuToday) menuInput.value = schedule.menuToday;

  const weeklyTbody = document.getElementById("mess-weekly-timetable-tbody");
  if (weeklyTbody) {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const weekly = schedule.weeklyMenu || {};
    weeklyTbody.innerHTML = days.map(day => {
      const dayData = weekly[day] || {};
      return `
        <tr>
          <td><b>${day}</b></td>
          <td><input type="text" class="mess-weekly-bf" data-day="${day}" value="${escapeHtml(dayData.breakfast || "Puri / Upma")}" style="width:100%;font-size:12px;"></td>
          <td><input type="text" class="mess-weekly-lu" data-day="${day}" value="${escapeHtml(dayData.lunch || "Rice, Dal, Veg Curry")}" style="width:100%;font-size:12px;"></td>
          <td><input type="text" class="mess-weekly-di" data-day="${day}" value="${escapeHtml(dayData.dinner || "Roti, Mix Veg, Rice")}" style="width:100%;font-size:12px;"></td>
        </tr>
      `;
    }).join("");
  }
}

// ============================================================
// 10. PAYMENTS RENDERING
// ============================================================
function renderPayments() {
  const upiText = document.getElementById("payment-upi-id-text");
  const upiInput = document.getElementById("input-new-upi-id");
  const qrImg = document.getElementById("qr-image-element");
  const qrText = document.getElementById("qr-placeholder-text");

  const upiId = appState.hostelSettings?.upiId || "ellora.hostel@upi";
  if (upiText) upiText.textContent = upiId;
  if (upiInput) upiInput.value = upiId;

  if (appState.hostelSettings?.qrUrl && qrImg && qrText) {
    qrImg.src = appState.hostelSettings.qrUrl;
    qrImg.style.display = "block";
    qrText.style.display = "none";
  }

  // Compute stat card numbers
  let totalCollected = 0;
  let pendingCount = 0;
  let verifiedCount = 0;
  let rejectedCount = 0;

  appState.payments.forEach(p => {
    const s = (p.status || "").toLowerCase();
    if (s === "verified" || s === "approved") {
      verifiedCount++;
      totalCollected += Number(p.amount) || 0;
    } else if (s === "rejected") {
      rejectedCount++;
    } else {
      pendingCount++;
    }
  });

  const statCollected = document.getElementById("pay-stat-total-collected");
  const statPending = document.getElementById("pay-stat-pending");
  const statVerified = document.getElementById("pay-stat-verified");
  const statRejected = document.getElementById("pay-stat-rejected");
  if (statCollected) statCollected.textContent = `₹${totalCollected.toLocaleString()}`;
  if (statPending) statPending.textContent = pendingCount;
  if (statVerified) statVerified.textContent = verifiedCount;
  if (statRejected) statRejected.textContent = rejectedCount;

  // Apply filters
  let filtered = appState.payments;
  if (payFilterState.status !== "all") {
    filtered = filtered.filter(p => (p.status || "") === payFilterState.status);
  }
  if (payFilterState.month) {
    filtered = filtered.filter(p => (p.billingMonth || p.date || "").startsWith(payFilterState.month));
  }

  const tbody = document.getElementById("payments-table-tbody");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:#94a3b8;">No payment transactions match the current filter.</td></tr>`;
    return;
  }

  const adminEmail = adminAuthContext.currentAdmin?.email || "admin";

  tbody.innerHTML = filtered.map(p => {
    const utr = escapeHtml(p.utrNumber || p.transactionId || "—");
    const status = p.status || "Pending";
    const source = p.source === "student" ? "<em class='blue'>Student</em>" : "<em class='green'>Admin</em>";
    const dateStr = p.date || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : "—");
    const billingMonth = escapeHtml(p.billingMonth || "—");
    let statusBadge = "";
    if (status === "Verified") statusBadge = `<em class="green">✅ Verified</em>`;
    else if (status === "Rejected") statusBadge = `<em class="red">❌ Rejected</em>`;
    else statusBadge = `<em class="yellow">⏳ ${escapeHtml(status)}</em>`;

    let actionHtml = "";
    if (status !== "Verified" && status !== "Rejected") {
      actionHtml = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn-verify-pay pay-action-btn pay-verify-btn"
            data-id="${p.id}" data-uid="${p.studentUid || p.studentId || ''}" data-amount="${p.amount}"
            title="Verify this payment">
            ✅ Verify
          </button>
          <button type="button" class="btn-reject-pay pay-action-btn pay-reject-btn"
            data-id="${p.id}"
            data-student="${escapeHtml(p.studentName || p.rollNo || 'Student')}"
            data-amount="₹${Number(p.amount) || 0}"
            data-utr="${utr}"
            title="Reject this payment">
            ❌ Reject
          </button>
        </div>`;
    } else if (status === "Verified") {
      actionHtml = `<span style="font-size:11px;color:#15803d;font-weight:700;">✓ Done</span>`;
    } else {
      actionHtml = `<span style="font-size:11px;color:#b91c1c;font-weight:700;" title="${escapeHtml(p.rejectionReason || '')}">✗ Rejected</span>`;
    }

    // Color-code row border by status
    const rowStyle = status === "Verified" ? "border-left:3px solid #22c55e;" :
                     status === "Rejected" ? "border-left:3px solid #ef4444;" :
                     "border-left:3px solid #f59e0b;";

    return `
      <tr style="${rowStyle}">
        <td>${dateStr}</td>
        <td><b>${escapeHtml(p.studentName || '—')}</b></td>
        <td>${escapeHtml(p.rollNo || '—')}</td>
        <td><b>₹${(Number(p.amount) || 0).toLocaleString()}</b></td>
        <td>${utr}</td>
        <td>${billingMonth}</td>
        <td>${source}</td>
        <td>${statusBadge}</td>
        <td>${actionHtml}</td>
      </tr>
    `;
  }).join("");
}

// ============================================================
// 11. SETTINGS & PROFILE RENDERING
// ============================================================
function renderSettingsForms() {
  const settings = appState.hostelSettings;
  if (!settings) return;

  const nameInput = document.getElementById("settings-hostel-name");
  const codeInput = document.getElementById("settings-hostel-code");
  const wardenNameInput = document.getElementById("settings-warden-name");
  const wardenPhoneInput = document.getElementById("settings-warden-phone");

  if (nameInput) nameInput.value = settings.name || "";
  if (codeInput) codeInput.value = settings.code || "";
  if (wardenNameInput) wardenNameInput.value = settings.wardenName || "Chief Warden";
  if (wardenPhoneInput) wardenPhoneInput.value = settings.wardenPhone || "+91 98765 43210";

  const mealFeeInput = document.getElementById("fee-per-meal");
  const rentInput = document.getElementById("fee-monthly-rent");
  if (mealFeeInput && settings.feePerMeal) mealFeeInput.value = settings.feePerMeal;
  if (rentInput && settings.monthlyRent) rentInput.value = settings.monthlyRent;
}

// ============================================================
// NAVIGATION & EVENT LISTENERS
// ============================================================
function handleNavigation() {
  const hash = window.location.hash || "#login";

  if (adminAuthContext.currentAdmin) {
    const isStudent = adminAuthContext.currentAdmin.role === "student";

    if (isStudent) {
      const activeSectionId = hash.replace("#", "") || "student-profile";
      const sections = document.querySelectorAll("#view-student section");
      sections.forEach(sec => {
        if (sec.id === activeSectionId) {
          sec.style.display = "block";
        } else {
          sec.style.display = "none";
        }
      });

      document.querySelectorAll("#view-student .sidebar .nav a").forEach(a => {
        if (a.getAttribute("href") === `#${activeSectionId}`) {
          a.classList.add("active");
        } else {
          a.classList.remove("active");
        }
      });

      renderStudentActiveSection();
    } else {
      const activeSectionId = hash.replace("#", "") || "dashboard";
      const sections = document.querySelectorAll("#view-admin section");
      sections.forEach(sec => {
        if (sec.id === activeSectionId) {
          sec.style.display = "block";
        } else {
          sec.style.display = "none";
        }
      });

      document.querySelectorAll("#view-admin .sidebar nav a").forEach(a => {
        if (a.getAttribute("href") === `#${activeSectionId}`) {
          a.classList.add("active");
        } else {
          a.classList.remove("active");
        }
      });
    }
  }
}

function setupEvents() {
  // Role selection tabs (Admin vs Student)
  const roleAdminBtn = document.getElementById("btn-role-admin");
  const roleStudentBtn = document.getElementById("btn-role-student");
  const roleInput = document.getElementById("login-role");
  const loginHeaderTitle = document.getElementById("login-header-title");
  const loginHeaderSubtext = document.getElementById("login-header-subtext");
  const loginEmailLabel = document.getElementById("login-email-label");
  const loginEmailInput = document.getElementById("login-email");

  if (roleAdminBtn && roleStudentBtn && roleInput) {
    roleAdminBtn.addEventListener("click", () => {
      roleInput.value = "admin";
      roleAdminBtn.classList.add("active");
      roleAdminBtn.style.background = "#ffffff";
      roleAdminBtn.style.color = "var(--primary)";
      roleAdminBtn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";

      roleStudentBtn.classList.remove("active");
      roleStudentBtn.style.background = "transparent";
      roleStudentBtn.style.color = "#64748b";
      roleStudentBtn.style.boxShadow = "none";

      if (loginHeaderTitle) loginHeaderTitle.textContent = "Administrator Sign In";
      if (loginHeaderSubtext) loginHeaderSubtext.textContent = "Enter your registered administrator email and password to access your hostel control panel.";
      if (loginEmailLabel) loginEmailLabel.textContent = "Administrator Email / Username";
      if (loginEmailInput) loginEmailInput.placeholder = "e.g. admin@example.com";
      const forgotLink = document.getElementById("btn-forgot-password");
      if (forgotLink) forgotLink.textContent = "Forgot Password?";
    });

    roleStudentBtn.addEventListener("click", () => {
      roleInput.value = "student";
      roleStudentBtn.classList.add("active");
      roleStudentBtn.style.background = "#ffffff";
      roleStudentBtn.style.color = "var(--primary)";
      roleStudentBtn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";

      roleAdminBtn.classList.remove("active");
      roleAdminBtn.style.background = "transparent";
      roleAdminBtn.style.color = "#64748b";
      roleAdminBtn.style.boxShadow = "none";

      if (loginHeaderTitle) loginHeaderTitle.textContent = "Student Resident Sign In";
      if (loginHeaderSubtext) loginHeaderSubtext.textContent = "Enter your registered student Roll Number and password to access your resident portal.";
      if (loginEmailLabel) loginEmailLabel.textContent = "Student Roll Number or Email";
      if (loginEmailInput) loginEmailInput.placeholder = "e.g. 25001A501 or student@hostel.local";
      const forgotLink = document.getElementById("btn-forgot-password");
      if (forgotLink) forgotLink.textContent = "Change Password";
    });
  }

  // 1. Password Visibility Toggle
  const togglePassBtn = document.getElementById("btn-toggle-password");
  const loginPassInput = document.getElementById("login-password");
  if (togglePassBtn && loginPassInput) {
    togglePassBtn.addEventListener("click", () => {
      const isPass = loginPassInput.type === "password";
      loginPassInput.type = isPass ? "text" : "password";
      togglePassBtn.textContent = isPass ? "🙈" : "👁️";
    });
  }

  // Show/Hide toggles for every other password field on the page
  document.querySelectorAll("button.btn-toggle-pass:not(#btn-toggle-password)").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      if (!input || !input.tagName || input.tagName.toLowerCase() !== "input") return;
      const isPass = input.type === "password";
      input.type = isPass ? "text" : "password";
      btn.textContent = isPass ? "🙈" : "👁️";
    });
  });

  // 2. Admin / Student Login
  const loginForm = document.getElementById("form-login");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      const selectedRole = document.getElementById("login-role")?.value || "admin";
      const submitBtn = document.getElementById("btn-login-submit");
      const loginErrorEl = document.getElementById("login-error-message");

      if (loginErrorEl) loginErrorEl.style.display = "none";
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Signing in...';

      try {
        const res = await adminAuthContext.login(email, password, selectedRole);
        showToast(`Welcome back, ${res.admin.name || "User"}!`, "success");
      } catch (err) {
        // Show error prominently on the form
        if (loginErrorEl) {
          loginErrorEl.textContent = err.message;
          loginErrorEl.style.display = "block";
        }
        showToast(err.message, "error");
        document.getElementById("login-password").value = "";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      }
    });
  }

  // 3. Forgot Password
  const forgotPassBtn = document.getElementById("btn-forgot-password");
  const forgotModal = document.getElementById("modal-forgot-password");
  const closeForgotModalBtn = document.getElementById("btn-close-forgot-modal");
  const forgotForm = document.getElementById("form-forgot-password");

  function setForgotMode(isStudent) {
    const adminFields = document.getElementById("forgot-admin-fields");
    const studentFields = document.getElementById("forgot-student-fields");
    const titleEl = document.getElementById("forgot-modal-title");
    const descEl = document.getElementById("forgot-modal-desc");
    const submitBtn = document.getElementById("btn-send-reset");

    if (adminFields) adminFields.style.display = isStudent ? "none" : "block";
    if (studentFields) studentFields.style.display = isStudent ? "block" : "none";

    if (isStudent) {
      if (titleEl) titleEl.textContent = "Change Student Password";
      if (descEl) descEl.textContent = "Students sign in with their Roll Number, so no email is needed. Verify your current password and set your new one below.";
      if (submitBtn) submitBtn.textContent = "Change Password";
      const loginId = document.getElementById("login-email").value;
      const rollInput = document.getElementById("forgot-student-roll");
      if (rollInput && loginId) rollInput.value = loginId;
    } else {
      if (titleEl) titleEl.textContent = "Reset Admin Password";
      if (descEl) descEl.textContent = "Enter your registered administrator email address. A password reset link will be dispatched directly to your inbox via Firebase Authentication.";
      if (submitBtn) submitBtn.textContent = "Send Password Reset Link";
      const currentEmail = document.getElementById("login-email").value;
      if (currentEmail) document.getElementById("forgot-email").value = currentEmail;
    }
  }

  if (forgotPassBtn && forgotModal) {
    forgotPassBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const selectedRole = document.getElementById("login-role")?.value || "admin";
      setForgotMode(selectedRole === "student");
      forgotModal.style.display = "flex";
    });
  }

  if (closeForgotModalBtn && forgotModal) {
    closeForgotModalBtn.addEventListener("click", () => {
      forgotModal.style.display = "none";
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-send-reset");
      const selectedRole = document.getElementById("login-role")?.value || "admin";

      if (selectedRole === "student") {
        const roll = (document.getElementById("forgot-student-roll")?.value || "").trim();
        const currentPwd = document.getElementById("forgot-student-current-password")?.value || "";
        const newPwd = document.getElementById("forgot-student-new-password")?.value || "";

        if (!roll) {
          showToast("Please enter your roll number.", "error");
          return;
        }
        if (!currentPwd) {
          showToast("Please enter your current password.", "error");
          return;
        }
        if (!newPwd || newPwd.length < 6) {
          showToast("New password must be at least 6 characters.", "error");
          return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Updating...';

        try {
          const msg = await adminAuthContext.changeStudentPassword(roll, currentPwd, newPwd);
          showToast(msg, "success");
          document.getElementById("forgot-student-current-password").value = "";
          document.getElementById("forgot-student-new-password").value = "";
          forgotModal.style.display = "none";
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Change Password";
        }
        return;
      }

      // Admin mode: Firebase email reset link
      const email = (document.getElementById("forgot-email").value || "").trim();
      if (!email) {
        showToast("Please enter your email address.", "error");
        return;
      }
      // Safety net: if the admin form receives a Roll Number (no "@") or a roll-based
      // student email, switch automatically to the student change-password flow.
      const looksLikeStudent = !/@/.test(email) || /@hostel\.local$/i.test(email);
      if (looksLikeStudent) {
        setForgotMode(true);
        // Sync the hidden role + tab UI so the next submit runs the student
        // change-password branch instead of looping back to this admin branch.
        const roleInput = document.getElementById("login-role");
        if (roleInput) roleInput.value = "student";
        const roleAdminBtn = document.getElementById("btn-role-admin");
        const roleStudentBtn = document.getElementById("btn-role-student");
        if (roleAdminBtn && roleStudentBtn) {
          roleStudentBtn.classList.add("active");
          roleStudentBtn.style.background = "#ffffff";
          roleStudentBtn.style.color = "var(--primary)";
          roleStudentBtn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
          roleAdminBtn.classList.remove("active");
          roleAdminBtn.style.background = "transparent";
          roleAdminBtn.style.color = "#64748b";
          roleAdminBtn.style.boxShadow = "none";
        }
        const forgotLink = document.getElementById("btn-forgot-password");
        if (forgotLink) forgotLink.textContent = "Change Password";
        const rollInput = document.getElementById("forgot-student-roll");
        if (rollInput) rollInput.value = email;
        showToast("That's a student account — showing the student security form.", "info");
        return;
      }
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Sending...';

      try {
        const msg = await adminAuthContext.resetPassword(email);
        showToast(msg, "success");
        forgotModal.style.display = "none";
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Send Password Reset Link";
      }
    });
  }

  // 4. Dashboard Search
  const searchInput = document.getElementById("dashboard-search-input");
  const searchBtn = document.getElementById("btn-dashboard-search");
  if (searchInput) searchInput.addEventListener("input", handleDashboardSearch);
  if (searchBtn) searchBtn.addEventListener("click", handleDashboardSearch);

  // 5. Add Student
  const addStudentForm = document.getElementById("form-add-student");
  if (addStudentForm) {
    addStudentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const rollNo = document.getElementById("new-student-roll").value;
      const password = document.getElementById("new-student-password").value;
      const branch = document.getElementById("new-student-branch").value;
      const year = document.getElementById("new-student-year").value;
      const joiningMonth = document.getElementById("new-student-joining-month")?.value || new Date().toISOString().substring(0, 7);
      const btn = document.getElementById("btn-submit-add-student");

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Creating Account...';

      try {
        const res = await adminAuthContext.createStudent({ rollNo, password, branch, year, joiningMonth });
        showToast(`Student created for Roll No ${rollNo}! (Joined ${joiningMonth})`, "success");
        addStudentForm.reset();
        const jmInput = document.getElementById("new-student-joining-month");
        if (jmInput) jmInput.value = new Date().toISOString().substring(0, 7);
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Create Student Account";
      }
    });
  }

  // 5b. Edit Student Modal
  const editStudentModal = document.getElementById("modal-edit-student");
  const closeEditStudentModalBtn = document.getElementById("btn-close-edit-student-modal");
  const editStudentForm = document.getElementById("form-edit-student");

  if (closeEditStudentModalBtn && editStudentModal) {
    closeEditStudentModalBtn.addEventListener("click", () => {
      editStudentModal.style.display = "none";
    });
  }

  if (editStudentModal) {
    editStudentModal.addEventListener("click", (e) => {
      if (e.target === editStudentModal) editStudentModal.style.display = "none";
    });
  }

  if (editStudentForm) {
    editStudentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const uid = document.getElementById("edit-student-uid").value;
      const name = document.getElementById("edit-student-name").value.trim();
      const email = document.getElementById("edit-student-email").value.trim().toLowerCase();
      const branch = document.getElementById("edit-student-branch").value;
      const year = document.getElementById("edit-student-year").value;
      const joiningMonth = document.getElementById("edit-student-joining-month").value;
      const status = document.getElementById("edit-student-status").value;
      const btn = document.getElementById("btn-save-edit-student");

      if (!uid || !name || !email || !joiningMonth) {
        showToast("Please fill in all required fields.", "error");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Saving...';

      try {
        await studentService.updateStudent(uid, { name, email, branchName: branch, year, joiningMonth, status });
        showToast(`Student ${document.getElementById("edit-student-roll").value} updated successfully.`, "success");
        editStudentModal.style.display = "none";
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Save Changes";
      }
    });
  }

  // 6. Student Filters & Search
  const branchFilter = document.getElementById("filter-students-branch");
  const studentSearchInput = document.getElementById("input-search-students");
  if (branchFilter) branchFilter.addEventListener("change", renderStudents);
  if (studentSearchInput) studentSearchInput.addEventListener("input", renderStudents);

  // 7. CSV Export
  const exportBtn = document.getElementById("btn-export-students-csv");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      try {
        await exportService.exportStudentsCSV(adminAuthContext.currentAdmin.hostelId, adminAuthContext.currentHostel?.name);
        showToast("Student CSV roster downloaded.", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // 8. Add Branch
  const addBranchForm = document.getElementById("form-add-branch");
  if (addBranchForm) {
    addBranchForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = document.getElementById("new-branch-code").value;
      const name = document.getElementById("new-branch-name").value;
      try {
        await branchService.addBranch(adminAuthContext.currentAdmin.hostelId, { code, name });
        showToast(`Branch ${code} added.`, "success");
        addBranchForm.reset();
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // 9. Add Room
  const addRoomForm = document.getElementById("form-add-room");
  if (addRoomForm) {
    addRoomForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const roomNo = document.getElementById("new-room-no").value;
      const capacity = document.getElementById("new-room-capacity").value;
      const floor = document.getElementById("new-room-floor").value;
      const branchPreference = document.getElementById("new-room-branch-pref").value;
      try {
        await roomService.addRoom(adminAuthContext.currentAdmin.hostelId, { roomNo, capacity, floor, branchPreference });
        showToast(`Room ${roomNo} on Floor ${floor} added.`, "success");
        addRoomForm.reset();
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // 10. ALLOTMENT PAGE — New Event Bindings
  const allotStudentSearch = document.getElementById('allot-student-search');
  if (allotStudentSearch) allotStudentSearch.addEventListener('input', (e) => { allotState.searchStudent = e.target.value; renderStudentPanel(); });

  const allotBranchFilter = document.getElementById('allot-branch-filter');
  if (allotBranchFilter) allotBranchFilter.addEventListener('change', (e) => { allotState.filterBranch = e.target.value; renderStudentPanel(); });

  const allotRoomSearch = document.getElementById('allot-room-search');
  if (allotRoomSearch) allotRoomSearch.addEventListener('input', (e) => { allotState.searchRoom = e.target.value; renderRoomGrid(); });

  const allotFloorFilter = document.getElementById('allot-floor-filter');
  if (allotFloorFilter) allotFloorFilter.addEventListener('change', (e) => { allotState.filterFloor = e.target.value; renderRoomGrid(); });

  const selectAllBtn = document.getElementById('allot-select-all-visible');
  if (selectAllBtn) selectAllBtn.addEventListener('click', () => {
    const visible = getFilteredStudents().filter(s => !(s.roomNo && s.roomNo !== 'Unassigned' && s.roomNo !== '—'));
    const allSel = visible.every(s => allotState.selectedStudentUids.has(s.uid || s.id));
    visible.forEach(s => { if (allSel) allotState.selectedStudentUids.delete(s.uid || s.id); else allotState.selectedStudentUids.add(s.uid || s.id); });
    renderStudentPanel();
    updateAllotmentSummary();
  });

  const allotOpenBtn = document.getElementById('btn-allot-confirm-open');
  if (allotOpenBtn) allotOpenBtn.addEventListener('click', openAllotModal);

  const allotConfirmBtn = document.getElementById('btn-allot-confirm');
  if (allotConfirmBtn) allotConfirmBtn.addEventListener('click', confirmAllotment);

  const allotModalClose = document.getElementById('btn-allot-modal-close');
  if (allotModalClose) allotModalClose.addEventListener('click', () => { document.getElementById('allot-confirm-modal').style.display = 'none'; });

  const allotModalCancel = document.getElementById('btn-allot-modal-cancel');
  if (allotModalCancel) allotModalCancel.addEventListener('click', () => { document.getElementById('allot-confirm-modal').style.display = 'none'; });

  const reallocOpenBtn = document.getElementById('btn-reallocate-open');
  if (reallocOpenBtn) reallocOpenBtn.addEventListener('click', openReallocateModal);

  const reallocConfirmBtn = document.getElementById('btn-reallocate-confirm');
  if (reallocConfirmBtn) reallocConfirmBtn.addEventListener('click', confirmReallocation);

  const reallotClose = document.getElementById('btn-reallot-modal-close');
  if (reallotClose) reallotClose.addEventListener('click', () => { document.getElementById('reallot-confirm-modal').style.display = 'none'; });

  const reallotCancel = document.getElementById('btn-reallot-modal-cancel');
  if (reallotCancel) reallotCancel.addEventListener('click', () => { document.getElementById('reallot-confirm-modal').style.display = 'none'; });

  // 11. Sidebar Collapse & Toggle Handlers
  document.querySelectorAll(".btn-sidebar-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const portal = btn.closest(".portal-layout");
      if (portal) {
        portal.classList.toggle("sidebar-collapsed");
      }
    });
  });

  // 12. Attendance Handlers & Mode Switch
  const modeMarkBtn = document.getElementById("btn-mode-mark-attendance");
  const modeViewBtn = document.getElementById("btn-mode-view-attendance");
  const markCard = document.getElementById("attendance-mark-card");
  const historyCard = document.getElementById("attendance-history-card");

  if (modeMarkBtn && modeViewBtn && markCard && historyCard) {
    modeMarkBtn.addEventListener("click", () => {
      markCard.style.display = "block";
      historyCard.style.display = "none";
      modeMarkBtn.style.background = "var(--primary)";
      modeMarkBtn.style.color = "#ffffff";
      modeViewBtn.style.background = "none";
      modeViewBtn.style.color = "var(--primary)";
    });

    modeViewBtn.addEventListener("click", () => {
      markCard.style.display = "none";
      historyCard.style.display = "block";
      modeViewBtn.style.background = "var(--primary)";
      modeViewBtn.style.color = "#ffffff";
      modeMarkBtn.style.background = "none";
      modeMarkBtn.style.color = "var(--primary)";

      const historyDateInput = document.getElementById("history-attendance-date");
      if (historyDateInput && !historyDateInput.value) {
        historyDateInput.value = new Date().toISOString().slice(0, 10);
      }
    });
  }

  const fetchHistoryBtn = document.getElementById("btn-fetch-history-attendance");
  if (fetchHistoryBtn) {
    fetchHistoryBtn.addEventListener("click", fetchAttendanceHistory);
  }

  const loadAttendanceBtn = document.getElementById("btn-load-attendance");
  const saveAttendanceBtn = document.getElementById("btn-save-attendance");
  const attendanceDateEl = document.getElementById("attendance-date");

  if (attendanceDateEl) {
    attendanceDateEl.addEventListener("change", loadAttendanceRoster);
  }

  if (loadAttendanceBtn) loadAttendanceBtn.addEventListener("click", loadAttendanceRoster);

  if (saveAttendanceBtn) {
    saveAttendanceBtn.addEventListener("click", async () => {
      const dateStr = document.getElementById("attendance-date")?.value || new Date().toISOString().slice(0, 10);
      const meal = document.getElementById("attendance-meal")?.value || "Lunch";
      const checkedUids = [];
      document.querySelectorAll(".attendance-check:checked").forEach(cb => {
        checkedUids.push(cb.dataset.uid);
      });

      let mealCost = 50;
      if (meal === "Breakfast") mealCost = parseFloat(document.getElementById("meal-price-breakfast")?.value) || 30;
      else if (meal === "Lunch") mealCost = parseFloat(document.getElementById("meal-price-lunch")?.value) || 50;
      else if (meal === "Dinner") mealCost = parseFloat(document.getElementById("meal-price-dinner")?.value) || 45;
      else {
        const found = currentCustomMeals.find(m => m.name === meal);
        if (found) mealCost = found.price;
      }

      try {
        await attendanceService.saveAttendance(adminAuthContext.currentAdmin.hostelId, dateStr, meal, checkedUids, mealCost);
        showToast(`Saved attendance for ${meal} (${checkedUids.length} present).`, "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // Monthly Finalize Handlers
  const finalizeMonthSelect = document.getElementById("finalize-month-select");
  const triggerFinalizeBtn = document.getElementById("btn-trigger-finalize-month");
  const modalFinalize = document.getElementById("modal-confirm-finalize");
  const closeFinalizeBtn = document.getElementById("btn-close-finalize-modal");
  const cancelFinalizeBtn = document.getElementById("btn-cancel-finalize");
  const proceedFinalizeBtn = document.getElementById("btn-proceed-finalize");
  const finalizeStatusInfo = document.getElementById("finalize-status-info");

  const checkFinalizeStatus = async () => {
    if (!finalizeMonthSelect || !finalizeStatusInfo) return;
    const mVal = finalizeMonthSelect.value;
    const isFin = await attendanceService.isMonthFinalized(adminAuthContext.currentAdmin.hostelId, mVal);
    if (isFin) {
      finalizeStatusInfo.innerHTML = `Status: <span style="color:#059669;">🔒 FINALIZED & PUBLISHED (Locked)</span>`;
      if (triggerFinalizeBtn) triggerFinalizeBtn.textContent = "RE-PUBLISH / UPDATE MONTH";
    } else {
      finalizeStatusInfo.innerHTML = `Status: <span style="color:#d97706;">📝 EDITABLE (Not published yet)</span>`;
      if (triggerFinalizeBtn) triggerFinalizeBtn.textContent = "PUBLISH / FINALIZE MONTH";
    }
  };

  if (finalizeMonthSelect) {
    finalizeMonthSelect.addEventListener("change", checkFinalizeStatus);
    checkFinalizeStatus();
    loadPublishedBills();
  }

  if (triggerFinalizeBtn && modalFinalize) {
    triggerFinalizeBtn.addEventListener("click", () => {
      const selectedOpt = finalizeMonthSelect ? finalizeMonthSelect.options[finalizeMonthSelect.selectedIndex].text : "Selected Month";
      const confirmMsg = document.getElementById("finalize-confirm-message");
      if (confirmMsg) {
        confirmMsg.textContent = `Publishing ${selectedOpt} will finalize the attendance records and calculate student fees for this month. This action should not be reversed without administrator authorization.`;
      }
      modalFinalize.style.display = "flex";
    });
  }

  if (closeFinalizeBtn) closeFinalizeBtn.addEventListener("click", () => { if (modalFinalize) modalFinalize.style.display = "none"; });
  if (cancelFinalizeBtn) cancelFinalizeBtn.addEventListener("click", () => { if (modalFinalize) modalFinalize.style.display = "none"; });

  if (proceedFinalizeBtn) {
    proceedFinalizeBtn.addEventListener("click", async () => {
      const monthKey = finalizeMonthSelect?.value || "2026_09";
      const selectedOpt = finalizeMonthSelect ? finalizeMonthSelect.options[finalizeMonthSelect.selectedIndex].text : "Selected Month";
      try {
        await attendanceService.finalizeMonth(adminAuthContext.currentAdmin.hostelId, monthKey, adminAuthContext.currentAdmin?.uid);
        showToast(`Successfully published & finalized attendance for ${selectedOpt}!`, "success");
        if (modalFinalize) modalFinalize.style.display = "none";
        await checkFinalizeStatus();
        await loadAttendanceRoster();
        await loadPublishedBills();
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // Previously Published Bills: list / view / delete
  const refreshPublishedBtn = document.getElementById("btn-refresh-published-bills");
  if (refreshPublishedBtn) {
    refreshPublishedBtn.addEventListener("click", async () => {
      await loadPublishedBills();
    });
  }

  const publishedTbody = document.getElementById("published-bills-tbody");
  if (publishedTbody) {
    publishedTbody.addEventListener("click", async (e) => {
      const viewBtn = e.target.closest("[data-month].btn-view-published, .btn-view-published");
      const delBtn = e.target.closest("[data-month].btn-delete-published, .btn-delete-published");
      if (viewBtn && viewBtn.dataset.month) {
        await openPublishedBillDetails(viewBtn.dataset.month);
        return;
      }
      if (delBtn && delBtn.dataset.month) {
        const mk = delBtn.dataset.month;
        const hiddenInput = document.getElementById("delete-published-month-key");
        const msgEl = document.getElementById("delete-published-confirm-message");
        const delModal = document.getElementById("modal-confirm-delete-published");
        if (hiddenInput) hiddenInput.value = mk;
        if (msgEl) msgEl.textContent = `Permanently delete the published bill for ${formatPublishedMonthLabel(mk)}? This removes all ${formatPublishedMonthLabel(mk)} fee statements and unlocks the month so attendance can be edited and re-published. Payments already recorded are kept.`;
        if (delModal) delModal.style.display = "flex";
      }
    });
  }

  const detailsModal = document.getElementById("modal-published-bill-details");
  const closeDetailsBtn = document.getElementById("btn-close-published-bill-modal");
  const closeDetailsBtn2 = document.getElementById("btn-close-published-bill-details");
  if (closeDetailsBtn && detailsModal) closeDetailsBtn.addEventListener("click", () => { detailsModal.style.display = "none"; });
  if (closeDetailsBtn2 && detailsModal) closeDetailsBtn2.addEventListener("click", () => { detailsModal.style.display = "none"; });
  if (detailsModal) detailsModal.addEventListener("click", (e) => { if (e.target === detailsModal) detailsModal.style.display = "none"; });

  const delModal = document.getElementById("modal-confirm-delete-published");
  const closeDelBtn = document.getElementById("btn-close-delete-published-modal");
  const cancelDelBtn = document.getElementById("btn-cancel-delete-published");
  const proceedDelBtn = document.getElementById("btn-proceed-delete-published");
  if (closeDelBtn && delModal) closeDelBtn.addEventListener("click", () => { delModal.style.display = "none"; });
  if (cancelDelBtn && delModal) cancelDelBtn.addEventListener("click", () => { delModal.style.display = "none"; });
  if (delModal) delModal.addEventListener("click", (e) => { if (e.target === delModal) delModal.style.display = "none"; });
  if (proceedDelBtn) {
    proceedDelBtn.addEventListener("click", async () => {
      const mk = document.getElementById("delete-published-month-key")?.value || "";
      if (!mk) return;
      proceedDelBtn.disabled = true;
      proceedDelBtn.innerHTML = '<span class="spinner"></span> Deleting...';
      try {
        const res = await attendanceService.deletePublishedMonth(adminAuthContext.currentAdmin.hostelId, mk);
        showToast(`Deleted published bill for ${formatPublishedMonthLabel(mk)} (${res.deletedStatements} statements removed). Month is editable again.`, "success");
        if (delModal) delModal.style.display = "none";
        await checkFinalizeStatus();
        await loadAttendanceRoster();
        await loadPublishedBills();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        proceedDelBtn.disabled = false;
        proceedDelBtn.textContent = "Delete Bill";
      }
    });
  }

  // Custom meal item handler
  const addCustomItemBtn = document.getElementById("btn-add-custom-item");
  if (addCustomItemBtn) {
    addCustomItemBtn.addEventListener("click", () => {
      const nameInput = document.getElementById("input-custom-meal-name");
      const priceInput = document.getElementById("input-custom-meal-price");
      const name = (nameInput?.value || "").trim();
      const price = parseFloat(priceInput?.value) || 0;

      if (!name) {
        showToast("Please enter custom meal item name.", "error");
        return;
      }

      currentCustomMeals.push({ name, price });
      renderCustomMealChips();
      populateMealDropdowns();
      if (nameInput) nameInput.value = "";
      if (priceInput) priceInput.value = "";
      showToast(`Added custom meal: ${name} (₹${price})`, "info");
    });
  }

  // Set default attendance date to today
  const attendanceDateInput = document.getElementById("attendance-date");
  if (attendanceDateInput && !attendanceDateInput.value) {
    attendanceDateInput.value = new Date().toISOString().slice(0, 10);
  }

  // 12. Register Complaint
  const complaintForm = document.getElementById("form-admin-new-complaint");
  if (complaintForm) {
    complaintForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const studentName = document.getElementById("complaint-student-name").value;
      const roomNo = document.getElementById("complaint-room-no").value;
      const category = document.getElementById("complaint-category-select").value;
      const description = document.getElementById("complaint-desc").value;

      try {
        await complaintService.addComplaint(adminAuthContext.currentAdmin.hostelId, {
          studentName, roomNo, category, description
        });
        showToast("Complaint registered.", "success");
        complaintForm.reset();
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // 13. Single Fee Configuration Form & Month Selection
  const monthSelect = document.getElementById("fee-month-select");
  if (monthSelect) {
    monthSelect.addEventListener("change", renderMealPricingForm);
  }

  const feeSettingsForm = document.getElementById("form-fee-settings");
  if (feeSettingsForm) {
    feeSettingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const monthStr = document.getElementById("fee-month-select")?.value || "2026_09";
      const monthlyRent = parseFloat(document.getElementById("fee-monthly-rent").value) || 2000;
      const breakfastPrice = parseFloat(document.getElementById("meal-price-breakfast")?.value) || 30;
      const lunchPrice = parseFloat(document.getElementById("meal-price-lunch")?.value) || 50;
      const dinnerPrice = parseFloat(document.getElementById("meal-price-dinner")?.value) || 45;

      try {
        await feeService.saveFeeConfig(adminAuthContext.currentAdmin.hostelId, monthStr, monthlyRent, 50, {
          breakfastPrice,
          lunchPrice,
          dinnerPrice,
          customMeals: currentCustomMeals
        });
        showToast(`Saved fee rates & meal prices for ${monthStr}!`, "success");
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  const calcFeeBtn = document.getElementById("btn-calc-total-fee");
  if (calcFeeBtn) {
    calcFeeBtn.addEventListener("click", () => {
      const studentUid = document.getElementById("fee-calc-student-select").value;
      const meals = parseInt(document.getElementById("fee-calc-meals-count").value, 10) || 0;
      const maintenance = parseFloat(document.getElementById("fee-calc-maintenance").value) || 0;
      const rate = parseFloat(document.getElementById("fee-per-meal").value) || 50;
      const rent = parseFloat(document.getElementById("fee-monthly-rent").value) || 2000;

      const total = rent + (meals * rate) + maintenance;
      const resultBox = document.getElementById("fee-calc-result-box");
      if (resultBox) {
        resultBox.innerHTML = `
          <div>Calculated Total: <b>₹${total.toLocaleString()}</b></div>
          <small style="font-size:12px;font-weight:400;color:#64748b;">
            Rent (₹${rent}) + Meals (${meals} × ₹${rate} = ₹${meals * rate}) + Maintenance (₹${maintenance})
          </small>
        `;
        resultBox.style.display = "block";
      }
    });
  }

  // 14. Create Announcement
  const annForm = document.getElementById("form-new-announcement");
  if (annForm) {
    annForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("announcement-title").value;
      const audience = document.getElementById("announcement-audience").value;
      const content = document.getElementById("announcement-content").value;
      try {
        await announcementService.addAnnouncement(adminAuthContext.currentAdmin.hostelId, { title, audience, content });
        showToast("Notice published.", "success");
        annForm.reset();
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // 15. Save Mess Timetable & Weekly Schedule
  const messForm = document.getElementById("form-mess-timetable");
  if (messForm) {
    messForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const breakfast = document.getElementById("mess-timing-breakfast").value;
      const lunch = document.getElementById("mess-timing-lunch").value;
      const dinner = document.getElementById("mess-timing-dinner").value;
      const menuToday = document.getElementById("mess-menu-today").value;

      const weeklyMenu = {};
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      days.forEach(day => {
        const bfVal = document.querySelector(`.mess-weekly-bf[data-day="${day}"]`)?.value || "";
        const luVal = document.querySelector(`.mess-weekly-lu[data-day="${day}"]`)?.value || "";
        const diVal = document.querySelector(`.mess-weekly-di[data-day="${day}"]`)?.value || "";
        weeklyMenu[day] = { breakfast: bfVal, lunch: luVal, dinner: diVal };
      });

      try {
        await messService.saveMessTimetable(adminAuthContext.currentAdmin.hostelId, { breakfast, lunch, dinner, menuToday, weeklyMenu });
        showToast("Mess schedule & weekly timetable saved!", "success");
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // 16. Update UPI & Upload QR Code
  const upiForm = document.getElementById("form-upi-update");
  if (upiForm) {
    upiForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const upiId = document.getElementById("input-new-upi-id").value;
      const qrFileInput = document.getElementById("input-qr-file");
      const btn = document.getElementById("btn-save-upi-qr");

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Saving...';

      try {
        if (qrFileInput && qrFileInput.files && qrFileInput.files[0]) {
          const newQrUrl = await paymentSettingsService.uploadQR(adminAuthContext.currentAdmin.hostelId, qrFileInput.files[0]);
          if (adminAuthContext.currentHostel) adminAuthContext.currentHostel.qrUrl = newQrUrl;
          if (appState.hostelSettings) appState.hostelSettings.qrUrl = newQrUrl;
          showToast("Payment QR code uploaded successfully!", "success");
        }

        if (upiId) {
          await hostelSettingsService.updateSettings(adminAuthContext.currentAdmin.hostelId, { upiId });
          if (adminAuthContext.currentHostel) adminAuthContext.currentHostel.upiId = upiId;
          showToast("Hostel UPI ID updated.", "success");
        }

        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Save Payment Settings";
      }
    });
  }

  const recordPayForm = document.getElementById("form-record-payment");
  if (recordPayForm) {
    recordPayForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const studentUid = document.getElementById("record-payment-student-select").value;
      const amount = parseFloat(document.getElementById("record-payment-amount").value) || 0;
      const transactionId = document.getElementById("record-payment-utr").value;
      const billingMonth = document.getElementById("record-payment-billing-month")?.value || new Date().toISOString().slice(0,7);
      const notes = document.getElementById("record-payment-notes")?.value || "";

      const student = appState.students.find(s => s.uid === studentUid);
      const studentName = student ? (student.name || student.rollNo) : "Resident";
      const rollNo = student ? student.rollNo : "N/A";

      const btn = document.getElementById("btn-submit-payment");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Recording...';

      try {
        await paymentService.recordPayment(adminAuthContext.currentAdmin.hostelId, {
          studentUid, studentName, rollNo, amount, transactionId, billingMonth,
          adminEmail: adminAuthContext.currentAdmin?.email || "admin",
          notes
        });
        showToast(`✅ Payment of ₹${amount.toLocaleString()} recorded & verified for ${studentName}!`, "success");
        recordPayForm.reset();
        // Pre-fill billing month
        const bm = document.getElementById("record-payment-billing-month");
        if (bm) bm.value = new Date().toISOString().slice(0, 7);
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "✅ Record & Verify Payment";
      }
    });
  }

  // 17. Seed Initial Data Tool
  const seedBtn = document.getElementById("btn-seed-data");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      if (!confirm("Seed initial branches, sample rooms, and notices into Cloud Firestore?")) return;
      seedBtn.disabled = true;
      seedBtn.textContent = "Seeding data into Cloud Firestore...";
      try {
        await hostelSettingsService.seedInitialData(adminAuthContext.currentAdmin.hostelId);
        showToast("Initial sample data seeded successfully!", "success");
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        seedBtn.disabled = false;
        seedBtn.textContent = "Seed Initial Sample Data in Firestore";
      }
    });
  }

  // 18. Hostel Profile Save
  const profileForm = document.getElementById("form-hostel-profile");
  if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("settings-hostel-name").value;
      const code = document.getElementById("settings-hostel-code").value;
      const wardenName = document.getElementById("settings-warden-name").value;
      const wardenPhone = document.getElementById("settings-warden-phone").value;

      try {
        await hostelSettingsService.updateSettings(adminAuthContext.currentAdmin.hostelId, {
          name, code, wardenName, wardenPhone
        });
        showToast("Hostel profile updated.", "success");
        await adminAuthContext.loadAdminAndHostel(adminAuthContext.currentAdmin.uid, adminAuthContext.currentAdmin.email);
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // 19. Logout Triggers
  document.querySelectorAll(".btn-logout-trigger, .btn-student-logout-trigger").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      await adminAuthContext.logout();
      showToast("Signed out successfully.", "info");
    });
  });

  // 19b. Payment Filter Tabs (Admin Ledger)
  const payStatusTabs = document.getElementById("pay-status-tabs");
  if (payStatusTabs) {
    payStatusTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".pay-tab");
      if (!btn) return;
      payStatusTabs.querySelectorAll(".pay-tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      payFilterState.status = btn.dataset.status || "all";
      renderPayments();
    });
  }

  const payMonthFilter = document.getElementById("pay-ledger-month-filter");
  if (payMonthFilter) {
    payMonthFilter.addEventListener("change", () => {
      payFilterState.month = payMonthFilter.value || "";
      renderPayments();
    });
  }

  // 19c. Reject Payment Modal Handlers
  const rejectModal = document.getElementById("modal-reject-payment");
  const closeRejectBtn = document.getElementById("btn-close-reject-modal");
  const cancelRejectBtn = document.getElementById("btn-cancel-reject-payment");
  const confirmRejectBtn = document.getElementById("btn-confirm-reject-payment");

  if (closeRejectBtn) closeRejectBtn.addEventListener("click", () => { if (rejectModal) rejectModal.style.display = "none"; });
  if (cancelRejectBtn) cancelRejectBtn.addEventListener("click", () => { if (rejectModal) rejectModal.style.display = "none"; });

  if (confirmRejectBtn) {
    confirmRejectBtn.addEventListener("click", async () => {
      const paymentId = document.getElementById("reject-payment-id")?.value;
      const reason = document.getElementById("reject-payment-reason")?.value;
      if (!paymentId) return;
      if (!reason || reason.trim().length < 3) {
        showToast("Please enter a rejection reason (at least 3 characters).", "error");
        return;
      }
      confirmRejectBtn.disabled = true;
      confirmRejectBtn.innerHTML = '<span class="spinner"></span> Rejecting...';
      try {
        await paymentService.rejectPayment(paymentId, adminAuthContext.currentAdmin?.email, reason);
        showToast("Payment rejected. Student will see the reason in their history.", "info");
        if (rejectModal) rejectModal.style.display = "none";
        await refreshAllData(adminAuthContext.currentAdmin.hostelId);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        confirmRejectBtn.disabled = false;
        confirmRejectBtn.textContent = "Confirm Rejection";
      }
    });
  }

  // 20. Student Form Handlers
  const utrForm = document.getElementById("form-student-submit-utr");
  if (utrForm) {
    utrForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentStudentProfile) return;
      const amount = document.getElementById("student-utr-amount").value;
      const utrNumber = document.getElementById("student-utr-number").value;
      const paymentDate = document.getElementById("student-utr-date").value;
      const remarks = document.getElementById("student-utr-remarks")?.value || "";
      const billingMonth = document.getElementById("student-utr-billing-month")?.value || new Date().toISOString().slice(0, 7);

      const submitBtn = utrForm.querySelector("button[type=submit]");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner"></span> Submitting...'; }

      try {
        await studentPortalService.submitStudentPayment(
          currentStudentProfile.hostelId,
          currentStudentProfile.uid,
          currentStudentProfile.rollNo,
          { amount, utrNumber, paymentDate, remarks, billingMonth }
        );
        showToast("Payment reference submitted! Warden will verify your UTR.", "success");
        // Show success banner
        const banner = document.getElementById("utr-submit-success-banner");
        if (banner) { banner.style.display = "block"; setTimeout(() => { banner.style.display = "none"; }, 8000); }
        utrForm.reset();
        // Re-set billing month default
        const bm = document.getElementById("student-utr-billing-month");
        if (bm) bm.value = new Date().toISOString().slice(0, 7);
        await loadStudentPayments();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "📤 Submit Transaction Details"; }
      }
    });
  }

  const studentComplaintForm = document.getElementById("form-student-new-complaint");
  if (studentComplaintForm) {
    studentComplaintForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentStudentProfile) return;
      const category = document.getElementById("student-complaint-category").value;
      const description = document.getElementById("student-complaint-desc").value;

      const roomData = await studentPortalService.getStudentRoom(currentStudentProfile.uid, currentStudentProfile.hostelId);
      const roomNo = roomData ? roomData.roomNo : "Unassigned";

      try {
        await studentPortalService.submitStudentComplaint(
          currentStudentProfile.hostelId,
          currentStudentProfile.uid,
          currentStudentProfile.rollNo,
          currentStudentProfile.name,
          roomNo,
          { category, description }
        );
        showToast("Complaint ticket raised successfully!", "success");
        studentComplaintForm.reset();
        await loadStudentComplaints();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  const pwdForm = document.getElementById("form-student-change-password");
  if (pwdForm) {
    pwdForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentPwd = document.getElementById("student-current-password")?.value || "";
      const newPwd = document.getElementById("student-new-password")?.value || "";
      const confirmPwd = document.getElementById("student-confirm-new-password")?.value || "";
      const btn = document.getElementById("btn-submit-student-change-password");

      if (!currentPwd) {
        showToast("Please enter your current password.", "error");
        return;
      }
      if (!newPwd || newPwd.length < 6) {
        showToast("New password must be at least 6 characters.", "error");
        return;
      }
      if (newPwd !== confirmPwd) {
        showToast("New password and confirmation do not match.", "error");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Updating...';

      try {
        const identifier = currentStudentProfile?.rollNo || auth.currentUser?.email || currentStudentProfile?.email || "";
        const msg = await adminAuthContext.changeStudentPassword(identifier, currentPwd, newPwd);
        showToast(msg, "success");
        pwdForm.reset();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Update Password";
      }
    });
  }

  const adminPwdForm = document.getElementById("form-change-password-admin");
  if (adminPwdForm) {
    adminPwdForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentPwd = document.getElementById("admin-current-password")?.value || "";
      const newPwd = document.getElementById("admin-new-password").value;
      if (!currentPwd) {
        showToast("Please enter your current password.", "error");
        return;
      }
      if (!newPwd || newPwd.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
      }
      try {
        if (isLiveFirebase && auth.currentUser) {
          // Re-authenticate first so Firebase accepts the update even on old sessions
          const email = auth.currentUser.email || "";
          await reauthenticateWithCredential(
            auth.currentUser,
            EmailAuthProvider.credential(email, currentPwd)
          );
          if (String(newPwd) !== String(currentPwd)) {
            await updatePassword(auth.currentUser, newPwd);
          }
          showToast(String(newPwd) === String(currentPwd)
            ? "New password matches the current one, no update needed."
            : "Admin password updated successfully.", "success");
        } else {
          showToast("Admin password updated successfully.", "success");
        }
        adminPwdForm.reset();
      } catch (err) {
        let msg = err.message;
        if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
          msg = "Current password is incorrect.";
        } else if (err.code === "auth/weak-password") {
          msg = "New password is too weak. Use at least 6 characters.";
        }
        showToast(msg, "error");
      }
    });
  }

  const btnCalcFee = document.getElementById("btn-calc-student-fee");
  if (btnCalcFee) {
    btnCalcFee.addEventListener("click", () => {
      loadStudentPayments();
    });
  }

  // 21. Navigation Listeners
  window.addEventListener("hashchange", () => {
    adminAuthContext.enforceRouteGuard();
    handleNavigation();
  });
}

// ============================================================
// STUDENT PORTAL RENDERERS
// ============================================================
let currentStudentProfile = null;

async function renderStudentPortal(user, hostel) {
  if (!user || !user.uid) return;

  // Set Topbar info
  const topbarHostel = document.getElementById("student-topbar-hostel-name");
  const topbarName = document.getElementById("student-topbar-name");
  const topbarRoll = document.getElementById("student-topbar-roll");
  const topbarInitials = document.getElementById("student-avatar-initials");

  if (topbarHostel) topbarHostel.textContent = hostel ? (hostel.name || hostel.id) : "Hostel";
  if (topbarName) topbarName.textContent = user.name || "Student Account";
  if (topbarRoll) topbarRoll.textContent = `Roll No: ${user.rollNo || '--'}`;
  if (topbarInitials) {
    const initials = (user.name || user.rollNo || "ST").slice(0, 2).toUpperCase();
    topbarInitials.textContent = initials;
  }

  // Load detailed profile
  currentStudentProfile = await studentPortalService.getStudentProfile(user.uid);
  if (!currentStudentProfile) {
    currentStudentProfile = {
      uid: user.uid,
      rollNo: user.rollNo || "--",
      name: user.name || "Student",
      email: user.email || "",
      branchName: "General",
      year: "1st Year",
      hostelId: user.hostelId || "hostel_A",
      hostelName: hostel ? hostel.name : "Hostel",
      status: "active",
      roomNo: "Unassigned"
    };
  }

  renderStudentActiveSection();
}

async function renderStudentActiveSection() {
  if (!currentStudentProfile) return;

  const hash = window.location.hash || "#student-profile";
  const activeSectionId = hash.replace("#", "") || "student-profile";

  switch (activeSectionId) {
    case "student-profile":
      await loadStudentProfile();
      break;
    case "student-complaints":
      await loadStudentComplaints();
      break;
    case "student-payments":
      await loadStudentPayments();
      break;
    case "student-mess":
      await loadStudentMess();
      break;
    case "student-announcements":
      await loadStudentAnnouncements();
      break;
    case "student-security":
      break;
    default:
      await loadStudentProfile();
      break;
  }
}

async function loadStudentProfile() {
  if (!currentStudentProfile) return;
  const p = currentStudentProfile;

  const bigAvatar = document.getElementById("profile-big-avatar");
  const dispName = document.getElementById("profile-display-name");
  const dispRoll = document.getElementById("profile-display-roll");

  if (bigAvatar) bigAvatar.textContent = (p.name || p.rollNo || "ST").slice(0, 2).toUpperCase();
  if (dispName) dispName.textContent = p.name || p.rollNo;
  if (dispRoll) dispRoll.textContent = `Roll No: ${p.rollNo || '--'}`;

  const profRoll = document.getElementById("prof-roll");
  const profBranch = document.getElementById("prof-branch");
  const profYear = document.getElementById("prof-year");
  const profJoiningMonth = document.getElementById("prof-joining-month");
  const profHostel = document.getElementById("prof-hostel");
  const profStatus = document.getElementById("prof-status");

  if (profRoll) profRoll.textContent = p.rollNo || "--";
  if (profBranch) profBranch.textContent = p.branchName || "--";
  if (profYear) profYear.textContent = p.year || "--";
  if (profJoiningMonth) profJoiningMonth.textContent = p.joiningMonth || "--";
  if (profHostel) profHostel.textContent = p.hostelName || "--";
  if (profStatus) profStatus.textContent = p.status || "active";

  // Room Allotment & Roommates Details
  const profRoomNo = document.getElementById("prof-room-no");
  const profFloor = document.getElementById("prof-floor");
  const profBed = document.getElementById("prof-bed");
  const profAllotmentStatus = document.getElementById("prof-allotment-status");
  const roommatesContainer = document.getElementById("prof-roommates-container");

  const roomData = await studentPortalService.getStudentRoom(p.uid, p.hostelId);

  if (!roomData) {
    if (profRoomNo) profRoomNo.innerHTML = `<span class="badge badge-warning">Not Allotted Yet</span>`;
    if (profFloor) profFloor.textContent = "—";
    if (profBed) profBed.textContent = "—";
    if (profAllotmentStatus) profAllotmentStatus.innerHTML = `<span class="badge badge-warning">Pending</span>`;

    if (roommatesContainer) {
      roommatesContainer.innerHTML = `
        <div style="padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center; color: #64748b; font-size: 14px;">
          🏠 <strong>Room not allotted yet.</strong> Contact hostel administration for room allocation.
        </div>
      `;
    }
  } else {
    if (profRoomNo) profRoomNo.innerHTML = `<strong style="font-size:16px; color:var(--primary);">Room ${escapeHtml(roomData.roomNo)}</strong>`;
    if (profFloor) profFloor.textContent = `Floor ${escapeHtml(roomData.floor || '1')}`;
    if (profBed) profBed.textContent = `Capacity: ${roomData.capacity || 4} Beds (${roomData.occupied || 1} Occupied)`;
    if (profAllotmentStatus) profAllotmentStatus.innerHTML = `<span class="badge badge-success">Allotted & Active</span>`;

    if (roommatesContainer) {
      if (roomData.roommates && roomData.roommates.length > 0) {
        roommatesContainer.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Roll Number</th>
                <th>Branch</th>
              </tr>
            </thead>
            <tbody>
              ${roomData.roommates.map(rm => `
                <tr>
                  <td><strong>${escapeHtml(rm.name)}</strong></td>
                  <td><code>${escapeHtml(rm.rollNo)}</code></td>
                  <td>${escapeHtml(rm.branch)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      } else {
        roommatesContainer.innerHTML = `
          <div style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center; color: #64748b; font-size: 14px;">
            👥 <strong>No roommates assigned.</strong> You are currently the only resident allotted to this room.
          </div>
        `;
      }
    }
  }
}

async function loadStudentComplaints() {
  if (!currentStudentProfile) return;

  const complaints = await studentPortalService.getStudentComplaints(
    currentStudentProfile.uid, 
    currentStudentProfile.hostelId
  );

  const tbody = document.getElementById("student-complaints-tbody");
  if (!tbody) return;

  if (complaints.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No complaints submitted yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = complaints.map(c => `
    <tr>
      <td>${c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : 'Today'}</td>
      <td><strong>${escapeHtml(c.category)}</strong></td>
      <td>${escapeHtml(c.description)}</td>
      <td>
        <span class="badge ${
          c.status === 'Resolved' ? 'badge-success' :
          c.status === 'In Progress' ? 'badge-info' :
          c.status === 'Rejected' ? 'badge-danger' : 'badge-warning'
        }">${escapeHtml(c.status)}</span>
      </td>
      <td>${c.resolution ? escapeHtml(c.resolution) : '<span style="color:#94a3b8; font-style:italic;">Awaiting response</span>'}</td>
    </tr>
  `).join("");
}

// Month-wise due table (FIFO allocation computed by studentPortalService.getMonthlyFeeDues)
function renderMonthlyDues(monthly) {
  const tbody = document.getElementById("monthly-dues-tbody");
  const totalEl = document.getElementById("monthly-dues-total-outstanding");
  if (!tbody) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const months = monthly.months || [];
  if (months.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:18px;">No published fee statements yet.</td></tr>`;
    if (totalEl) totalEl.textContent = "₹0";
    return;
  }

  tbody.innerHTML = months.map(m => {
    const parts = String(m.monthKey).split("_");
    const label = parts.length === 2 && monthNames[parseInt(parts[1], 10) - 1]
      ? `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`
      : m.monthKey;

    let badgeCls = "badge-danger";
    let badgeTxt = "Due";
    if (m.status === "PAID") { badgeCls = "badge-success"; badgeTxt = "Paid"; }
    else if (m.status === "PARTIALLY PAID") { badgeCls = "badge-warning"; badgeTxt = "Partially Paid"; }

    return `
      <tr>
        <td style="font-weight:600;">${escapeHtml(label)}</td>
        <td>₹${(m.finalAmount || 0).toLocaleString()}</td>
        <td style="color:#15803d;">₹${(m.paid || 0).toLocaleString()}</td>
        <td style="color:#b91c1c; font-weight:700;">₹${(m.due || 0).toLocaleString()}</td>
        <td><span class="badge ${badgeCls}">${badgeTxt}</span></td>
      </tr>`;
  }).join("");

  if (totalEl) totalEl.textContent = `₹${(monthly.totalOutstanding || 0).toLocaleString()}`;
}

async function loadStudentPayments() {
  if (!currentStudentProfile) return;

  const monthPicker = document.getElementById("student-fee-month-picker");
  if (monthPicker && !monthPicker.value) {
    monthPicker.value = new Date().toISOString().slice(0, 7);
  }

  const selectedMonth = monthPicker ? monthPicker.value : new Date().toISOString().slice(0, 7);

  // Month-wise FIFO fee dues across all published/finalized months (oldest outstanding first)
  const monthly = await studentPortalService.getMonthlyFeeDues(
    currentStudentProfile.uid,
    currentStudentProfile.hostelId
  );
  renderMonthlyDues(monthly);

  // Fee calculation & breakdown
  const dues = await studentPortalService.calculateStudentFeeDues(
    currentStudentProfile.uid, 
    currentStudentProfile.hostelId, 
    selectedMonth
  );

  // Override paid/net with the FIFO-consistent values so the summary card always
  // matches the month-wise table exactly (oldest outstanding month gets paid first).
  const monthKey = selectedMonth.replace(/-/g, "_");
  const monthFifo = (monthly.months || []).find(m => String(m.monthKey) === monthKey);
  if (monthFifo) {
    dues.paid = monthFifo.paid;
    dues.net = monthFifo.due;
  }

  const feeTotalEl = document.getElementById("student-fee-total");
  const feePaidEl = document.getElementById("student-fee-paid");
  const feePendingEl = document.getElementById("student-fee-pending");
  const feeStatusBadge = document.getElementById("student-fee-status-badge");
  const finalizedNotice = document.getElementById("student-fee-finalized-notice");

  if (feeTotalEl) feeTotalEl.textContent = `₹${dues.total}`;
  if (feePaidEl) feePaidEl.textContent = `₹${dues.paid}`;
  if (feePendingEl) feePendingEl.textContent = `₹${dues.net}`;

  if (feeStatusBadge) {
    if (dues.notJoinedYet) {
      feeStatusBadge.innerHTML = `<span class="badge badge-info">Not Applicable (Joined ${dues.joiningMonth || 'Later'})</span>`;
    } else if (dues.isPublished || dues.isFinalized) {
      feeStatusBadge.innerHTML = dues.net <= 0 
        ? `<span class="badge badge-success">Published & Fully Paid</span>` 
        : `<span class="badge badge-danger">Published (Due: ₹${dues.net.toLocaleString()})</span>`;
    } else {
      feeStatusBadge.innerHTML = `<span class="badge badge-warning">Pending Publication</span>`;
    }
  }

  if (finalizedNotice) {
    if (dues.notJoinedYet) {
      finalizedNotice.style.display = "block";
      finalizedNotice.innerHTML = `ℹ️ <strong>Account Status:</strong> You joined the hostel in <strong>${dues.joiningMonth || 'a later month'}</strong>. Fees and attendance for prior months (such as <strong>${selectedMonth}</strong>) do not apply to your account.`;
      finalizedNotice.style.background = "#eff6ff";
      finalizedNotice.style.borderColor = "#bfdbfe";
      finalizedNotice.style.color = "#1e40af";
    } else if (dues.isPublished || dues.isFinalized) {
      finalizedNotice.style.display = "block";
      finalizedNotice.innerHTML = `✅ <strong>${selectedMonth} Statement Published:</strong> Official fee statement for this month has been finalized and published by hostel administration.`;
      finalizedNotice.style.background = "#f0fdf4";
      finalizedNotice.style.borderColor = "#bbf7d0";
      finalizedNotice.style.color = "#166534";
    } else {
      finalizedNotice.style.display = "block";
      finalizedNotice.innerHTML = `⏳ <strong>${selectedMonth} Fee Statement Not Published Yet:</strong> Hostel administration has not published the official fee statement for this month yet. Recorded attendance will not update your fee balance until published.`;
      finalizedNotice.style.background = "#fffbeb";
      finalizedNotice.style.borderColor = "#fef3c7";
      finalizedNotice.style.color = "#92400e";
    }
  }

  const periodEl = document.getElementById("fee-statement-period");
  const rentEl = document.getElementById("fee-breakup-rent");
  const cntBf = document.getElementById("fee-cnt-bf");
  const bfEl = document.getElementById("fee-breakup-bf");
  const cntLunch = document.getElementById("fee-cnt-lunch");
  const lunchEl = document.getElementById("fee-breakup-lunch");
  const cntDinner = document.getElementById("fee-cnt-dinner");
  const dinnerEl = document.getElementById("fee-breakup-dinner");
  const cntCustom = document.getElementById("fee-cnt-custom");
  const customEl = document.getElementById("fee-breakup-custom");
  const breakupTotal = document.getElementById("fee-breakup-total");
  const breakupPaid = document.getElementById("fee-breakup-paid");
  const breakupNet = document.getElementById("fee-breakup-net");

  if (periodEl) periodEl.textContent = selectedMonth;
  if (rentEl) rentEl.textContent = `₹${dues.monthlyRent}`;
  if (cntBf) cntBf.textContent = dues.bfCount;
  if (bfEl) bfEl.textContent = `₹${dues.breakfastCost}`;
  if (cntLunch) cntLunch.textContent = dues.lunchCount;
  if (lunchEl) lunchEl.textContent = `₹${dues.lunchCost}`;
  if (cntDinner) cntDinner.textContent = dues.dinnerCount;
  if (dinnerEl) dinnerEl.textContent = `₹${dues.dinnerCost}`;
  if (cntCustom) cntCustom.textContent = dues.customMealsCount || 0;
  if (customEl) customEl.textContent = `₹${dues.customMealsCost || 0}`;
  if (breakupTotal) breakupTotal.textContent = `₹${dues.total}`;
  if (breakupPaid) breakupPaid.textContent = `₹${dues.paid}`;
  if (breakupNet) breakupNet.textContent = `₹${dues.net}`;

  // QR Code & UPI ID — Fetch fresh hostel details directly from Firestore
  let hostelData = adminAuthContext.currentHostel || {};
  try {
    const targetHostelId = currentStudentProfile?.hostelId || adminAuthContext.currentHostel?.id;
    if (targetHostelId) {
      const hSnap = await getDoc(doc(db, "hostels", targetHostelId));
      if (hSnap && hSnap.exists()) {
        hostelData = { ...hostelData, ...hSnap.data() };
      }
    }
  } catch (err) {
    console.warn("Could not fetch fresh hostel data for student payment QR view:", err);
  }

  const qrImg = document.getElementById("student-payment-qr-img");
  const qrPlace = document.getElementById("student-payment-qr-placeholder");
  const upiIdEl = document.getElementById("student-payment-upi-id");

  if (hostelData) {
    if (hostelData.qrUrl && qrImg && qrPlace) {
      qrImg.src = hostelData.qrUrl;
      qrImg.style.display = "block";
      qrPlace.style.display = "none";
    } else if (qrImg && qrPlace) {
      qrImg.style.display = "none";
      qrPlace.style.display = "block";
    }
    if (upiIdEl) upiIdEl.textContent = hostelData.upiId || "Not Configured";
  }

  // Payment Transaction History
  const payments = await studentPortalService.getStudentPayments(
    currentStudentProfile.uid, 
    currentStudentProfile.hostelId
  );
  const tbody = document.getElementById("student-payment-history-tbody");
  if (!tbody) return;

  // Pre-fill billing month picker on first load
  const billingMonthInput = document.getElementById("student-utr-billing-month");
  if (billingMonthInput && !billingMonthInput.value) {
    billingMonthInput.value = new Date().toISOString().slice(0, 7);
  }

  if (payments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">No payment transactions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(p => {
    const utr = escapeHtml(p.utrNumber || p.transactionId || "—");
    const status = p.status || "Pending";
    const billingMonth = escapeHtml(p.billingMonth || "—");
    const remarks = escapeHtml(p.remarks || "—");
    const dateStr = p.date || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString("en-IN") : "—");

    let statusBadge = "";
    if (status === "Verified" || status === "Approved") {
      statusBadge = `<span class="badge badge-success">✅ Verified</span>`;
    } else if (status === "Rejected") {
      statusBadge = `<span class="badge badge-danger">❌ Rejected</span>`;
    } else {
      statusBadge = `<span class="badge badge-warning">⏳ ${escapeHtml(status)}</span>`;
    }

    // Admin notes: show rejection reason for rejected payments; show verifier for verified
    let adminNotes = `<span style="color:#94a3b8; font-style:italic; font-size:12px;">—</span>`;
    if (status === "Rejected" && p.rejectionReason) {
      adminNotes = `<span style="color:#b91c1c; font-size:12px; font-weight:600;">❌ ${escapeHtml(p.rejectionReason)}</span>`;
    } else if (status === "Verified" || status === "Approved") {
      adminNotes = `<span style="color:#15803d; font-size:12px;">✓ Verified by warden</span>`;
    }

    // Row left-border color by status
    const rowStyle = (status === "Verified" || status === "Approved") ? "border-left:3px solid #22c55e;" :
                     status === "Rejected" ? "border-left:3px solid #ef4444;" :
                     "border-left:3px solid #f59e0b;";

    return `
      <tr style="${rowStyle}">
        <td>${dateStr}</td>
        <td><strong>₹${(Number(p.amount) || 0).toLocaleString()}</strong></td>
        <td><code style="font-size:12px;">${utr}</code></td>
        <td>${billingMonth}</td>
        <td>${remarks}</td>
        <td>${statusBadge}</td>
        <td>${adminNotes}</td>
      </tr>
    `;
  }).join("");
}


async function loadStudentMess() {
  if (!currentStudentProfile) return;

  const mess = await studentPortalService.getStudentMess(currentStudentProfile.hostelId);

  const bfTiming = document.getElementById("student-timing-bf");
  const lunchTiming = document.getElementById("student-timing-lunch");
  const dinnerTiming = document.getElementById("student-timing-dinner");

  if (mess) {
    if (bfTiming) bfTiming.textContent = mess.breakfast || mess.timings?.bf || "7:30 AM - 9:00 AM";
    if (lunchTiming) lunchTiming.textContent = mess.lunch || mess.timings?.lunch || "12:30 PM - 2:00 PM";
    if (dinnerTiming) dinnerTiming.textContent = mess.dinner || mess.timings?.dinner || "7:30 PM - 9:00 PM";
  } else {
    if (bfTiming) bfTiming.textContent = "7:30 AM - 9:00 AM";
    if (lunchTiming) lunchTiming.textContent = "12:30 PM - 2:00 PM";
    if (dinnerTiming) dinnerTiming.textContent = "7:30 PM - 9:00 PM";
  }

  const grid = document.getElementById("student-weekly-menu-grid");
  if (!grid) return;

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const dayLabels = {
    monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
    thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday"
  };

  const todayStr = days[(new Date().getDay() + 6) % 7];

  // Support both admin-saved weeklyMenu (capitalized day keys) and lowercase keys
  const weeklyData = mess?.weeklyMenu || mess?.menu || {};

  grid.innerHTML = days.map(d => {
    const isToday = d === todayStr;
    const dayKey = dayLabels[d];
    const dayMenu = weeklyData[dayKey] || weeklyData[d] || { breakfast: "--", lunch: "--", dinner: "--" };
    return `
      <div class="card" style="background:${isToday ? '#f0f9ff' : '#ffffff'}; border:${isToday ? '2px solid var(--primary)' : '1px solid #e2e8f0'}; padding: 14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <h4 style="margin:0; color:var(--primary);">${dayLabels[d]}</h4>
          ${isToday ? `<span class="badge badge-success" style="font-size:10px;">TODAY</span>` : ''}
        </div>
        <div style="font-size:13px;">
          <p style="margin: 4px 0;"><strong>🌅 BF:</strong> ${escapeHtml(dayMenu.breakfast || '--')}</p>
          <p style="margin: 4px 0;"><strong>☀️ Lunch:</strong> ${escapeHtml(dayMenu.lunch || '--')}</p>
          <p style="margin: 4px 0;"><strong>🌙 Dinner:</strong> ${escapeHtml(dayMenu.dinner || '--')}</p>
        </div>
      </div>
    `;
  }).join("");
}

async function loadStudentAnnouncements() {
  if (!currentStudentProfile) return;

  const announcements = await studentPortalService.getStudentAnnouncements(currentStudentProfile.hostelId);
  const container = document.getElementById("student-full-announcements-list");
  if (!container) return;

  if (announcements.length === 0) {
    container.innerHTML = `<p style="color:#94a3b8; padding:20px; text-align:center;">No announcements published for your hostel yet.</p>`;
    return;
  }

  container.innerHTML = announcements.map(a => `
    <div class="card" style="margin-bottom:12px; border-left: 4px solid var(--primary);">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h4 style="margin:0; color:var(--primary);">${escapeHtml(a.title)}</h4>
        <small style="color:#94a3b8;">${a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toLocaleDateString() : ''}</small>
      </div>
      <p style="margin:8px 0 0 0; color:#334155; font-size:14px;">${escapeHtml(a.content || a.message || a.desc || "")}</p>
    </div>
  `).join("");
}

// Interactive 3D Cursor Tilt Effect
function init3DTiltEffects() {
  document.addEventListener("mousemove", (e) => {
    const tiltTarget = e.target.closest(".stats > div, .pay-stat-card, .metric");
    if (!tiltTarget) return;

    const rect = tiltTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    tiltTarget.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(10px) translateY(-4px)`;
  });

  document.addEventListener("mouseout", (e) => {
    const tiltTarget = e.target.closest(".stats > div, .pay-stat-card, .metric");
    if (tiltTarget) {
      tiltTarget.style.transform = "";
    }
  });
}

// Application Initialization
window.addEventListener("DOMContentLoaded", async () => {
  cacheDOM();
  setupEvents();
  init3DTiltEffects();

  adminAuthContext.subscribe((state) => {
    renderState(state);
    handleNavigation();
  });

  await adminAuthContext.init();
  handleNavigation();
});
