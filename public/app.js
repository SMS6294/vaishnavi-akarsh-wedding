"use strict";

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
      if (messageEl) messageEl.textContent = "Today is Vaishnavi & Akarsh's special day!";
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
   PUBLIC RSVP FORM
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
      count: Number(count.value),
      companions: companions.value.trim()
    };

    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not submit your RSVP. Please try again.");
      message.textContent = result.message || "Thank you! Your RSVP has been received.";
      message.classList.add("message-success");
      form.reset();
      updateAttendanceFields();
    } catch (error) {
      message.textContent = error.message || "A connection error occurred. Please try again.";
      message.classList.add("message-error");
    } finally {
      submitButton.disabled = false;
    }
  });
})();

/* ========================================
   SEPARATE PRIVATE FAMILY LOGIN PAGE
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
      ["Confirmed attendees", data.confirmedPeople ?? 0],
      ["Attending responses", data.attendingResponses ?? 0],
      ["Declined responses", data.declinedResponses ?? 0],
      ["Total RSVP responses", data.totalResponses ?? 0]
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
      catch (error) { dashboardError(error.message); }
    });
    const logoutButton = el("button", "button button-dark", "Log out");
    logoutButton.type = "button";
    logoutButton.addEventListener("click", logout);
    const backLink = el("a", "admin-back-link", "Return to invitation");
    backLink.href = "/";
    actions.append(refreshButton, logoutButton, backLink);
    panel.appendChild(actions);

    const guests = Array.isArray(data.guests) ? data.guests : [];
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
    guests.slice().sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""))).forEach((guest) => {
      const row = document.createElement("tr");
      const submitted = guest.submittedAt ? new Date(guest.submittedAt).toLocaleString() : "—";
      [guest.name || "—", guest.phone || "—", guest.attending === "yes" ? "Attending" : "Declined", guest.count ?? 0, guest.companions || "—", submitted].forEach((value) => row.appendChild(el("td", "", value)));
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
    const response = await fetch("/api/admin/data", { credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not load the private dashboard.");
    showDashboard(data);
  }

  async function logout() {
    try {
      const response = await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not log out. Please try again.");
      panel.hidden = true;
      panel.replaceChildren();
      loginSection.hidden = false;
      loginForm.reset();
      setMessage("You have logged out successfully.", "message-success");
      document.getElementById("adminUsername").focus();
    } catch (error) {
      dashboardError(error.message);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage("Checking credentials…");
    loginButton.disabled = true;
    const username = document.getElementById("adminUsername").value.trim();
    const password = document.getElementById("adminPassword").value;

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Incorrect username or password.");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message || "Login failed. Please try again.", "message-error");
    } finally {
      loginButton.disabled = false;
    }
  });

  // If the family is already signed in, show the private dashboard immediately.
  loadDashboard().catch(() => {
    document.getElementById("adminUsername").focus();
  });
})();
