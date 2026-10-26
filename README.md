# SHRISTI 2026 — Hackathon Management Platform

A modern, high-octane dark-mode Hackathon Management Website with real-time team locking, closed authentication, 13 pre-populated problem statements, official general rules, submission portal, and direct Google Sheets database integration.

---

## ⚡ Core Features & Implementation Highlights

### 1. Closed Authentication & User Management
- **No "Sign Up" Button**: Purely closed access model. Participants log in using pre-assigned usernames and passwords provided by the organizer.
- **Team Mapping**: Each user is automatically mapped to their respective team upon login (e.g. `alex.cyber` & `sarah.cyber` -> `Team CyberPulse`).
- **Attendance Logging**: Every login records the user's name, team name, and timestamp, pushing it directly to **Sheet 1 (Attendance)** via the Google Apps Script webhook.

### 2. Problem Statement Cards & Team-Locking Mechanism
- **13 Problem Statements**: Fully populated with Domain, Description, 6 Required Features, and Suggested Tech Stack.
- **Team Selection Logic**: When any team member clicks "Select Problem", that problem is immediately assigned to their entire team.
- **Real-Time Locking**: Once a problem is selected by one teammate, card selection is locked for all members of that team across browser tabs. Other members see:
  > *"Your team has already selected Problem Statement: [Title]"*
- **Cross-Tab & Multi-User Sync**: Uses `BroadcastChannel` and `localStorage` synchronization for instantaneous real-time lock updates without requiring an external WebSocket server.

### 3. Submission Portal (3 Distinct Required Links)
- **Conditional Unlock**: The submission form is locked until the team has an active problem statement.
- **Three Required Deliverable Links**:
  1. **Public GitHub Repository Link**: (Type: URL) with public visibility verification helper.
  2. **Project Explanation Link (Google Drive)**: (Type: URL) with "Anyone with the link can view" helper for documentation/presentation.
  3. **Working Model Video Link**: (Type: URL) video link demonstrating the working prototype.
- **Transmission Confirmation Screen**: Displays "Output transmitted successfully" with all 3 links rendered as clickable anchor tags for immediate verification.
- **React Component**: Standalone, fully modular `HackathonApp.jsx` React component included with `outputLink` state object (`githubLink`, `explanationLink`, `videoLink`), `handleSubmitOutput`, and dark neon UI.
- **Team-wide Visibility**: Any team member can submit or update the submission on behalf of the team.
- Pushes directly to **Sheet 3 (Submissions)** with separate columns for all three links.

### 4. General Hackathon Rules Section
- Dedicated **"General Hackathon Rules"** section and fullscreen modal displaying all 10 rapid prototyping rules verbatim:
  1. Teams must submit a working prototype within the allotted time.
  2. Participants may use AI coding assistants, open-source libraries, and permitted APIs.
  3. Teams must clearly explain which features are implemented and which are simulated.
  4. The prototype must demonstrate the core functionality of the selected problem statement.
  5. Participants must not present sample or simulated results as genuine live detections.
  6. All datasets, APIs, and external resources used must be acknowledged.
  7. Teams must respect privacy, consent, copyright, and applicable laws.
  8. Participants must not upload private or sensitive recordings without proper permission.
  9. Detection systems must communicate uncertainty and must not make unsupported claims.
  10. Judges may evaluate the prototype through a live demonstration and questions.

### 5. Google Sheets Database Integration (3 Sheets)
The platform integrates with Google Sheets using `google_apps_script.js`. It records:
- **Sheet 1 (Attendance)**: Username, Team Name, Login Time, Full Name, Device Info.
- **Sheet 2 (Problem Selection)**: Team Name, Selected Problem Statement, Selected By (Username), Time of Selection, Problem ID.
- **Sheet 3 (Submissions)**: Team Name, Problem Statement, GitHub Repository Link, Explanation Link (Drive), Video Demo Link, Submitted By, Time of Submission.

---

## 🚀 How to Run the Website Locally

### Option A: Run with MongoDB Backend (Recommended)
Using Node.js with the MongoDB Express API server:
```powershell
npm start
```
Then visit **`http://localhost:5000`** in your browser.
- Full MongoDB database integration for users, teams, attendance, problem selections, and project submissions.
- Configure MongoDB Atlas or Local MongoDB in `.env` (see [MONGODB_GUIDE.md](file:///e:/Hackathon%20website/MONGODB_GUIDE.md)).
- Seed initial users: `npm run seed` or click **"⚡ Seed Users"** in the browser admin dashboard.

### Option B: Open directly in your browser
Double-click `index.html` or open it with Google Chrome, Edge, or Firefox.

### Option C: Run a local HTTP server
Using PowerShell or Terminal:
```powershell
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

---

## 🔗 How to Connect to Your Google Sheet

1. Open [Google Sheets](https://sheets.new) and create a new spreadsheet.
2. In the top menu, go to **Extensions** → **Apps Script**.
3. Delete any default code in the editor, and copy-paste the entire contents of `google_apps_script.js`.
4. Click **Deploy** → **New deployment**.
5. Click the gear icon next to "Select type" and choose **Web app**.
6. Set:
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone`
7. Click **Deploy** (grant Google permissions when prompted) and copy the **Web app URL**.
8. In the Hackathon Website:
   - Click the **"📊 Admin & Sheets"** button in the top navbar.
   - Paste the Web app URL into the **Google Apps Script Webhook URL** field and click **Save Webhook**.
9. All attendance, problem selections, and project submissions will now write automatically to your Google Spreadsheet in real time!

---

## 👥 Authentication, Roles & Permissions

### 👑 Primary Administrator:
- **User ID**: `Nareen Karthik` *(or `nareen`)*
- **Password**: `Nareen@06`
- **Role**: `SuperAdmin`
- **Permissions**:
  - Full access to all events, problem statements, and live monitors.
  - Authority to authorize and revoke **Event Coordinators**.
  - **Exclusive download access**: Download all submissions as CSV (`shristi_2026_submissions.csv`) and download team rosters (`shristi_2026_team_roster.csv`).
  - Authority to reset team problem statement selections.
  - Authority to initialize fresh Google Sheets and configure webhooks.

### 👔 Event Coordinators (Authorized by Admin):
- Added by Administrator via the **👔 Event Coordinators** tab in the Admin Control Center.
- **Permissions**:
  - Log in with assigned coordinator credentials to view and monitor all events, problem statements, team selections, and participant submissions.
  - **Restricted Access**: Coordinators **cannot** download data/CSVs, reset team selections, authorize other coordinators, or modify Google Sheets configuration.

### 🚀 Participant Teams & Teammates (Dynamic Enrollment):
- Teams register themselves via **Step 1: Register Team & Teammates** tab.
- Enter **Team Name**, **Team Lead credentials**, and add all **Teammates** with their specific roles.
- When team members log in, their attendance status updates to `● Logged In` in real time.
- **⚡ Members Working Live Monitor**: The Admin Control Center tracks in real-time exactly how many members are working on the platform, their live problem statement assignments, and session timestamps.

> **Two-Step Access Flow:**  
> When users visit the platform, **Step 1 is the Login Gateway**. Users must authenticate with their team account or Admin credentials before entering the dashboard, selecting mystery challenges, or submitting output.
