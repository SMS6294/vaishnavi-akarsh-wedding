"use strict";

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  getFirestore,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("REPLACE_WITH_")
);
let auth = null;
let db = null;
let firebaseInitError = "";

if (firebaseConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    firebaseInitError = error.message || "Firebase could not be initialized.";
  }
}

function firebaseUnavailableMessage() {
  if (!firebaseConfigured) return "Firebase is not configured yet. Add the web app values in public/firebase-config.js.";
  return firebaseInitError || "Firebase is unavailable. Check the configuration and try again.";
}

/* ========================================
   WEDDING COUNTDOWN
======================================== */
(() => {
  const weddingDate = new Date("2026-12-20T11:15:00+05:30");
  const daysEl = document.getElementById("countdownDays");
  const hoursEl = document.getElementById("countdownHours");
  const minutesEl = document.getElementById("countdownMinutes");
  const secondsEl = document.getElementById("countdownSeconds");
  const messageEl = document.getElementById("countdownMessage");
  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

  function updateCountdown() {
    const remaining = weddingDate.getTime() - Date.now();
    if (remaining <= 0) {
      daysEl.textContent = "0";
      hoursEl.textContent = "00";
      minutesEl.textContent = "00";
      secondsEl.textContent = "00";
      if (messageEl) messageEl.textContent = "Today is Adv. Vaishnavi A U and Akarsh's special day!";
      return;
    }
    const totalSeconds = Math.floor(remaining / 1000);
    daysEl.textContent = String(Math.floor(totalSeconds / 86400));
    hoursEl.textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
    minutesEl.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    secondsEl.textContent = String(totalSeconds % 60).padStart(2, "0");
  }
  updateCountdown();
  window.setInterval(updateCountdown, 1000);
})();

/* ========================================
   PUBLIC RSVP FORM → FIRESTORE
======================================== */
(() => {
  const form = document.getElementById("rsvpForm");
  if (!form) return;

  const attending = document.getElementById("attending");
  const guestCountField = document.getElementById("guestCountField");
  const count = document.getElementById("count");
  const companions = document.getElementById("companions");
  const message = document.getElementById("rsvpMessage");
  const submitButton = document.getElementById("submitRsvp");

  function updateAttendanceFields() {
    const isAttending = attending.value === "yes";
    guestCountField.hidden = !isAttending;
    count.required = isAttending;
    count.disabled = !isAttending;
    companions.disabled = !isAttending;
  }
  attending.addEventListener("change", updateAttendanceFields);
  updateAttendanceFields();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "Sending your response…";
    message.classList.remove("message-error", "message-success");
    submitButton.disabled = true;

    const payload = {
      name: document.getElementById("guestName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      attending: attending.value,
      count: attending.value === "yes" ? Number(count.value) : 0,
      companions: attending.value === "yes" ? companions.value.trim() : ""
    };

    const validationError = validateRsvp(payload);
    if (validationError) {
      message.textContent = validationError;
      message.classList.add("message-error");
      submitButton.disabled = false;
      return;
    }
    if (!db) {
      message.textContent = firebaseUnavailableMessage();
      message.classList.add("message-error");
      submitButton.disabled = false;
      return;
    }

    try {
      await addDoc(collection(db, "rsvps"), {
        ...payload,
        submittedAt: serverTimestamp()
      });
      message.textContent = "Thank you! Your RSVP has been received.";
      message.classList.add("message-success");
      form.reset();
      updateAttendanceFields();
    } catch (error) {
      message.textContent = firestoreErrorMessage(error, "Could not submit your RSVP. Please try again.");
      message.classList.add("message-error");
    } finally {
      submitButton.disabled = false;
    }
  });
})();

function validateRsvp(data) {
  if (typeof data.name !== "string" || !data.name.trim() || data.name.length > 100) {
    return "Please enter your name (up to 100 characters).";
  }
  if (typeof data.phone !== "string" || data.phone.length > 30) {
    return "Please enter a phone number up to 30 characters.";
  }
  if (!["yes", "no"].includes(data.attending)) {
    return "Please select your attendance.";
  }
  if (data.attending === "yes" && (!Number.isInteger(data.count) || data.count < 1 || data.count > 10)) {
    return "Choose between 1 and 10 guests.";
  }
  if (typeof data.companions !== "string" || data.companions.length > 500) {
    return "Additional guest names must be 500 characters or fewer.";
  }
  return "";
}

/* ========================================
   PRIVATE FAMILY DASHBOARD → FIREBASE AUTH
======================================== */
(() => {
  const loginForm = document.getElementById("adminLoginForm");
  const panel = document.getElementById("adminDashboard");
  if (!loginForm || !panel) return;

  const loginSection = document.getElementById("adminLoginSection");
  const loginMessage = document.getElementById("adminLoginMessage");
  const loginButton = document.getElementById("adminLoginButton");

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }

  function setMessage(text, type) {
    loginMessage.textContent = text;
    loginMessage.classList.remove("message-error", "message-success");
    if (type) loginMessage.classList.add(type);
  }

  function showDashboard(data) {
    loginSection.hidden = true;
    panel.hidden = false;
    panel.replaceChildren();
    panel.appendChild(el("p", "eyebrow dark-eyebrow", "PRIVATE FAMILY ACCESS"));
    panel.appendChild(el("h2", "admin-page-title", "Wedding RSVP Dashboard"));
    panel.appendChild(el("p", "admin-intro", "Guest responses are visible only to authenticated family admins."));

    const stats = el("div", "admin-stats");
    [
      ["Confirmed attendees", data.confirmedPeople],
      ["Attending responses", data.attendingResponses],
      ["Declined responses", data.declinedResponses],
      ["Total RSVP responses", data.totalResponses]
    ].forEach(([label, value]) => {
      const card = el("div", "admin-stat");
      card.append(el("span", "", label), el("strong", "", value));
      stats.appendChild(card);
    });
    panel.appendChild(stats);

    const actions = el("div", "admin-dashboard-actions");
    const refreshButton = el("button", "admin-secondary-button", "Refresh responses");
    refreshButton.type = "button";
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      refreshButton.textContent = "Refreshing…";
      try { await loadDashboard(); }
      catch (error) {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh responses";
        dashboardError(firestoreErrorMessage(error, "Could not load the private dashboard."));
      }
    });
    const logoutButton = el("button", "button button-dark", "Log out");
    logoutButton.type = "button";
    logoutButton.addEventListener("click", logout);
    const backLink = el("a", "admin-back-link", "Return to invitation");
    backLink.href = "./";
    actions.append(refreshButton, logoutButton, backLink);
    panel.appendChild(actions);

    const guests = data.guests;
    if (!guests.length) {
      panel.appendChild(el("div", "admin-empty", "No RSVP responses have been received yet."));
      return;
    }

    const tableWrap = el("div", "admin-table-wrap");
    const table = el("table", "admin-table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Guest name", "Phone", "Attendance", "Party size", "Additional guests", "Submitted"].forEach((label) => headRow.appendChild(el("th", "", label)));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    guests.sort((a, b) => (b.submittedAt?.getTime() || 0) - (a.submittedAt?.getTime() || 0)).forEach((guest) => {
      const row = document.createElement("tr");
      const submitted = guest.submittedAt ? guest.submittedAt.toLocaleString() : "—";
      [guest.name, guest.phone || "—", guest.attending === "yes" ? "Attending" : "Declined", guest.count, guest.companions || "—", submitted]
        .forEach((value) => row.appendChild(el("td", "", value)));
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);
  }

  function dashboardError(text) {
    const old = panel.querySelector(".admin-error");
    if (old) old.remove();
    panel.prepend(el("p", "form-message message-error admin-error", text));
  }

  async function loadDashboard() {
    if (!db || !auth?.currentUser) throw new Error(firebaseUnavailableMessage());
    const snapshot = await getDocs(collection(db, "rsvps"));
    const guests = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        name: data.name || "—",
        phone: data.phone || "",
        attending: data.attending,
        count: data.count ?? 0,
        companions: data.companions || "",
        submittedAt: data.submittedAt?.toDate?.() || null
      };
    });
    showDashboard({
      guests,
      totalResponses: guests.length,
      attendingResponses: guests.filter((guest) => guest.attending === "yes").length,
      declinedResponses: guests.filter((guest) => guest.attending === "no").length,
      confirmedPeople: guests.reduce((sum, guest) => sum + (guest.attending === "yes" ? guest.count : 0), 0)
    });
  }

  async function logout() {
    try {
      if (!auth) throw new Error(firebaseUnavailableMessage());
      await signOut(auth);
      panel.hidden = true;
      panel.replaceChildren();
      loginSection.hidden = false;
      loginForm.reset();
      setMessage("You have logged out successfully.", "message-success");
      document.getElementById("adminEmail").focus();
    } catch (error) {
      dashboardError(firestoreErrorMessage(error, "Could not log out. Please try again."));
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("Signing in…");
    loginButton.disabled = true;
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    try {
      if (!auth) throw new Error(firebaseUnavailableMessage());
      await signInWithEmailAndPassword(auth, email, password);
      setMessage("Signed in. Checking family access…");
    } catch (error) {
      if (auth?.currentUser) await signOut(auth).catch(() => {});
      setMessage(firestoreErrorMessage(error, "Sign-in failed. Please try again."), "message-error");
    } finally {
      loginButton.disabled = false;
    }
  });

  if (auth) {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try { await loadDashboard(); }
      catch (error) {
        panel.hidden = false;
        panel.replaceChildren();
        dashboardError(firestoreErrorMessage(error, "Could not load the private dashboard."));
        const logoutButton = el("button", "button button-dark", "Log out");
        logoutButton.type = "button";
        logoutButton.addEventListener("click", logout);
        panel.appendChild(logoutButton);
      }
    });
  } else {
    setMessage(firebaseUnavailableMessage(), "message-error");
  }
})();

function firestoreErrorMessage(error, fallback) {
  const code = error?.code || "";
  if (code.includes("permission-denied")) {
    return "Access denied. Confirm the Firestore rules and that this family account is authorised.";
  }
  if (code.includes("unauthenticated")) return "Please sign in with an authorised family account.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Incorrect email or password.";
  }
  return error?.message || fallback;
}
