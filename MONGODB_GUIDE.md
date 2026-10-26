# 🍃 MongoDB User Database Guide — SHRISTI 2026 Hackathon

This document provides complete instructions for running and managing the **MongoDB Database** powering user accounts, team registrations, problem selections, project submissions, and attendance for the SHRISTI 2026 Hackathon Portal.

---

## 🏗️ Architecture & Database Schemas

The database is built on **Node.js, Express, and Mongoose (MongoDB ODM)**. It provides structured collections:

### 1. `users` Collection (`models/User.js`)
Stores all platform users with credentials and roles:
- `username`: Unique username (lowercase, trimmed, indexed)
- `password`: Assigned authentication password
- `fullName`: Display name
- `role`: `'SuperAdmin'` | `'Coordinator'` | `'Team Lead'` | `'Team Member'` | `'Participant'`
- `teamName`: Assigned hackathon team
- `track`: Domain track (e.g., `'AI & Multimedia'`, `'Cybersecurity'`)
- `status`: `'active'` | `'inactive'`
- `lastLogin`: Timestamp of most recent session
- `createdAt` / `updatedAt`: Auto-managed timestamps

### 2. `teams` Collection (`models/Team.js`)
Stores registered teams and live hackathon state:
- `teamName`: Unique team identifier
- `leadFullName` & `leadUsername`: Team leader profile
- `password`: Team login password
- `members`: Array of teammates `[{ fullName, username, role }]`
- `selectedProblemId` & `selectedProblemTitle`: Team locked problem statement
- `selectedBy` & `selectionTime`: Teammate who locked the card
- `submission`: `{ githubLink, explanationLink, videoLink, submittedBy, submittedAt, notes, simulatedNotes }`

### 3. `attendances` Collection (`models/Attendance.js`)
Stores real-time login audit trails:
- `username`, `fullName`, `teamName`, `timestamp`, `deviceInfo`

---

## 🚀 How to Run the Platform with MongoDB

### Step 1: Start the Server

In the project folder, open PowerShell or Terminal and run:

```powershell
npm start
```
*(or for auto-reloading during development: `npm run dev`)*

The server will launch at:
👉 **`http://localhost:5000`**

---

## 🌐 Connecting to MongoDB

You can connect to either a **Free MongoDB Atlas Cloud Cluster** (recommended) or a **Local MongoDB Service**.

### Option A: MongoDB Atlas (Free Cloud Database — Recommended)

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) and create a free account.
2. Create a free **M0 Sandbox Cluster**.
3. Under **Database Access**, create a database user (e.g., `hackathon_admin` with a password).
4. Under **Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere (`0.0.0.0/0`)**.
5. Click **Connect** → **Drivers** (Node.js) and copy your connection string:
   ```env
   mongodb+srv://hackathon_admin:<password>@cluster0.mongodb.net/shristi_hackathon?retryWrites=true&w=majority
   ```
6. Paste the string into your `.env` file:
   ```env
   MONGODB_URI=mongodb+srv://hackathon_admin:YourPassword@cluster0.mongodb.net/shristi_hackathon?retryWrites=true&w=majority
   ```
   *OR* connect dynamically in the live UI:
   - Click **"📊 Admin & Sheets"** in the top navbar.
   - Switch to the **"🍃 MongoDB Users"** tab.
   - Paste the connection string into the input box and click **"Connect DB"**.

---

### Option B: Local MongoDB Service

If you have MongoDB Community Server installed on your machine:

1. Start MongoDB:
   ```powershell
   net start MongoDB
   # or run:
   mongod --dbpath "C:\data\db"
   ```
2. The server will connect automatically to `mongodb://127.0.0.1:27017/shristi_hackathon`.

---

## ⚡ Seeding Initial Users

To populate the database with default SuperAdmins, Coordinators, and Sample Teams:

### Option 1: Via Terminal Script
```powershell
npm run seed
```

### Option 2: Via Browser UI (1-Click)
1. Open `http://localhost:5000` in your browser.
2. Click **"📊 Admin & Sheets"** in the top navigation.
3. Switch to the **"🍃 MongoDB Users"** tab.
4. Click the **"⚡ Seed Users"** button.

### Preloaded Credentials Created in MongoDB:
| Role | User ID / Username | Password | Full Name |
|---|---|---|---|
| **SuperAdmin** | `Nareen Karthik` / `nareen` | `Nareen@06` | Nareen Karthik |
| **SuperAdmin** | `admin` | `admin@shristi2026` | Hackathon Administrator |
| **Coordinator** | `coordinator.ai` | `Coord@2026` | Dr. Vikram Raman |
| **Coordinator** | `coordinator.cyber` | `Coord@2026` | Priya Sharma |
| **Team Lead** | `alex.cyber` | `Cyber@2026` | Alex Rivera (Team CyberPulse) |
| **Team Member** | `sarah.cyber` | `Cyber@2026` | Sarah Chen |
| **Team Member** | `marcus.cyber` | `Cyber@2026` | Marcus Vance |

---

## 🔌 REST API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | Database connection state, active collections count & system stats |
| `POST` | `/api/connect` | Dynamically update MongoDB connection URI |
| `POST` | `/api/auth/login` | Authenticate user credentials against MongoDB |
| `GET` | `/api/users` | List all users stored in the MongoDB `users` collection |
| `POST` | `/api/users` | Create a new SuperAdmin or Event Coordinator |
| `DELETE` | `/api/users/:id` | Delete a user document from MongoDB |
| `GET` | `/api/teams` | List all registered teams and teammate rosters |
| `POST` | `/api/teams/register` | Register new team and automatically create user records |
| `POST` | `/api/teams/select-problem` | Save team problem selection lock in MongoDB |
| `POST` | `/api/teams/reset-problem` | Reset locked selection for a team (admin feature) |
| `POST` | `/api/teams/submission` | Save deliverables (GitHub, Drive, Video demo) in MongoDB |
| `GET` | `/api/attendance` | Fetch attendance history from MongoDB |
| `POST` | `/api/attendance` | Record a user login attendance event |
| `POST` | `/api/seed` | Seed initial database records |

---

## 🛡️ Resilient Standby & Fallback Feature

- If MongoDB is temporarily offline or disconnected, the portal **automatically falls back to local storage and memory mode**.
- The top navbar displays **"🍃 MongoDB: Standby / Local"** with a red pulse indicator.
- Once MongoDB is connected, the badge turns green (**"🍃 MongoDB: Connected (X users)"**), and all authentication, registration, and attendance seamlessly route directly to MongoDB!
