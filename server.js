
const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "rsvps.json");

if (!process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD ||
    !process.env.SESSION_SECRET) {
  throw new Error("Missing admin credentials in .env");
}

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false }));

app.use(session({
  name: "wedding.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    maxAge: 2 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

function readGuests() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function adminOnly(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(401).json({ error: "Admin login required." });
  }
  next();
}

// Public RSVP: guests do not need an account or login.
app.post("/api/rsvp", (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const attending = req.body.attending;
  const count = Number(req.body.count);
  const companions = String(req.body.companions || "").trim();

  if (!name || name.length > 100) {
    return res.status(400).json({ error: "Please enter your name." });
  }

  if (!["yes", "no"].includes(attending)) {
    return res.status(400).json({ error: "Please select your attendance." });
  }

  if (phone.length > 30 || companions.length > 500) {
    return res.status(400).json({ error: "One of the fields is too long." });
  }

  if (attending === "yes" &&
      (!Number.isInteger(count) || count < 1 || count > 10)) {
    return res.status(400).json({ error: "Choose between 1 and 10 guests." });
  }

  const guests = readGuests();

  guests.push({
    id: crypto.randomUUID(),
    name,
    phone,
    attending,
    count: attending === "yes" ? count : 0,
    companions: attending === "yes" ? companions : "",
    submittedAt: new Date().toISOString()
  });

  const tempFile = DATA_FILE + ".tmp";
  fs.writeFileSync(tempFile, JSON.stringify(guests, null, 2), "utf8");
  fs.renameSync(tempFile, DATA_FILE);

  res.json({ message: "Thank you! Your RSVP has been received." });
});

// Private admin login.
app.post("/api/admin/login", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  if (username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  req.session.regenerate(err => {
    if (err) {
      return res.status(500).json({ error: "Could not start your session." });
    }

    req.session.isAdmin = true;
    res.json({ message: "Login successful." });
  });
});

// Only logged-in admins can see the guest list and totals.
app.get("/api/admin/data", adminOnly, (req, res) => {
  const guests = readGuests();

  res.json({
    guests,
    totalResponses: guests.length,
    attendingResponses: guests.filter(g => g.attending === "yes").length,
    declinedResponses: guests.filter(g => g.attending === "no").length,
    confirmedPeople: guests.reduce(
      (sum, g) => sum + (g.attending === "yes" ? g.count : 0), 0
    )
  });
});

app.post("/api/admin/logout", adminOnly, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: "Could not log out." });
    }

    res.clearCookie("wedding.sid");
    res.json({ message: "Logged out." });
  });
});

// Express 5-compatible fallback for the invitation page.
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found." });
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Wedding website running at http://localhost:${PORT}`);
});
