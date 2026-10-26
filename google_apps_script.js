/**
 * ============================================================================
 * SHRISTI 2026 : GOOGLE APPS SCRIPT BACKEND (FRESH SHEET ARCHITECTURE)
 * ============================================================================
 * 
 * Instructions:
 * 1. Open your Google Sheet.
 * 2. In Google Sheets menu: Extensions -> Apps Script.
 * 3. Replace all code in the script editor with this entire file.
 * 4. Click 'Deploy' -> 'New deployment'.
 * 5. Select type: 'Web app'.
 * 6. Execute as: 'Me' (your Google account).
 * 7. Who has access: 'Anyone'.
 * 8. Click 'Deploy' and copy the 'Web app URL'.
 * 9. Paste this URL into the Hackathon Admin Control Center or click 'Save Webhook'.
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "SHRISTI 2026 Google Sheets API Backend is active.",
    sheets: [
      "Sheet 1: Team Attendance & Logins",
      "Sheet 2: Team Problem Selections",
      "Sheet 3: Participant Submissions & Repositories"
    ]
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : null;
    if (!contents) {
      return formatResponse("error", "No payload received");
    }
    
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action;
    var timestamp = data.timestamp || new Date().toISOString();

    // 1. FRESH SHEET INITIALIZATION ACTION
    if (action === "init_fresh_sheet" || action === "reset_sheets") {
      initFreshSheets(ss);
      return formatResponse("success", "Fresh sheets initialized with formatted headers and column widths.");
    }

    // 2. SHEET 1: TEAM ATTENDANCE & MEMBER LOGINS (AND TEAM REGISTRATION)
    if (action === "attendance") {
      var sheet = getOrCreateSheet(ss, "Team Attendance & Logins", [
        "Team Name",
        "Member Username",
        "Member Full Name",
        "Role",
        "Login Timestamp",
        "Status"
      ], "#1e293b", "#00f2fe");

      sheet.appendRow([
        data.teamName || "Unassigned",
        data.username || "",
        data.fullName || "",
        data.role || "Team Member",
        timestamp,
        "Active / Logged In"
      ]);
      return formatResponse("success", "Attendance and team membership logged", { team: data.teamName, user: data.username });

    } else if (action === "register_team") {
      var sheet = getOrCreateSheet(ss, "Team Attendance & Logins", [
        "Team Name",
        "Member Username",
        "Member Full Name",
        "Role",
        "Login Timestamp",
        "Status"
      ], "#1e293b", "#00f2fe");

      var members = data.members || [];
      if (members.length === 0 && data.fullName) {
        members = [{ fullName: data.fullName, username: data.username, role: "Team Lead" }];
      }

      for (var m = 0; m < members.length; m++) {
        var mem = members[m];
        sheet.appendRow([
          data.teamName || "Unassigned",
          mem.username || "",
          mem.fullName || "",
          mem.role || "Team Member",
          timestamp,
          mem.role === "Team Lead" ? "Registered (Team Lead)" : "Registered (Teammate)"
        ]);
      }
      return formatResponse("success", "Team and all teammates registered to Sheet 1", { team: data.teamName, memberCount: members.length });

    // 3. SHEET 2: TEAM PROBLEM STATEMENT SELECTIONS
    } else if (action === "select_problem") {
      var sheet = getOrCreateSheet(ss, "Team Problem Selections", [
        "Team Name",
        "Selected Problem Statement",
        "Problem ID",
        "Selected By (Full Name)",
        "Selected By (Username)",
        "Time of Selection",
        "Selection Status"
      ], "#1e293b", "#10b981");

      sheet.appendRow([
        data.teamName || "",
        data.problemTitle || "",
        data.problemId ? ("PS #" + data.problemId) : "",
        data.fullName || data.selectedByName || "",
        data.username || "",
        timestamp,
        "Locked & Assigned"
      ]);
      return formatResponse("success", "Problem statement assigned to team", { team: data.teamName, problem: data.problemTitle });

    // 4. SHEET 3: PARTICIPANT SUBMISSIONS, GITHUB REPOS & DELIVERABLES
    } else if (action === "submission") {
      var sheet = getOrCreateSheet(ss, "Participant Submissions & Repos", [
        "Team Name",
        "Problem Statement Title",
        "Public GitHub Repository Link",
        "Project Explanation Link (Google Drive)",
        "Working Model Video Link",
        "Implemented vs Simulated Declaration",
        "Project Description & Architecture",
        "Submitted By (Full Name)",
        "Submitted By (Username)",
        "Submission Timestamp"
      ], "#1e293b", "#a855f7");

      sheet.appendRow([
        data.teamName || "",
        data.problemTitle || "",
        data.githubLink || data.submissionLink || "",
        data.explanationLink || "",
        data.videoLink || data.demoLink || "",
        data.simulatedNotes || "",
        data.notes || "",
        data.submittedByName || data.fullName || "",
        data.username || "",
        timestamp
      ]);

      return formatResponse("success", "Participant deliverables and GitHub repo recorded", { 
        team: data.teamName,
        github: data.githubLink
      });

    } else {
      return formatResponse("error", "Unknown action: " + action);
    }

  } catch (err) {
    return formatResponse("error", err.toString());
  }
}

function initFreshSheets(ss) {
  getOrCreateSheet(ss, "Team Attendance & Logins", [
    "Team Name", "Member Username", "Member Full Name", "Role", "Login Timestamp", "Status"
  ], "#1e293b", "#00f2fe");

  getOrCreateSheet(ss, "Team Problem Selections", [
    "Team Name", "Selected Problem Statement", "Problem ID", "Selected By (Full Name)", "Selected By (Username)", "Time of Selection", "Selection Status"
  ], "#1e293b", "#10b981");

  getOrCreateSheet(ss, "Participant Submissions & Repos", [
    "Team Name", "Problem Statement Title", "Public GitHub Repository Link", "Project Explanation Link (Google Drive)", "Working Model Video Link", "Implemented vs Simulated Declaration", "Project Description & Architecture", "Submitted By (Full Name)", "Submitted By (Username)", "Submission Timestamp"
  ], "#1e293b", "#a855f7");
}

function getOrCreateSheet(ss, sheetName, headers, bgColor, accentColor) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    
    // Style headers
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground(bgColor || "#1e293b");
    headerRange.setFontColor(accentColor || "#f8fafc");
    headerRange.setFontSize(10);
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 34);
    
    // Auto-fit column widths
    for (var i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 200);
    }
  }
  return sheet;
}

function formatResponse(status, message, details) {
  var output = {
    status: status,
    message: message,
    timestamp: new Date().toISOString()
  };
  if (details) output.details = details;
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
