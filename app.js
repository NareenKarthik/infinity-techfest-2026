/**
 * Hackathon Management Platform - Core Logic
 * Handles Authentication, Real-time Team Locking, Problem Statement Cards,
 * Submission Portal, Rules Modal, and Google Sheets Synchronization.
 */

// Global State
const State = {
  currentUser: null,
  webhookUrl: localStorage.getItem('shristi_webhook_url') || localStorage.getItem('innovex_webhook_url') || '',
  // Keyed by teamName: { problemId, problemTitle, selectedBy, timestamp }
  teamSelections: JSON.parse(localStorage.getItem('shristi_team_selections') || localStorage.getItem('innovex_team_selections') || '{}'),
  // Keyed by teamName: { problemId, problemTitle, submissionLink, demoLink, notes, simulatedNotes, submittedBy, timestamp }
  teamSubmissions: JSON.parse(localStorage.getItem('shristi_team_submissions') || localStorage.getItem('innovex_team_submissions') || '{}'),
  // Array of { username, teamName, fullName, timestamp }
  attendanceLog: JSON.parse(localStorage.getItem('shristi_attendance_log') || localStorage.getItem('innovex_attendance_log') || '[]'),
  // Keyed by teamName: { teamName, leadFullName, leadUsername, password, members: [ { fullName, username, role } ], registeredAt }
  registeredTeams: JSON.parse(localStorage.getItem('shristi_registered_teams') || localStorage.getItem('innovex_registered_teams') || '{}'),
  // Array of { fullName, username, password, track, role: 'Coordinator', addedAt }
  coordinators: JSON.parse(localStorage.getItem('shristi_coordinators') || localStorage.getItem('innovex_coordinators') || '[]'),
  activeFilter: 'all',
  searchQuery: '',
  adminTimer: JSON.parse(localStorage.getItem('shristi_admin_timer') || 'null')
};

// Cross-tab Synchronization Channel
const syncChannel = 'BroadcastChannel' in window ? new BroadcastChannel('shristi_hackathon_channel') : null;

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type === 'TEAM_SELECTION_UPDATED') {
      State.teamSelections = payload.teamSelections;
      updateUI();
      showToast(`Team update: ${payload.teamName} selected Problem #${payload.problemId}`, 'info');
    } else if (type === 'SUBMISSION_UPDATED') {
      State.teamSubmissions = payload.teamSubmissions;
      updateUI();
      showToast(`New submission received for ${payload.teamName}`, 'info');
    } else if (type === 'ATTENDANCE_UPDATED') {
      State.attendanceLog = payload.attendanceLog;
      renderAdminTables();
    } else if (type === 'TEAM_REGISTERED') {
      State.registeredTeams = payload.registeredTeams;
      renderAdminTables();
      showToast(`New team registered: ${payload.teamName}`, 'info');
    } else if (type === 'COORDINATORS_UPDATED') {
      State.coordinators = payload.coordinators;
      renderAdminTables();
    } else if (type === 'TIMER_BROADCAST') {
      State.adminTimer = payload;
      updateTimerUI();
      if (payload && payload.active) {
        showToast(`Official Timer broadcast by Admin: ${payload.durationMinutes} Minutes`, 'info');
      } else {
        showToast('Hackathon timer removed by Admin.', 'info');
      }
    }
  };
}

// Storage Event Fallback for Cross-tab Sync
window.addEventListener('storage', (e) => {
  if (e.key === 'shristi_team_selections' || e.key === 'innovex_team_selections') {
    State.teamSelections = JSON.parse(e.newValue || '{}');
    updateUI();
  } else if (e.key === 'shristi_team_submissions' || e.key === 'innovex_team_submissions') {
    State.teamSubmissions = JSON.parse(e.newValue || '{}');
    updateUI();
  } else if (e.key === 'shristi_attendance_log' || e.key === 'innovex_attendance_log') {
    State.attendanceLog = JSON.parse(e.newValue || '[]');
    renderAdminTables();
  } else if (e.key === 'shristi_registered_teams' || e.key === 'innovex_registered_teams') {
    State.registeredTeams = JSON.parse(e.newValue || '{}');
    renderAdminTables();
  } else if (e.key === 'shristi_coordinators' || e.key === 'innovex_coordinators') {
    State.coordinators = JSON.parse(e.newValue || '[]');
    renderAdminTables();
  } else if (e.key === 'shristi_admin_timer') {
    State.adminTimer = JSON.parse(e.newValue || 'null');
    updateTimerUI();
  }
});

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initCountdownTimer();
  renderProblemCards();
  renderGeneralRules();
  setupEventListeners();
  updateUI();
  initMongoSync();
});

// Authentication System
function initAuth() {
  const savedUser = localStorage.getItem('shristi_current_user') || localStorage.getItem('innovex_current_user');
  if (savedUser) {
    try {
      State.currentUser = JSON.parse(savedUser);
    } catch (e) {
      State.currentUser = null;
    }
  } else {
    State.currentUser = null;
  }
}

function loginUser(userObj, recordAttendance = true) {
  State.currentUser = userObj;
  localStorage.setItem('shristi_current_user', JSON.stringify(userObj));

  if (recordAttendance) {
    const attendanceRecord = {
      username: userObj.username,
      teamName: userObj.teamName,
      fullName: userObj.fullName,
      timestamp: new Date().toLocaleString()
    };
    
    // Check if attendance already recorded for this session
    const alreadyLogged = State.attendanceLog.some(
      a => a.username === userObj.username && new Date(a.timestamp).toDateString() === new Date().toDateString()
    );

    if (!alreadyLogged) {
      State.attendanceLog.unshift(attendanceRecord);
      localStorage.setItem('shristi_attendance_log', JSON.stringify(State.attendanceLog));
      
      // Dispatch Webhook to Google Sheets (Sheet 1 - Attendance)
      pushToGoogleSheets({
        action: 'attendance',
        username: userObj.username,
        teamName: userObj.teamName,
        fullName: userObj.fullName,
        timestamp: new Date().toISOString()
      });

      // Dispatch to MongoDB User Database
      if (typeof MongoAPI !== 'undefined' && MongoAPI.isOnline) {
        MongoAPI.recordAttendance({
          username: userObj.username,
          fullName: userObj.fullName,
          teamName: userObj.teamName,
          deviceInfo: navigator.userAgent
        }).catch(err => console.warn('Mongo attendance error:', err));
      }

      if (syncChannel) {
        syncChannel.postMessage({
          type: 'ATTENDANCE_UPDATED',
          payload: { attendanceLog: State.attendanceLog }
        });
      }
    }
  }

  showToast(`Welcome, ${userObj.fullName}! Assigned to ${userObj.teamName}`, 'success');
  updateUI();
  closeModal('loginModal');
}

function logoutUser() {
  const name = State.currentUser ? State.currentUser.fullName : 'User';
  State.currentUser = null;
  localStorage.removeItem('shristi_current_user');
  localStorage.removeItem('innovex_current_user');
  const mongoPill = document.getElementById('mongoStatusPill');
  const mongoTabBtn = document.getElementById('btn-admin-mongo');
  if (mongoPill) mongoPill.style.display = 'none';
  if (mongoTabBtn) mongoTabBtn.style.display = 'none';
  showToast(`${name} has logged out.`, 'info');
  updateUI();
}

// Google Sheets Webhook Dispatcher
async function pushToGoogleSheets(payload) {
  const url = State.webhookUrl || HACKATHON_CONFIG.defaultWebhookUrl;
  if (!url) {
    console.info('[Sheets API Mock] No webhook URL configured yet. Action stored in local database:', payload);
    return;
  }

  try {
    // Google Apps Script requires no-cors or redirect handling in standard fetch
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log('[Sheets API] Webhook sent successfully:', payload.action);
  } catch (error) {
    console.warn('[Sheets API Error] Failed to push to Google Sheet:', error);
  }
}

// Problem Statement Selection & Team-Locking Logic
function selectProblemStatement(problemId) {
  if (!State.currentUser) {
    openModal('loginModal');
    return;
  }

  const teamName = State.currentUser.teamName;
  const existingSelection = State.teamSelections[teamName];

  // Locking Rule: If team already selected a problem, block further selection
  if (existingSelection) {
    showToast(`Locked: Your team has already selected Problem Statement: "${existingSelection.problemTitle}"`, 'error');
    return;
  }

  const problem = PROBLEM_STATEMENTS.find(p => p.id === problemId);
  if (!problem) return;

  const now = new Date();
  const selectionData = {
    problemId: problem.id,
    problemTitle: problem.title,
    selectedBy: State.currentUser.username,
    selectedByName: State.currentUser.fullName,
    timestamp: now.toLocaleString(),
    isoTimestamp: now.toISOString()
  };

  // Assign to team
  State.teamSelections[teamName] = selectionData;
  localStorage.setItem('shristi_team_selections', JSON.stringify(State.teamSelections));

  // Push to Google Sheets (Sheet 2 - Problem Selection)
  pushToGoogleSheets({
    action: 'select_problem',
    teamName: teamName,
    problemId: problem.id,
    problemTitle: problem.title,
    username: State.currentUser.username,
    timestamp: now.toISOString()
  });

  // Sync to MongoDB
  if (typeof MongoAPI !== 'undefined' && MongoAPI.isOnline) {
    MongoAPI.saveProblemSelection({
      teamName: teamName,
      problemId: problem.id,
      problemTitle: problem.title,
      selectedBy: State.currentUser.username
    }).catch(err => console.warn('Mongo select sync error:', err));
  }

  // Broadcast to other members across browser tabs
  if (syncChannel) {
    syncChannel.postMessage({
      type: 'TEAM_SELECTION_UPDATED',
      payload: {
        teamName: teamName,
        problemId: problem.id,
        teamSelections: State.teamSelections
      }
    });
  }

  showToast(`Success! Problem Statement #${problem.number} assigned to ${teamName}`, 'success');
  updateUI();

  // Scroll smoothly to submission portal or highlight
  const submissionSection = document.getElementById('submissionSection');
  if (submissionSection) {
    submissionSection.scrollIntoView({ behavior: 'smooth' });
  }
}

// Reset / Change Team Selection (Admin or Demo reset)
function resetTeamSelection(teamName) {
  if (State.teamSelections[teamName]) {
    delete State.teamSelections[teamName];
    delete State.teamSubmissions[teamName];
    localStorage.setItem('shristi_team_selections', JSON.stringify(State.teamSelections));
    localStorage.setItem('shristi_team_submissions', JSON.stringify(State.teamSubmissions));

    if (syncChannel) {
      syncChannel.postMessage({
        type: 'TEAM_SELECTION_UPDATED',
        payload: { teamName: teamName, problemId: null, teamSelections: State.teamSelections }
      });
    }

    showToast(`Selection reset for ${teamName}`, 'info');
    updateUI();
  }
}

// Submission Portal Logic
function handleProjectSubmission(e) {
  e.preventDefault();

  if (!State.currentUser) {
    openModal('loginModal');
    return;
  }

  const teamName = State.currentUser.teamName;
  const currentSelection = State.teamSelections[teamName];

  if (!currentSelection) {
    showToast('You must select a problem statement before submitting!', 'error');
    return;
  }

  const githubLink = document.getElementById('submitGithubLink').value.trim();
  const explanationLink = document.getElementById('submitExplanationLink').value.trim();
  const videoLink = document.getElementById('submitVideoLink').value.trim();

  if (!githubLink || !explanationLink || !videoLink) {
    showToast('Please provide all three required project links (GitHub, Drive Explanation, Video).', 'error');
    return;
  }

  const now = new Date();
  const submissionPayload = {
    problemId: currentSelection.problemId,
    problemTitle: currentSelection.problemTitle,
    githubLink: githubLink,
    explanationLink: explanationLink,
    videoLink: videoLink,
    submittedBy: State.currentUser.username,
    submittedByName: State.currentUser.fullName,
    timestamp: now.toLocaleString(),
    isoTimestamp: now.toISOString()
  };

  State.teamSubmissions[teamName] = submissionPayload;
  localStorage.setItem('shristi_team_submissions', JSON.stringify(State.teamSubmissions));

  // Push to Google Sheets (Sheet 3 - Submissions)
  pushToGoogleSheets({
    action: 'submission',
    teamName: teamName,
    problemTitle: currentSelection.problemTitle,
    githubLink: githubLink,
    explanationLink: explanationLink,
    videoLink: videoLink,
    username: State.currentUser.username,
    timestamp: now.toISOString()
  });

  // Sync to MongoDB
  if (typeof MongoAPI !== 'undefined' && MongoAPI.isOnline) {
    MongoAPI.saveSubmission({
      teamName: teamName,
      githubLink: githubLink,
      explanationLink: explanationLink,
      videoLink: videoLink,
      submittedBy: State.currentUser.username
    }).catch(err => console.warn('Mongo submission sync error:', err));
  }

  // Broadcast to team members
  if (syncChannel) {
    syncChannel.postMessage({
      type: 'SUBMISSION_UPDATED',
      payload: { teamName: teamName, teamSubmissions: State.teamSubmissions }
    });
  }

  showToast(`Output transmitted successfully for ${teamName}!`, 'success');
  updateUI();
}

// UI Rendering & Updates
function updateUI() {
  updateUserNav();
  updateTeamBanner();
  renderConstantProblemShowcase();
  renderProblemCards();
  updateSubmissionSection();
  renderAdminTables();
}

function updateUserNav() {
  const userProfileContainer = document.getElementById('navUserProfile');
  const loginBtn = document.getElementById('navLoginBtn');
  const loginFirstStepSection = document.getElementById('loginFirstStepSection');
  const appDashboardSection = document.getElementById('appDashboardSection');
  const mongoPill = document.getElementById('mongoStatusPill');
  const mongoTabBtn = document.getElementById('btn-admin-mongo');

  if (State.currentUser) {
    if (loginFirstStepSection) loginFirstStepSection.style.display = 'none';
    if (appDashboardSection) appDashboardSection.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'none';
    if (userProfileContainer) userProfileContainer.style.display = 'flex';

    const isSuperAdmin = State.currentUser.role === 'SuperAdmin';
    const isCoordinator = State.currentUser.role === 'Coordinator';
    
    // MongoDB controls strictly restricted to SuperAdmin
    if (mongoPill) mongoPill.style.display = isSuperAdmin ? 'inline-flex' : 'none';
    if (mongoTabBtn) mongoTabBtn.style.display = isSuperAdmin ? 'inline-block' : 'none';

    document.getElementById('navUserName').textContent = State.currentUser.fullName;
    
    if (isSuperAdmin) {
      document.getElementById('navUserTeam').innerHTML = '<span style="color: #f59e0b; font-weight: 700;">👑 SuperAdmin (Organizer)</span>';
      document.getElementById('navUserInitials').textContent = '👑';
    } else if (isCoordinator) {
      document.getElementById('navUserTeam').innerHTML = '<span style="color: #38bdf8; font-weight: 700;">👔 Event Coordinator (View-Only)</span>';
      document.getElementById('navUserInitials').textContent = '👔';
    } else {
      document.getElementById('navUserTeam').innerHTML = State.currentUser.teamName;
      document.getElementById('navUserInitials').textContent = State.currentUser.fullName.split(' ').map(n => n[0]).join('');
    }
  } else {
    if (loginFirstStepSection) loginFirstStepSection.style.display = 'flex';
    if (appDashboardSection) appDashboardSection.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userProfileContainer) userProfileContainer.style.display = 'none';
    if (mongoPill) mongoPill.style.display = 'none';
    if (mongoTabBtn) mongoTabBtn.style.display = 'none';
  }
}

function updateTeamBanner() {
  const strip = document.getElementById('teamStatusStrip');
  const titleEl = document.getElementById('teamStatusTitle');
  const subEl = document.getElementById('teamStatusSub');
  const iconEl = document.getElementById('teamStatusIcon');

  if (!State.currentUser) {
    strip.className = 'team-status-strip not-selected';
    iconEl.textContent = '🔒';
    titleEl.textContent = 'Closed Login Portal Active';
    subEl.textContent = 'Please log in with your assigned team credentials or register your team in Step 1.';
    return;
  }

  if (State.currentUser.role === 'SuperAdmin') {
    strip.className = 'team-status-strip';
    iconEl.textContent = '👑';
    titleEl.innerHTML = `Administrator Control Portal — <span style="color: var(--neon-cyan);">Nareen Karthik</span>`;
    subEl.textContent = `Full management mode active. Viewing all teams, assignments, submissions, and Google Sheets sync.`;
    return;
  }

  if (State.currentUser.role === 'Coordinator') {
    strip.className = 'team-status-strip';
    iconEl.textContent = '👔';
    titleEl.innerHTML = `Event Coordinator Monitoring Mode — <span style="color: var(--neon-cyan);">${State.currentUser.fullName}</span>`;
    subEl.textContent = `Viewing all event activities, teams, problem statements, and participant deliverables (View-Only Mode).`;
    return;
  }

  const teamName = State.currentUser.teamName;
  const selection = State.teamSelections[teamName];

  if (selection) {
    strip.className = 'team-status-strip';
    iconEl.textContent = '✓';
    titleEl.innerHTML = `Constant Problem Statement: <span style="color: var(--neon-cyan);">${selection.problemTitle}</span>`;
    subEl.textContent = `Revealed and locked for ${teamName} by ${selection.selectedByName || selection.selectedBy} on ${selection.timestamp}.`;
  } else {
    strip.className = 'team-status-strip not-selected';
    iconEl.textContent = '⚡';
    titleEl.textContent = `${teamName} — Blind Challenge Selection`;
    subEl.textContent = `All problem statements are hidden. Click 'Select & Reveal' on any card below to decrypt your team's constant problem statement!`;
  }
}

function renderConstantProblemShowcase() {
  const container = document.getElementById('constantProblemShowcaseContainer');
  if (!container) return;

  const currentTeam = State.currentUser ? State.currentUser.teamName : null;
  const currentTeamSelection = currentTeam ? State.teamSelections[currentTeam] : null;

  if (!currentTeamSelection) {
    container.innerHTML = '';
    return;
  }

  const problem = PROBLEM_STATEMENTS.find(p => p.id === currentTeamSelection.problemId);
  if (!problem) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="constant-problem-showcase">
      <div class="constant-card">
        <div class="constant-header-badge">
          <span>★</span>
          <span>CONSTANT PROBLEM STATEMENT FOR ${currentTeam.toUpperCase()}</span>
        </div>

        <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem;">
          <div style="flex: 1; min-width: 280px;">
            <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
              <span class="ps-number-badge">PS #${problem.number}</span>
              <span class="ps-tag-badge">${problem.tag}</span>
              <span style="font-size: 0.76rem; color: var(--neon-emerald); font-family: var(--font-mono); font-weight: 700;">
                ✓ REVEALED ON SELECTION
              </span>
            </div>

            <h2 style="font-size: 2rem; color: #fff; margin: 0.25rem 0 0.5rem; line-height: 1.25;">
              ${problem.title}
            </h2>
            <div class="ps-card-domain" style="margin-bottom: 0.75rem;">Domain: ${problem.domain}</div>

            <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6; max-width: 850px; margin-bottom: 1rem;">
              ${problem.description}
            </p>

            <div style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono);">
              Revealed by: <strong style="color: #fff;">${currentTeamSelection.selectedByName || currentTeamSelection.selectedBy}</strong> on ${currentTeamSelection.timestamp}
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem; min-width: 200px;">
            <button class="btn btn-primary" onclick="document.getElementById('submissionSection').scrollIntoView({behavior: 'smooth'})">
              <span>Go to Submission Portal ↓</span>
            </button>
            <button class="btn btn-outline btn-sm" onclick="openProblemModal(${problem.id})">
              <span>View Full Specification</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function promptConfirmSelection(problemId) {
  if (!State.currentUser) {
    openModal('loginModal');
    return;
  }

  const teamName = State.currentUser.teamName;
  const existingSelection = State.teamSelections[teamName];

  if (existingSelection) {
    showToast(`Locked: Your team already revealed and locked: "${existingSelection.problemTitle}"`, 'error');
    return;
  }

  const problem = PROBLEM_STATEMENTS.find(p => p.id === problemId);
  if (!problem) return;

  const cardTitleEl = document.getElementById('confirmRevealCardName');
  const teamNameEl = document.getElementById('confirmRevealTeamName');
  const executeBtn = document.getElementById('confirmRevealExecuteBtn');

  if (cardTitleEl) cardTitleEl.textContent = `Decrypt & Reveal Challenge Card #${problem.number}?`;
  if (teamNameEl) teamNameEl.textContent = teamName;

  if (executeBtn) {
    executeBtn.onclick = () => {
      closeModal('confirmRevealModal');
      selectProblemStatement(problem.id);
    };
  }

  openModal('confirmRevealModal');
}

function renderProblemCards() {
  const container = document.getElementById('problemCardsContainer');
  if (!container) return;

  const currentTeam = State.currentUser ? State.currentUser.teamName : null;
  const currentTeamSelection = currentTeam ? State.teamSelections[currentTeam] : null;

  // Filter & Search
  const filtered = PROBLEM_STATEMENTS.filter(item => {
    const matchesFilter = State.activeFilter === 'all' || item.tag.toLowerCase().includes(State.activeFilter.toLowerCase());
    const query = State.searchQuery.toLowerCase();
    const matchesSearch = !query || 
      item.number.includes(query) ||
      (currentTeamSelection && currentTeamSelection.problemId === item.id && item.title.toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
        <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">No cards match your filter criteria.</p>
        <button class="btn btn-outline btn-sm" onclick="clearFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isSelectedByMyTeam = currentTeamSelection && currentTeamSelection.problemId === item.id;
    const isTeamLocked = currentTeamSelection && !isSelectedByMyTeam;

    // SCENARIO 1: Problem has been selected by this team -> REVEAL IT FULLY!
    if (isSelectedByMyTeam) {
      return `
        <div class="ps-card selected-by-my-team" id="card-ps-${item.id}">
          <div>
            <div class="ps-card-header">
              <span class="ps-number-badge">PS #${item.number}</span>
              <span class="ps-tag-badge" style="color: var(--neon-emerald); border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.15);">
                ✓ Constant Team Problem
              </span>
            </div>

            <h3 class="ps-card-title">${item.title}</h3>
            <div class="ps-card-domain">Domain: ${item.domain}</div>

            <p class="ps-card-desc" style="margin-top: 0.75rem;">${item.description}</p>

            <div class="ps-features-preview" style="margin-top: 1rem;">
              <div class="features-header-mini">
                <span>Required Features (Revealed)</span>
                <span>${item.features.length} Tasks</span>
              </div>
              <ul class="features-list-mini">
                ${item.features.slice(0, 3).map(f => `<li>${f}</li>`).join('')}
                ${item.features.length > 3 ? `<li style="color: var(--neon-cyan); font-weight: 500;">+ ${item.features.length - 3} more features</li>` : ''}
              </ul>
            </div>

            <div style="margin-top: 1rem;">
              <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono); margin-bottom: 0.35rem;">SUGGESTED TECHNOLOGIES</div>
              <div class="ps-tech-tags">
                ${item.suggestedTech.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
              </div>
            </div>
          </div>

          <div class="ps-card-footer">
            <button class="btn btn-outline btn-sm" onclick="openProblemModal(${item.id})">
              <span>Full Details & Spec</span>
            </button>
            <span class="assigned-status-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Constant Team Problem
            </span>
          </div>
        </div>
      `;
    }

    // SCENARIO 2: Team already has a problem assigned -> OTHER CARDS ARE LOCKED & CONCEALED
    if (isTeamLocked) {
      return `
        <div class="ps-card team-locked" id="card-ps-${item.id}">
          <div>
            <div class="ps-card-header">
              <span class="ps-number-badge" style="opacity: 0.6;">CARD #${item.number}</span>
              <span class="ps-tag-badge" style="color: var(--text-muted); border-color: rgba(255, 255, 255, 0.1);">🔒 Locked</span>
            </div>

            <h3 class="ps-card-title" style="color: #64748b;">Encrypted Challenge #${item.number}</h3>
            <div class="ps-card-domain">Domain: AI, Multimedia, Cybersecurity & Intelligent Apps</div>

            <div class="mystery-preview-box" style="margin-top: 1rem; opacity: 0.7;">
              <p class="mystery-prompt-text" style="font-size: 0.8rem;">
                🔒 Card locked. Your team is already permanently committed to your revealed problem statement.
              </p>
            </div>
          </div>

          <div class="ps-card-footer">
            <button class="btn btn-outline btn-sm" disabled title="Your team has already selected your constant problem statement.">
              <span>🔒 Locked for ${currentTeam}</span>
            </button>
          </div>
        </div>
      `;
    }

    // SCENARIO 3: NO PROBLEM SELECTED YET -> ALL CARDS ARE HIDDEN MYSTERY CARDS!
    return `
      <div class="ps-card mystery-card" id="card-ps-${item.id}">
        <div>
          <div class="ps-card-header">
            <span class="ps-number-badge">CARD #${item.number}</span>
            <span class="ps-tag-badge">🔒 Encrypted Challenge</span>
          </div>

          <div class="mystery-icon-badge">🔒</div>

          <h3 class="ps-card-title" style="text-align: center; margin-bottom: 0.35rem;">
            Challenge Card #${item.number}
          </h3>
          <div class="ps-card-domain" style="text-align: center;">Domain: AI, Multimedia, Cybersecurity & Intelligent Applications</div>

          <div class="mystery-preview-box">
            <p class="mystery-prompt-text">
              The problem statement title, description, and required features are <strong>hidden</strong>.
            </p>
            <p style="font-size: 0.78rem; color: #c084fc; margin-top: 0.4rem;">
              Click below to select and reveal this as the <strong>constant problem statement</strong> for your team.
            </p>
            <div class="mystery-meta-pill">
              <span>⏱ 150-Min Rapid Prototype</span>
              <span>•</span>
              <span>6 Confidential Tasks</span>
            </div>
          </div>
        </div>

        <div class="ps-card-footer" style="justify-content: center;">
          <button class="btn btn-primary" style="width: 100%; justify-content: center;" onclick="promptConfirmSelection(${item.id})">
            <span>⚡ Select & Reveal Challenge</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateSubmissionSection() {
  const container = document.getElementById('submissionContent');
  if (!container) return;

  if (!State.currentUser) {
    container.innerHTML = `
      <div class="submission-locked-banner">
        <div class="lock-icon-huge">🔒</div>
        <h3 style="font-size: 1.3rem;">Submission Portal Locked</h3>
        <p style="color: var(--text-secondary); max-width: 500px;">
          You must be logged in as an authorized team member to view and submit outputs.
        </p>
        <button class="btn btn-primary" onclick="openModal('loginModal')">Log In Now</button>
      </div>
    `;
    return;
  }

  const teamName = State.currentUser.teamName;
  const currentSelection = State.teamSelections[teamName];
  const currentSubmission = State.teamSubmissions[teamName];

  if (!currentSelection) {
    container.innerHTML = `
      <div class="submission-locked-banner">
        <div class="lock-icon-huge" style="color: var(--neon-cyan); border-color: rgba(0, 242, 254, 0.3);">⚡</div>
        <h3 style="font-size: 1.4rem;">Select a Problem Statement to Unlock</h3>
        <p style="color: var(--text-secondary); max-width: 540px;">
          Before your team can submit your project output, a team member must first select an active problem statement from the cards above.
        </p>
        <button class="btn btn-outline" onclick="document.getElementById('problemCardsContainer').scrollIntoView({behavior: 'smooth'})">
          Browse Problem Statements
        </button>
      </div>
    `;
    return;
  }

  // Submission unlocked!
  if (currentSubmission && !State.editingSubmission) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1rem 0;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 2px solid #10b981; color: #10b981; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.75rem; box-shadow: 0 0 25px rgba(16, 185, 129, 0.35);">
          ✓
        </div>
        <h3 style="font-size: 1.6rem; color: #fff; margin-bottom: 0.35rem;">Output Transmitted Successfully!</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
          Recorded for <strong style="color: var(--neon-cyan);">${teamName}</strong> by <strong>${currentSubmission.submittedByName || currentSubmission.submittedBy}</strong> on ${currentSubmission.timestamp}.
        </p>

        <!-- Clickable Links Verification Card -->
        <div style="background: rgba(10, 15, 26, 0.85); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: var(--radius-md); padding: 1.5rem; text-align: left; display: flex; flex-direction: column; gap: 1rem; max-width: 800px; margin: 0 auto 1.5rem;">
          <div style="font-size: 0.76rem; font-family: var(--font-mono); font-weight: 700; color: var(--neon-cyan); letter-spacing: 0.08em; text-transform: uppercase;">
            VERIFY TRANSMITTED DELIVERABLES
          </div>

          <!-- Link 1: GitHub -->
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="font-size: 0.82rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; gap: 0.5rem;">
              <span>🐙</span>
              <span>Public GitHub Repository Link:</span>
            </div>
            <a href="${currentSubmission.githubLink || '#'}" target="_blank" rel="noopener noreferrer" style="color: var(--neon-cyan); text-decoration: none; font-size: 0.9rem; word-break: break-all; background: rgba(0, 242, 254, 0.08); padding: 0.5rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(0, 242, 254, 0.2); display: inline-flex; align-items: center; justify-content: space-between;">
              <span>${currentSubmission.githubLink}</span>
              <span style="font-size: 0.85rem; margin-left: 0.5rem;">↗</span>
            </a>
          </div>

          <!-- Link 2: Explanation Link -->
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="font-size: 0.82rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; gap: 0.5rem;">
              <span>📄</span>
              <span>Project Explanation Link (Google Drive):</span>
            </div>
            <a href="${currentSubmission.explanationLink || '#'}" target="_blank" rel="noopener noreferrer" style="color: #a855f7; text-decoration: none; font-size: 0.9rem; word-break: break-all; background: rgba(168, 85, 247, 0.08); padding: 0.5rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(168, 85, 247, 0.2); display: inline-flex; align-items: center; justify-content: space-between;">
              <span>${currentSubmission.explanationLink}</span>
              <span style="font-size: 0.85rem; margin-left: 0.5rem;">↗</span>
            </a>
          </div>

          <!-- Link 3: Video Demo Link -->
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="font-size: 0.82rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; gap: 0.5rem;">
              <span>🎥</span>
              <span>Working Model Video Link:</span>
            </div>
            <a href="${currentSubmission.videoLink || '#'}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none; font-size: 0.9rem; word-break: break-all; background: rgba(56, 189, 248, 0.08); padding: 0.5rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid rgba(56, 189, 248, 0.2); display: inline-flex; align-items: center; justify-content: space-between;">
              <span>${currentSubmission.videoLink}</span>
              <span style="font-size: 0.85rem; margin-left: 0.5rem;">↗</span>
            </a>
          </div>
        </div>

        <div>
          <button class="btn btn-outline btn-sm" onclick="State.editingSubmission = true; updateSubmissionSection();">
            <span>✏ Edit / Update Submission Links</span>
          </button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
        <div>
          <span class="hero-pill-badge" style="margin-bottom: 0.5rem;">Submission Portal &bull; ${teamName}</span>
          <h2 style="font-size: 1.6rem; color: #fff;">${currentSelection.problemTitle}</h2>
          <p style="font-size: 0.82rem; color: var(--text-muted); font-family: var(--font-mono);">
            Assigned on ${currentSelection.timestamp} by ${currentSelection.selectedByName || currentSelection.selectedBy}
          </p>
        </div>

        ${
          currentSubmission
            ? `<button class="btn btn-outline btn-sm" onclick="State.editingSubmission = false; updateSubmissionSection();">
                 <span>✕ Cancel Edit</span>
               </button>`
            : `<div style="color: var(--neon-amber); font-family: var(--font-mono); font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                 <span>⏱ Awaiting Submission</span>
               </div>`
        }
      </div>
    </div>

    <!-- Stacked Form: 3 Distinct Required URL Fields -->
    <form onsubmit="handleProjectSubmission(event)">
      <div style="display: flex; flex-direction: column; gap: 1.35rem; max-width: 820px; margin: 0 auto;">
        
        <!-- Field 1: Public GitHub Repository Link -->
        <div class="form-group">
          <label class="form-label" for="submitGithubLink">
            <span>Public GitHub Repository Link <span style="color: var(--neon-pink);">*</span></span>
          </label>
          <input 
            type="url" 
            id="submitGithubLink" 
            class="form-input" 
            placeholder="https://github.com/..." 
            value="${currentSubmission ? (currentSubmission.githubLink || '') : ''}" 
            required 
          />
          <span class="form-helper">Ensure the repository is set to Public.</span>
        </div>

        <!-- Field 2: Project Explanation Link (Google Drive) -->
        <div class="form-group">
          <label class="form-label" for="submitExplanationLink">
            <span>Project Explanation Link (Google Drive) <span style="color: var(--neon-pink);">*</span></span>
          </label>
          <input 
            type="url" 
            id="submitExplanationLink" 
            class="form-input" 
            placeholder="https://drive.google.com/..." 
            value="${currentSubmission ? (currentSubmission.explanationLink || '') : ''}" 
            required 
          />
          <span class="form-helper">Submit a Google Drive link containing your Word doc, PDF, or presentation. Ensure access is set to 'Anyone with the link can view'.</span>
        </div>

        <!-- Field 3: Working Model Video Link -->
        <div class="form-group">
          <label class="form-label" for="submitVideoLink">
            <span>Working Model Video Link <span style="color: var(--neon-pink);">*</span></span>
          </label>
          <input 
            type="url" 
            id="submitVideoLink" 
            class="form-input" 
            placeholder="https://youtube.com/... or Google Drive video link" 
            value="${currentSubmission ? (currentSubmission.videoLink || '') : ''}" 
            required 
          />
          <span class="form-helper">Add a video link (YouTube, Drive, etc.) demonstrating the working prototype.</span>
        </div>

        <!-- Submitting Member Readonly Info -->
        <div style="font-size: 0.8rem; color: var(--text-muted); padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <span>Submitting on behalf of <strong>${teamName}</strong> as <strong>${State.currentUser.fullName}</strong> (${State.currentUser.username})</span>
          <span>Google Sheet 3 Auto-Sync Active</span>
        </div>

        <!-- Action Row -->
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 1rem; margin-top: 0.5rem;">
          <button type="submit" class="btn btn-primary" style="padding: 0.8rem 2.2rem;">
            <span>Transmit Output</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
      </div>
    </form>
  `;
}

// General Rules Section & Modal
function renderGeneralRules() {
  const container = document.getElementById('generalRulesList');
  if (!container) return;

  container.innerHTML = GENERAL_RULES.map(rule => `
    <div class="rule-item-card">
      <div class="rule-number">${rule.id}</div>
      <div class="rule-content">
        <h4 class="rule-title">${rule.title}</h4>
        <p class="rule-desc">${rule.rule}</p>
      </div>
    </div>
  `).join('');
}

// Problem Details Modal
function openProblemModal(problemId) {
  const problem = PROBLEM_STATEMENTS.find(p => p.id === problemId);
  if (!problem) return;

  const modalBody = document.getElementById('problemModalBody');
  const modalTitle = document.getElementById('problemModalTitle');
  const selectActionBtn = document.getElementById('problemModalSelectBtn');

  modalTitle.textContent = `PS #${problem.number}: ${problem.title}`;

  modalBody.innerHTML = `
    <div>
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <span class="ps-tag-badge">${problem.tag}</span>
        <span class="ps-number-badge">${HACKATHON_CONFIG.eventType}</span>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <h5 style="color: var(--neon-cyan); font-family: var(--font-mono); font-size: 0.82rem; text-transform: uppercase;">Domain</h5>
        <p style="font-size: 0.95rem; color: #fff;">${problem.domain}</p>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <h5 style="color: var(--neon-cyan); font-family: var(--font-mono); font-size: 0.82rem; text-transform: uppercase;">Description</h5>
        <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6;">${problem.description}</p>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <h5 style="color: var(--neon-cyan); font-family: var(--font-mono); font-size: 0.82rem; text-transform: uppercase; margin-bottom: 0.6rem;">Required Prototype Features</h5>
        <div style="background: rgba(16, 23, 38, 0.7); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.25rem;">
          <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.6rem;">
            ${problem.features.map((f, i) => `
              <li style="display: flex; align-items: baseline; gap: 0.6rem; font-size: 0.9rem; color: #fff;">
                <span style="color: var(--neon-cyan); font-family: var(--font-mono); font-weight: 700;">${i + 1}.</span>
                <span>${f}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>

      <div>
        <h5 style="color: var(--neon-cyan); font-family: var(--font-mono); font-size: 0.82rem; text-transform: uppercase; margin-bottom: 0.5rem;">Suggested Technologies</h5>
        <div class="ps-tech-tags">
          ${problem.suggestedTech.map(t => `<span class="tech-tag" style="font-size: 0.8rem; padding: 0.3rem 0.65rem;">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `;

  const currentTeam = State.currentUser ? State.currentUser.teamName : null;
  const currentTeamSelection = currentTeam ? State.teamSelections[currentTeam] : null;

  if (currentTeamSelection && currentTeamSelection.problemId === problem.id) {
    selectActionBtn.disabled = true;
    selectActionBtn.textContent = 'Already Assigned to Your Team';
    selectActionBtn.className = 'btn btn-outline';
  } else if (currentTeamSelection) {
    selectActionBtn.disabled = true;
    selectActionBtn.textContent = 'Team Already Has a Problem';
    selectActionBtn.className = 'btn btn-outline';
  } else {
    selectActionBtn.disabled = false;
    selectActionBtn.textContent = 'Select For Team';
    selectActionBtn.className = 'btn btn-primary';
    selectActionBtn.onclick = () => {
      closeModal('problemModal');
      selectProblemStatement(problem.id);
    };
  }

  openModal('problemModal');
}

// Admin-Controlled Countdown Timer (Given strictly by Admin for all users)
let timerIntervalId = null;

function initCountdownTimer() {
  // Clear any legacy hardcoded timer endpoints from localStorage
  localStorage.removeItem('shristi_timer_end');
  localStorage.removeItem('innovex_timer_end');

  // Sync with backend timer API
  if (typeof MongoAPI !== 'undefined') {
    fetch(`${MongoAPI.baseUrl}/api/timer`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.timer) {
          State.adminTimer = data.timer;
          if (data.timer.active) {
            localStorage.setItem('shristi_admin_timer', JSON.stringify(data.timer));
          } else {
            localStorage.removeItem('shristi_admin_timer');
          }
          updateTimerUI();
        }
      })
      .catch(() => {
        updateTimerUI();
      });
  } else {
    updateTimerUI();
  }

  if (timerIntervalId) clearInterval(timerIntervalId);
  timerIntervalId = setInterval(updateTimerUI, 1000);
}

function updateTimerUI() {
  const navTimerPill = document.getElementById('navEventTimerPill');
  const timerDisplay = document.getElementById('eventTimerDisplay');
  const adminStatusText = document.getElementById('adminTimerStatusText');
  const adminLivePreview = document.getElementById('adminTimerLivePreview');

  const timer = State.adminTimer;

  // 1. If timer is not active or not given by Admin -> Completely remove/hide the timer section
  if (!timer || !timer.active || !timer.endTime) {
    if (navTimerPill) navTimerPill.style.display = 'none';
    if (adminStatusText) {
      adminStatusText.textContent = 'Inactive (No Timer Shown to Users)';
      adminStatusText.style.color = 'var(--text-muted)';
    }
    if (adminLivePreview) {
      adminLivePreview.textContent = '--:--:--';
      adminLivePreview.style.color = 'var(--text-muted)';
    }
    return;
  }

  // 2. Timer is active (given by Admin) -> Display and run countdown
  if (navTimerPill) navTimerPill.style.display = 'inline-flex';

  const now = Date.now();
  const remaining = Math.max(0, timer.endTime - now);

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  const pad = n => String(n).padStart(2, '0');
  const timeFormatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  if (timerDisplay) {
    timerDisplay.textContent = timeFormatted;
    if (remaining <= 0) {
      timerDisplay.style.color = 'var(--neon-rose)';
      timerDisplay.textContent = 'TIME EXPIRED';
    } else {
      timerDisplay.style.color = 'var(--neon-cyan)';
    }
  }

  if (adminLivePreview) {
    adminLivePreview.textContent = remaining > 0 ? timeFormatted : 'TIME EXPIRED';
    adminLivePreview.style.color = remaining > 0 ? 'var(--neon-cyan)' : 'var(--neon-rose)';
  }

  if (adminStatusText) {
    if (remaining > 0) {
      adminStatusText.textContent = `● Active Broadcast (${timer.durationMinutes || 'Custom'} min window)`;
      adminStatusText.style.color = 'var(--neon-emerald)';
    } else {
      adminStatusText.textContent = '● Window Closed (Time Expired)';
      adminStatusText.style.color = 'var(--neon-rose)';
    }
  }
}

// Admin Timer Actions (Controlled by SuperAdmin)
function adminStartTimer() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Only Administrator Nareen Karthik can broadcast event timers.', 'error');
    return;
  }

  const durationInput = document.getElementById('adminTimerDurationInput');
  const minutes = durationInput ? parseInt(durationInput.value, 10) : 150;

  if (isNaN(minutes) || minutes <= 0) {
    showToast('Please enter a valid duration in minutes.', 'error');
    return;
  }

  const endTime = Date.now() + (minutes * 60 * 1000);
  const timerPayload = {
    active: true,
    endTime: endTime,
    durationMinutes: minutes,
    startedBy: State.currentUser.username,
    startedAt: new Date().toISOString()
  };

  State.adminTimer = timerPayload;
  localStorage.setItem('shristi_admin_timer', JSON.stringify(timerPayload));

  // Push to backend server
  if (typeof MongoAPI !== 'undefined') {
    fetch(`${MongoAPI.baseUrl}/api/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timerPayload)
    }).catch(err => console.warn('Timer server sync error:', err));
  }

  // Broadcast to other tabs & windows
  if (syncChannel) {
    syncChannel.postMessage({
      type: 'TIMER_BROADCAST',
      payload: timerPayload
    });
  }

  updateTimerUI();
  showToast(`⚡ Official event timer of ${minutes} minutes started and broadcast to all users!`, 'success');
}

function adminRemoveTimer() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Only Administrator Nareen Karthik can modify event timers.', 'error');
    return;
  }

  const timerPayload = {
    active: false,
    endTime: null,
    durationMinutes: 150,
    startedBy: null
  };

  State.adminTimer = null;
  localStorage.removeItem('shristi_admin_timer');

  // Push to backend server
  if (typeof MongoAPI !== 'undefined') {
    fetch(`${MongoAPI.baseUrl}/api/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timerPayload)
    }).catch(err => console.warn('Timer server sync error:', err));
  }

  // Broadcast to other tabs & windows
  if (syncChannel) {
    syncChannel.postMessage({
      type: 'TIMER_BROADCAST',
      payload: timerPayload
    });
  }

  updateTimerUI();
  showToast('🛑 Event timer stopped and removed for all users.', 'info');
}

function setTimerDurationPreset(mins) {
  const durationInput = document.getElementById('adminTimerDurationInput');
  if (durationInput) {
    durationInput.value = mins;
  }
}

// Admin Tables Renderer & Dedicated Admin Block
function renderAdminTables() {
  const isSuperAdmin = State.currentUser && State.currentUser.role === 'SuperAdmin';
  const isCoordinator = State.currentUser && State.currentUser.role === 'Coordinator';
  const canViewAdminPanel = isSuperAdmin || isCoordinator;
  const adminDedicatedBlock = document.getElementById('adminDedicatedBlock');

  // Control Admin Block visibility (Visible for SuperAdmin & Coordinators ONLY)
  if (adminDedicatedBlock) {
    adminDedicatedBlock.style.display = canViewAdminPanel ? 'block' : 'none';
  }

  // 1. Metric Counts & Workforce Calculations
  const registeredTeamList = Object.values(State.registeredTeams);
  const registeredTeamCount = registeredTeamList.length;
  const totalRegisteredMembers = registeredTeamList.reduce((acc, t) => acc + (t.members ? t.members.length : 1), 0);
  const loggedInUsernames = [...new Set(State.attendanceLog.map(a => a.username.toLowerCase()))];
  const pickedCount = Object.keys(State.teamSelections).length;
  const subCount = Object.keys(State.teamSubmissions).length;

  // Build real-time list of members actively working on this website
  const workingMembersList = [];

  // 1A. Add currently logged in session (Administrator, Coordinator, or Participant)
  if (State.currentUser) {
    let currentWorkStatus = '👑 Administrator / Managing Platform';
    if (State.currentUser.role === 'Coordinator') {
      currentWorkStatus = '👔 Event Coordinator / Supervising Platform';
    } else if (State.currentUser.teamName && State.teamSubmissions[State.currentUser.teamName]) {
      currentWorkStatus = '🚀 Prototype Submitted & Live';
    } else if (State.currentUser.teamName && State.teamSelections[State.currentUser.teamName]) {
      const sel = State.teamSelections[State.currentUser.teamName];
      currentWorkStatus = `🛠️ Actively Prototyping (PS #${sel.problemId || ''} - ${sel.problemTitle || ''})`;
    } else if (State.currentUser.teamName) {
      currentWorkStatus = '🟡 Active / Browsing Problem Statements';
    }

    workingMembersList.push({
      fullName: State.currentUser.fullName,
      username: State.currentUser.username,
      role: State.currentUser.role || 'SuperAdmin',
      teamName: State.currentUser.teamName || 'Admin Operations',
      status: currentWorkStatus,
      timestamp: 'Active Session (Now)',
      isCurrentUser: true
    });
  }

  // 1B. Add participant team members who logged in (via attendance records)
  registeredTeamList.forEach(team => {
    const selection = State.teamSelections[team.teamName];
    const submission = State.teamSubmissions[team.teamName];
    (team.members || []).forEach(m => {
      // Avoid duplicate if this member is currently logged in as State.currentUser
      if (State.currentUser && State.currentUser.username && State.currentUser.username.toLowerCase() === m.username.toLowerCase()) {
        return;
      }

      const isOnline = State.attendanceLog.some(a => a.username.toLowerCase() === m.username.toLowerCase());
      if (isOnline) {
        const attendanceRecord = State.attendanceLog.find(a => a.username.toLowerCase() === m.username.toLowerCase());
        let workStatus = '🟡 Active / Selecting Problem';
        if (submission) {
          workStatus = '🚀 Prototype Submitted & Live';
        } else if (selection) {
          workStatus = `🛠️ Actively Prototyping (PS #${selection.problemId || ''} - ${selection.problemTitle || ''})`;
        }

        workingMembersList.push({
          fullName: m.fullName,
          username: m.username,
          role: m.role || 'Developer',
          teamName: team.teamName,
          status: workStatus,
          timestamp: attendanceRecord ? attendanceRecord.timestamp : 'Active Session',
          isCurrentUser: false
        });
      }
    });
  });

  // 1C. Add active coordinators if logged in
  (State.coordinators || []).forEach(c => {
    if (State.currentUser && State.currentUser.username && State.currentUser.username.toLowerCase() === c.username.toLowerCase()) {
      return;
    }
    const isOnline = State.attendanceLog.some(a => a.username.toLowerCase() === c.username.toLowerCase());
    if (isOnline) {
      workingMembersList.push({
        fullName: c.fullName,
        username: c.username,
        role: 'Coordinator',
        teamName: c.track || 'Event Operations',
        status: '👔 Event Coordinator / Supervising Platform',
        timestamp: 'Active Session',
        isCurrentUser: false
      });
    }
  });

  const membersWorkingCount = workingMembersList.length;
  const membersPrototypingCount = workingMembersList.filter(w => w.status.includes('Prototyping') || w.status.includes('Submitted')).length;

  // Unconditionally update Modal Workforce Summary Strip
  const modalMetricWorkingMembers = document.getElementById('modalMetricWorkingMembers');
  const modalMetricTotalMembers = document.getElementById('modalMetricTotalMembers');
  const modalMetricLoggedIn = document.getElementById('modalMetricLoggedIn');
  const modalMetricBuilding = document.getElementById('modalMetricBuilding');

  if (modalMetricWorkingMembers) modalMetricWorkingMembers.textContent = `${membersWorkingCount} Member${membersWorkingCount === 1 ? '' : 's'} Working`;
  if (modalMetricTotalMembers) modalMetricTotalMembers.textContent = totalRegisteredMembers;
  if (modalMetricLoggedIn) modalMetricLoggedIn.textContent = loggedInUsernames.length;
  if (modalMetricBuilding) modalMetricBuilding.textContent = `${membersPrototypingCount} Prototyping`;

  // Populate Admin Block if Admin or Coordinator is logged in
  if (canViewAdminPanel) {
    const elMembersWorking = document.getElementById('metricMembersWorking');
    const elWorkingSubtext = document.getElementById('metricWorkingSubtext');
    const elTotalMembers = document.getElementById('metricTotalMembers');
    const elTotalTeams = document.getElementById('metricTotalTeams');
    const elActiveLogins = document.getElementById('metricActiveLogins');
    const elProblemsPicked = document.getElementById('metricProblemsPicked');
    const elSubmissionsReceived = document.getElementById('metricSubmissionsReceived');
    const tabCountWorking = document.getElementById('tabCountWorking');
    const badgeActiveWorkingCount = document.getElementById('badgeActiveWorkingCount');

    if (elMembersWorking) elMembersWorking.textContent = membersWorkingCount;
    if (elWorkingSubtext) elWorkingSubtext.textContent = membersWorkingCount === 1 ? '1 Member Active Now' : `${membersWorkingCount} Members Active Now`;
    if (elTotalMembers) elTotalMembers.textContent = totalRegisteredMembers;
    if (elTotalTeams) elTotalTeams.textContent = registeredTeamCount;
    if (elActiveLogins) elActiveLogins.textContent = registeredTeamCount > 0 ? `${loggedInUsernames.length} / ${totalRegisteredMembers}` : `${loggedInUsernames.length}`;
    if (elProblemsPicked) elProblemsPicked.textContent = registeredTeamCount > 0 ? `${pickedCount} / ${registeredTeamCount}` : '0';
    if (elSubmissionsReceived) elSubmissionsReceived.textContent = registeredTeamCount > 0 ? `${subCount} / ${registeredTeamCount}` : '0';
    if (tabCountWorking) tabCountWorking.textContent = membersWorkingCount;
    if (badgeActiveWorkingCount) badgeActiveWorkingCount.textContent = membersWorkingCount;

    // Render Members Working Live Table
    const adminWorkingMembersTbody = document.getElementById('adminWorkingMembersTbody');
    if (adminWorkingMembersTbody) {
      if (workingMembersList.length === 0) {
        adminWorkingMembersTbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem 1.5rem;">
              <div style="font-size: 1.8rem; margin-bottom: 0.4rem;">👥</div>
              <div style="color: #fff; font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem;">No Members Currently Working</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); max-width: 480px; margin: 0 auto;">
                When administrators, coordinators, or participant team members log in to the website, their live work activity, team, and problem statements will appear here in real-time.
              </div>
            </td>
          </tr>
        `;
      } else {
        adminWorkingMembersTbody.innerHTML = workingMembersList.map(w => {
          const isPrototyping = w.status.includes('Prototyping');
          const isSubmitted = w.status.includes('Submitted');
          const isAdmin = w.role === 'SuperAdmin';
          const isCoord = w.role === 'Coordinator';
          
          let statusBadgeColor = 'var(--text-secondary)';
          let statusBadgeBg = 'rgba(255, 255, 255, 0.05)';
          let statusBorder = 'rgba(255, 255, 255, 0.1)';

          if (isSubmitted) {
            statusBadgeColor = 'var(--neon-emerald)';
            statusBadgeBg = 'rgba(16, 185, 129, 0.12)';
            statusBorder = 'rgba(16, 185, 129, 0.3)';
          } else if (isPrototyping) {
            statusBadgeColor = 'var(--neon-cyan)';
            statusBadgeBg = 'rgba(0, 242, 254, 0.12)';
            statusBorder = 'rgba(0, 242, 254, 0.3)';
          } else if (isAdmin) {
            statusBadgeColor = '#fbbf24';
            statusBadgeBg = 'rgba(251, 191, 36, 0.12)';
            statusBorder = 'rgba(251, 191, 36, 0.3)';
          } else if (isCoord) {
            statusBadgeColor = '#a78bfa';
            statusBadgeBg = 'rgba(167, 139, 250, 0.12)';
            statusBorder = 'rgba(167, 139, 250, 0.3)';
          }

          return `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <span class="status-online-dot"></span>
                  <div style="font-weight: 700; color: #fff;">
                    ${w.fullName}
                    ${w.isCurrentUser ? '<span class="assigned-status-badge" style="font-size: 0.68rem; margin-left: 0.35rem; padding: 0.15rem 0.45rem;">You</span>' : ''}
                  </div>
                </div>
              </td>
              <td class="mono" style="color: #94a3b8; font-size: 0.8rem;">${w.username}</td>
              <td>
                <span class="role-badge" style="font-size: 0.72rem; padding: 0.2rem 0.6rem;">${w.role}</span>
              </td>
              <td style="font-weight: 600; color: #e2e8f0;">${w.teamName}</td>
              <td>
                <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; font-family: var(--font-mono); color: ${statusBadgeColor}; background: ${statusBadgeBg}; border: 1px solid ${statusBorder}; padding: 0.25rem 0.65rem; border-radius: var(--radius-sm);">
                  ${w.status}
                </span>
              </td>
              <td class="mono" style="font-size: 0.78rem; color: #94a3b8;">${w.timestamp}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 2. Download Controls Permission Check (Admin Only vs Coordinator View-Only)
    const downloadSubmissionsContainer = document.getElementById('adminDownloadActionsContainer');
    const downloadRosterContainer = document.getElementById('adminRosterDownloadContainer');
    const coordFormContainer = document.getElementById('adminCoordinatorFormContainer');
    const coordNotice = document.getElementById('coordinatorRoleNotice');

    if (isSuperAdmin) {
      if (downloadSubmissionsContainer) {
        downloadSubmissionsContainer.innerHTML = `
          <button class="btn btn-primary btn-sm" id="btnAdminDownloadSubmissions" onclick="exportSubmissionsCSV()">
            <span>📥 Download Submissions (CSV)</span>
          </button>
        `;
      }
      if (downloadRosterContainer) {
        downloadRosterContainer.innerHTML = `
          <button class="btn btn-outline btn-sm" id="btnAdminDownloadRoster" onclick="exportTeamRosterCSV()">
            <span>📥 Download Team Roster (CSV)</span>
          </button>
        `;
      }
      if (coordFormContainer) coordFormContainer.style.display = 'block';
      if (coordNotice) coordNotice.style.display = 'none';
    } else {
      // Coordinator View: Unable to use download access
      if (downloadSubmissionsContainer) {
        downloadSubmissionsContainer.innerHTML = `
          <span style="font-size: 0.78rem; color: #94a3b8; font-family: var(--font-mono); background: rgba(255, 255, 255, 0.05); padding: 0.35rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.1);">
            🔒 Download Access: Admin Only
          </span>
        `;
      }
      if (downloadRosterContainer) {
        downloadRosterContainer.innerHTML = `
          <span style="font-size: 0.78rem; color: #94a3b8; font-family: var(--font-mono); background: rgba(255, 255, 255, 0.05); padding: 0.35rem 0.75rem; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.1);">
            🔒 Download Access: Admin Only
          </span>
        `;
      }
      if (coordFormContainer) coordFormContainer.style.display = 'none';
      if (coordNotice) coordNotice.style.display = 'block';
    }

    // 3. Team Roster Grid: Which Member is in Which Team & Logins
    const adminTeamRosterGrid = document.getElementById('adminTeamRosterGrid');
    if (adminTeamRosterGrid) {
      if (registeredTeamList.length === 0) {
        adminTeamRosterGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; background: rgba(14, 20, 32, 0.5); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md); color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">👥</div>
            <h4 style="color: #fff; font-size: 1.1rem; margin-bottom: 0.35rem;">No Teams Registered Yet (0)</h4>
            <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 520px; margin: 0 auto;">
              Participant teams that register their team name and teammates in Step 1 will appear here in real-time with their member rosters and live login status.
            </p>
          </div>
        `;
      } else {
        adminTeamRosterGrid.innerHTML = registeredTeamList.map(team => {
          const selection = State.teamSelections[team.teamName];
          const members = team.members || [];
          return `
            <div class="team-roster-card">
              <div class="team-roster-header">
                <div>
                  <h4 style="font-size: 1.05rem; color: #fff;">${team.teamName}</h4>
                  <span style="font-size: 0.72rem; color: var(--neon-cyan); font-family: var(--font-mono);">${members.length} Members Registered</span>
                </div>
                ${selection 
                  ? `<span class="assigned-status-badge" style="font-size: 0.72rem; padding: 0.2rem 0.55rem;">✓ PS #${selection.problemId || ''}</span>`
                  : `<span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">No Selection</span>`
                }
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.45rem;">
                ${members.map(m => {
                  const isOnline = State.attendanceLog.some(a => a.username.toLowerCase() === m.username.toLowerCase());
                  return `
                    <div class="member-list-item">
                      <div>
                        <div style="font-weight: 600; color: #f8fafc;">${m.fullName} <span style="font-size: 0.72rem; color: #94a3b8;">(${m.role})</span></div>
                        <div class="mono" style="font-size: 0.72rem; color: #64748b;">${m.username}</div>
                      </div>
                      <div>
                        ${isOnline 
                          ? `<span style="color: var(--neon-emerald); font-size: 0.74rem; font-family: var(--font-mono); display: flex; align-items: center; gap: 0.35rem;"><span class="status-online-dot"></span> Logged In</span>`
                          : `<span style="color: var(--text-muted); font-size: 0.74rem; font-family: var(--font-mono); display: flex; align-items: center; gap: 0.35rem;"><span class="status-offline-dot"></span> Pending</span>`
                        }
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 4. Problem Selections Table inside Admin Block
    const adminBlockSelectionsTbody = document.getElementById('adminBlockSelectionsTbody');
    if (adminBlockSelectionsTbody) {
      const selections = Object.entries(State.teamSelections);
      adminBlockSelectionsTbody.innerHTML = selections.length === 0
        ? `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No problem statements selected yet.</td></tr>`
        : selections.map(([teamName, data]) => `
            <tr>
              <td style="font-weight: 700; color: #fff;">${teamName}</td>
              <td style="color: var(--neon-cyan); font-weight: 600;">${data.problemTitle}</td>
              <td class="mono">PS #${data.problemId || '-'}</td>
              <td class="mono">${data.selectedByName || data.selectedBy}</td>
              <td class="mono" style="font-size: 0.78rem;">${data.timestamp}</td>
              <td>
                ${isSuperAdmin 
                  ? `<button class="btn btn-danger-outline btn-sm" onclick="resetTeamSelection('${teamName}')">Reset Selection</button>`
                  : `<span style="color: var(--text-muted); font-size: 0.78rem;">🔒 Admin Only</span>`
                }
              </td>
            </tr>
          `).join('');
    }

    // 5. Participant Submissions & Repositories inside Admin Block
    const adminBlockSubmissionsTbody = document.getElementById('adminBlockSubmissionsTbody');
    if (adminBlockSubmissionsTbody) {
      const submissions = Object.entries(State.teamSubmissions);
      adminBlockSubmissionsTbody.innerHTML = submissions.length === 0
        ? `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No participant submissions received yet.</td></tr>`
        : submissions.map(([teamName, sub]) => `
            <tr>
              <td style="font-weight: 700; color: #fff;">${teamName}</td>
              <td style="color: var(--neon-cyan); font-weight: 600;">${sub.problemTitle}</td>
              <td>
                <a href="${sub.githubLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="color: #38bdf8; font-size: 0.75rem;">
                  <span>🐙 Open GitHub Repo</span> ↗
                </a>
              </td>
              <td>
                <a href="${sub.explanationLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="color: #c084fc; font-size: 0.75rem;">
                  <span>📄 View Drive Doc</span> ↗
                </a>
              </td>
              <td>
                <a href="${sub.videoLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="color: #34d399; font-size: 0.75rem;">
                  <span>🎥 Watch Video Demo</span> ↗
                </a>
              </td>
              <td class="mono">${sub.submittedByName || sub.submittedBy}</td>
              <td class="mono" style="font-size: 0.78rem;">${sub.timestamp}</td>
            </tr>
          `).join('');
    }

    // 6. Authorized Coordinators Table inside Admin Block
    const adminCoordinatorsTbody = document.getElementById('adminCoordinatorsTbody');
    if (adminCoordinatorsTbody) {
      if (State.coordinators.length === 0) {
        adminCoordinatorsTbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
              No Event Coordinators authorized yet. Administrators can use the form above to add coordinators.
            </td>
          </tr>
        `;
      } else {
        adminCoordinatorsTbody.innerHTML = State.coordinators.map(c => `
          <tr>
            <td style="font-weight: 700; color: #fff;">${c.fullName}</td>
            <td class="mono" style="color: var(--neon-cyan);">${c.username}</td>
            <td>${c.track || 'Evaluation Committee'}</td>
            <td>
              <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 4px;">
                👁️ View-Only Monitor (No Downloads)
              </span>
            </td>
            <td><span style="color: var(--neon-emerald); font-family: var(--font-mono); font-size: 0.74rem;">Active</span></td>
            <td>
              ${isSuperAdmin 
                ? `<button class="btn btn-danger-outline btn-sm" onclick="revokeCoordinator('${c.username}')">Revoke Access</button>`
                : `<span style="color: var(--text-muted); font-size: 0.78rem;">Admin Only</span>`
              }
            </td>
          </tr>
        `).join('');
      }
    }

    // 7. Platform User Directory (All Users Table)
    const adminAllUsersTbody = document.getElementById('adminAllUsersTbody');
    const elCountAdminAllUsers = document.getElementById('countAdminAllUsers');
    if (adminAllUsersTbody) {
      const allPlatformUsers = [];

      // 7A. SuperAdmins from PRELOADED_USERS
      PRELOADED_USERS.forEach(u => {
        const isOnline = State.attendanceLog.some(a => a.username.toLowerCase() === u.username.toLowerCase()) || 
                         (State.currentUser && State.currentUser.username.toLowerCase() === u.username.toLowerCase());
        allPlatformUsers.push({
          fullName: u.fullName,
          username: u.username,
          teamName: u.teamName || 'Admin Operations',
          role: u.role || 'SuperAdmin',
          isOnline: isOnline,
          isProtected: true
        });
      });

      // 7B. Coordinators
      (State.coordinators || []).forEach(c => {
        const isOnline = State.attendanceLog.some(a => a.username.toLowerCase() === c.username.toLowerCase()) ||
                         (State.currentUser && State.currentUser.username.toLowerCase() === c.username.toLowerCase());
        allPlatformUsers.push({
          fullName: c.fullName,
          username: c.username,
          teamName: c.track || 'Event Operations',
          role: 'Coordinator',
          isOnline: isOnline,
          isProtected: false
        });
      });

      // 7C. Participant Teams & Members
      Object.values(State.registeredTeams || {}).forEach(team => {
        (team.members || []).forEach(m => {
          const isOnline = State.attendanceLog.some(a => a.username.toLowerCase() === m.username.toLowerCase()) ||
                           (State.currentUser && State.currentUser.username && State.currentUser.username.toLowerCase() === m.username.toLowerCase());
          allPlatformUsers.push({
            fullName: m.fullName,
            username: m.username,
            teamName: team.teamName,
            role: m.role || 'Developer',
            isOnline: isOnline,
            isProtected: false
          });
        });
      });

      if (elCountAdminAllUsers) elCountAdminAllUsers.textContent = allPlatformUsers.length;

      if (allPlatformUsers.length === 0) {
        adminAllUsersTbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
              No platform users found. Use the form above to add a user.
            </td>
          </tr>
        `;
      } else {
        adminAllUsersTbody.innerHTML = allPlatformUsers.map(u => `
          <tr>
            <td style="font-weight: 700; color: #fff;">
              ${u.fullName}
              ${State.currentUser && State.currentUser.username && State.currentUser.username.toLowerCase() === u.username.toLowerCase() ? '<span class="assigned-status-badge" style="font-size: 0.68rem; margin-left: 0.35rem; padding: 0.15rem 0.45rem;">You</span>' : ''}
            </td>
            <td class="mono" style="color: var(--neon-cyan);">${u.username}</td>
            <td style="color: #cbd5e1; font-weight: 500;">${u.teamName}</td>
            <td><span class="role-badge">${u.role}</span></td>
            <td>
              ${u.isOnline 
                ? '<span style="color: var(--neon-emerald); font-size: 0.76rem; font-family: var(--font-mono); display: inline-flex; align-items: center; gap: 0.35rem;"><span class="status-online-dot"></span> Logged In</span>'
                : '<span style="color: var(--text-muted); font-size: 0.76rem; font-family: var(--font-mono); display: inline-flex; align-items: center; gap: 0.35rem;"><span class="status-offline-dot"></span> Pending</span>'
              }
            </td>
            <td>
              ${u.isProtected 
                ? '<span style="font-size: 0.72rem; color: #fbbf24; font-family: var(--font-mono); background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.25); padding: 0.2rem 0.5rem; border-radius: 4px;">👑 Root Admin</span>'
                : `<button class="btn btn-danger-outline btn-sm" onclick="deletePlatformUser('${u.username}', '${u.teamName}', '${u.role}')" title="Delete User">✕ Delete</button>`
              }
            </td>
          </tr>
        `).join('');
      }
    }
  }

  // Populate Modal Admin Tables as well
  const attendanceTbody = document.getElementById('adminAttendanceTbody');
  const selectionTbody = document.getElementById('adminSelectionTbody');
  const submissionTbody = document.getElementById('adminSubmissionTbody');

  if (attendanceTbody) {
    attendanceTbody.innerHTML = State.attendanceLog.length === 0
      ? `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No attendance logged yet.</td></tr>`
      : State.attendanceLog.map(row => `
          <tr>
            <td class="mono" style="color: var(--neon-cyan);">${row.username}</td>
            <td style="font-weight: 600; color: #fff;">${row.teamName}</td>
            <td>${row.fullName || '-'}</td>
            <td class="mono" style="font-size: 0.78rem;">${row.timestamp}</td>
          </tr>
        `).join('');
  }

  if (selectionTbody) {
    const selections = Object.entries(State.teamSelections);
    selectionTbody.innerHTML = selections.length === 0
      ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No problem statements selected yet.</td></tr>`
      : selections.map(([teamName, data]) => `
          <tr>
            <td style="font-weight: 700; color: #fff;">${teamName}</td>
            <td style="color: var(--neon-cyan);">${data.problemTitle}</td>
            <td class="mono">${data.selectedByName || data.selectedBy}</td>
            <td class="mono" style="font-size: 0.78rem;">${data.timestamp}</td>
            <td>
              ${isSuperAdmin 
                ? `<button class="btn btn-danger-outline btn-sm" onclick="resetTeamSelection('${teamName}')">Reset</button>`
                : `<span style="color: var(--text-muted); font-size: 0.78rem;">Admin Only</span>`
              }
            </td>
          </tr>
        `).join('');
  }

  if (submissionTbody) {
    const submissions = Object.entries(State.teamSubmissions);
    submissionTbody.innerHTML = submissions.length === 0
      ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No submissions recorded yet.</td></tr>`
      : submissions.map(([teamName, sub]) => `
          <tr>
            <td style="font-weight: 700; color: #fff;">${teamName}</td>
            <td style="color: var(--neon-cyan);">${sub.problemTitle}</td>
            <td>
              <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.78rem;">
                ${sub.githubLink ? `<a href="${sub.githubLink}" target="_blank" style="color: #38bdf8; text-decoration: underline;">🐙 GitHub Repo</a>` : ''}
                ${sub.explanationLink ? `<a href="${sub.explanationLink}" target="_blank" style="color: #c084fc; text-decoration: underline;">📄 Drive Doc/Deck</a>` : ''}
                ${sub.videoLink ? `<a href="${sub.videoLink}" target="_blank" style="color: #34d399; text-decoration: underline;">🎥 Demo Video</a>` : ''}
              </div>
            </td>
            <td class="mono">${sub.submittedByName || sub.submittedBy}</td>
            <td class="mono" style="font-size: 0.78rem;">${sub.timestamp}</td>
          </tr>
        `).join('');
  }
}

function switchAdminBlockTab(tabName) {
  document.querySelectorAll('#adminDedicatedBlock .admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('#adminDedicatedBlock .admin-block-panel').forEach(panel => panel.style.display = 'none');

  document.getElementById(`btn-admblock-${tabName}`)?.classList.add('active');
  const panel = document.getElementById(`panel-admblock-${tabName}`);
  if (panel) panel.style.display = 'block';
}

// Download & Export Handlers (Strictly Admin Access)
function exportSubmissionsCSV() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Download access is restricted to Administrator Nareen Karthik only.', 'error');
    return;
  }

  const submissions = Object.entries(State.teamSubmissions);
  if (submissions.length === 0) {
    showToast('No submissions to download yet.', 'info');
    return;
  }

  let csv = 'Team Name,Problem Statement,Problem ID,GitHub Repository Link,Drive Explanation Link,Video Demo Link,Submitted By,Timestamp\n';
  submissions.forEach(([teamName, sub]) => {
    const clean = str => `"${String(str || '').replace(/"/g, '""')}"`;
    csv += `${clean(teamName)},${clean(sub.problemTitle)},${clean(sub.problemId)},${clean(sub.githubLink)},${clean(sub.explanationLink)},${clean(sub.videoLink)},${clean(sub.submittedByName || sub.submittedBy)},${clean(sub.timestamp)}\n`;
  });

  downloadCSVFile(csv, 'shristi_2026_submissions.csv');
  showToast('Participant submissions CSV downloaded successfully.', 'success');
}

function exportTeamRosterCSV() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Download access is restricted to Administrator Nareen Karthik only.', 'error');
    return;
  }

  const registeredTeams = Object.values(State.registeredTeams);
  if (registeredTeams.length === 0) {
    showToast('No registered teams to download yet.', 'info');
    return;
  }

  let csv = 'Team Name,Member Full Name,Username,Role,Login Status,Selected Problem Statement\n';
  registeredTeams.forEach(team => {
    const selection = State.teamSelections[team.teamName];
    const problem = selection ? `PS #${selection.problemId} - ${selection.problemTitle}` : 'None Selected';
    (team.members || []).forEach(m => {
      const isOnline = State.attendanceLog.some(a => a.username.toLowerCase() === m.username.toLowerCase());
      const clean = str => `"${String(str || '').replace(/"/g, '""')}"`;
      csv += `${clean(team.teamName)},${clean(m.fullName)},${clean(m.username)},${clean(m.role)},${clean(isOnline ? 'Logged In' : 'Pending')},${clean(problem)}\n`;
    });
  });

  downloadCSVFile(csv, 'shristi_2026_team_roster.csv');
  showToast('Team roster CSV downloaded successfully.', 'success');
}

function downloadCSVFile(content, fileName) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Coordinator Management Handlers (Admin Authority)
function handleAddCoordinator(e) {
  e.preventDefault();

  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Only Administrator Nareen Karthik has authority to add Coordinators.', 'error');
    return;
  }

  const fullName = document.getElementById('coordFullName').value.trim();
  const username = document.getElementById('coordUsername').value.trim();
  const password = document.getElementById('coordPassword').value.trim();
  const track = document.getElementById('coordTrack').value.trim() || 'Event Coordinator';

  if (!fullName || !username || !password) {
    showToast('Please fill in Coordinator Name, User ID, and Password.', 'error');
    return;
  }

  const cleanUser = username.toLowerCase().replace(/\s+/g, '');
  if (State.coordinators.some(c => c.username.toLowerCase().replace(/\s+/g, '') === cleanUser)) {
    showToast(`Coordinator with User ID "${username}" already exists.`, 'error');
    return;
  }

  const newCoordinator = {
    fullName: fullName,
    username: username,
    password: password,
    track: track,
    role: 'Coordinator',
    addedAt: new Date().toLocaleString()
  };

  State.coordinators.push(newCoordinator);
  localStorage.setItem('shristi_coordinators', JSON.stringify(State.coordinators));

  if (syncChannel) {
    syncChannel.postMessage({
      type: 'COORDINATORS_UPDATED',
      payload: { coordinators: State.coordinators }
    });
  }

  showToast(`Event Coordinator "${fullName}" authorized successfully!`, 'success');
  document.getElementById('addCoordinatorForm').reset();
  renderAdminTables();
}

function revokeCoordinator(username) {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Only Administrator Nareen Karthik can revoke Coordinator access.', 'error');
    return;
  }

  State.coordinators = State.coordinators.filter(c => c.username.toLowerCase() !== username.toLowerCase());
  localStorage.setItem('shristi_coordinators', JSON.stringify(State.coordinators));

  if (syncChannel) {
    syncChannel.postMessage({
      type: 'COORDINATORS_UPDATED',
      payload: { coordinators: State.coordinators }
    });
  }

  showToast(`Coordinator access revoked for ${username}.`, 'info');
  renderAdminTables();
}

// Admin Block: Dynamic Teammate Rows for User Provisioning
function addAdminTeammateRow() {
  const container = document.getElementById('adminTeammatesContainer');
  if (!container) return;

  const currentCount = container.querySelectorAll('.admin-teammate-row').length;
  if (currentCount >= 5) {
    showToast('Maximum 5 additional teammates per submission.', 'info');
    return;
  }

  const row = document.createElement('div');
  row.className = 'admin-teammate-row';
  row.style.cssText = 'display: grid; grid-template-columns: 1.2fr 1fr 1fr auto; gap: 0.5rem; align-items: center;';
  row.innerHTML = `
    <input type="text" class="form-input admin-extra-name" placeholder="Teammate Full Name" required />
    <input type="text" class="form-input admin-extra-user" placeholder="Username (e.g. member.name)" required />
    <input type="text" class="form-input admin-extra-role" placeholder="Role (e.g. Developer)" value="Developer" required />
    <button type="button" class="btn btn-outline btn-sm" style="color: var(--neon-rose); border-color: rgba(244, 63, 94, 0.3); padding: 0.45rem 0.6rem;" onclick="removeAdminTeammateRow(this)" title="Remove">✕</button>
  `;
  container.appendChild(row);
}

function removeAdminTeammateRow(btn) {
  const row = btn.closest('.admin-teammate-row');
  if (row) row.remove();
}

// Admin Block: Provision User & Save to Platform
function handleAdminAddUser(e) {
  e.preventDefault();

  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Only Administrator Nareen Karthik can provision new users.', 'error');
    return;
  }

  const fullName = document.getElementById('adminNewUserFullName').value.trim();
  const username = document.getElementById('adminNewUserUsername').value.trim();
  const password = document.getElementById('adminNewUserPassword').value.trim();
  const teamName = document.getElementById('adminNewUserTeamName').value.trim();
  const role = document.getElementById('adminNewUserRole').value;

  if (!fullName || !username || !password || !teamName) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  const cleanUser = username.toLowerCase().replace(/\s+/g, '');

  // Check if username already exists in any role
  const adminExists = PRELOADED_USERS.some(u => u.username.toLowerCase().replace(/\s+/g, '') === cleanUser);
  const coordExists = (State.coordinators || []).some(c => c.username.toLowerCase().replace(/\s+/g, '') === cleanUser);
  let participantExists = false;

  for (const t of Object.values(State.registeredTeams || {})) {
    if (t.leadUsername && t.leadUsername.toLowerCase().replace(/\s+/g, '') === cleanUser) {
      participantExists = true;
      break;
    }
    if (t.members && t.members.some(m => m.username && m.username.toLowerCase().replace(/\s+/g, '') === cleanUser)) {
      participantExists = true;
      break;
    }
  }

  if (adminExists || coordExists || participantExists) {
    showToast(`Username "${username}" is already in use. Please choose another username.`, 'error');
    return;
  }

  // Handle Coordinator addition
  if (role === 'Coordinator') {
    const newCoord = {
      fullName: fullName,
      username: username,
      password: password,
      track: teamName || 'Event Coordinator',
      role: 'Coordinator',
      addedAt: new Date().toLocaleString()
    };
    State.coordinators.push(newCoord);
    localStorage.setItem('shristi_coordinators', JSON.stringify(State.coordinators));

    if (syncChannel) {
      syncChannel.postMessage({
        type: 'COORDINATORS_UPDATED',
        payload: { coordinators: State.coordinators }
      });
    }

    showToast(`Coordinator "${fullName}" (@${username}) added successfully!`, 'success');
  } else if (role === 'SuperAdmin') {
    // Add SuperAdmin
    PRELOADED_USERS.push({
      username: username,
      password: password,
      fullName: fullName,
      teamName: teamName || 'Admin Operations',
      role: 'SuperAdmin'
    });
    showToast(`Administrator "${fullName}" (@${username}) created successfully!`, 'success');
  } else {
    // Participant / Team Member / Team Lead addition
    const extraTeammates = [];
    const extraNames = document.querySelectorAll('.admin-extra-name');
    const extraUsers = document.querySelectorAll('.admin-extra-user');
    const extraRoles = document.querySelectorAll('.admin-extra-role');

    extraNames.forEach((inp, idx) => {
      const eName = inp.value.trim();
      const eUser = extraUsers[idx] && extraUsers[idx].value.trim() ? extraUsers[idx].value.trim() : (eName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.' + teamName.toLowerCase().slice(0, 4));
      const eRole = extraRoles[idx] ? extraRoles[idx].value.trim() : 'Developer';
      if (eName) {
        extraTeammates.push({
          fullName: eName,
          username: eUser,
          role: eRole
        });
      }
    });

    if (State.registeredTeams[teamName]) {
      // Team already exists -> Append members to existing team
      const existingTeam = State.registeredTeams[teamName];
      existingTeam.members = existingTeam.members || [];
      existingTeam.members.push({
        fullName: fullName,
        username: username,
        role: role
      });
      extraTeammates.forEach(m => existingTeam.members.push(m));
    } else {
      // New Team -> create new team entry
      const membersList = [
        { fullName, username, role },
        ...extraTeammates
      ];

      State.registeredTeams[teamName] = {
        teamName: teamName,
        leadFullName: role === 'Team Lead' ? fullName : fullName,
        leadUsername: role === 'Team Lead' ? username : username,
        password: password,
        members: membersList,
        registeredAt: new Date().toLocaleString()
      };
    }

    localStorage.setItem('shristi_registered_teams', JSON.stringify(State.registeredTeams));

    if (syncChannel) {
      syncChannel.postMessage({
        type: 'TEAM_REGISTERED',
        payload: { teamName: teamName, registeredTeams: State.registeredTeams }
      });
    }

    pushToGoogleSheets({
      action: 'register_team',
      teamName: teamName,
      members: State.registeredTeams[teamName].members,
      timestamp: new Date().toISOString()
    });

    showToast(`User "${fullName}" (@${username}) added to team "${teamName}"!`, 'success');
  }

  // Clear Form
  document.getElementById('adminAddUserForm').reset();
  const extraContainer = document.getElementById('adminTeammatesContainer');
  if (extraContainer) extraContainer.innerHTML = '';

  renderAdminTables();
}

function deletePlatformUser(username, teamName, role) {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Only Administrator Nareen Karthik can remove users.', 'error');
    return;
  }

  const cleanUser = username.toLowerCase().replace(/\s+/g, '');
  if (PRELOADED_USERS.some(u => u.username.toLowerCase().replace(/\s+/g, '') === cleanUser)) {
    showToast('Root Administrator accounts cannot be deleted.', 'error');
    return;
  }

  if (role === 'Coordinator') {
    State.coordinators = State.coordinators.filter(c => c.username.toLowerCase().replace(/\s+/g, '') !== cleanUser);
    localStorage.setItem('shristi_coordinators', JSON.stringify(State.coordinators));
    if (syncChannel) {
      syncChannel.postMessage({ type: 'COORDINATORS_UPDATED', payload: { coordinators: State.coordinators } });
    }
    showToast(`Coordinator @${username} removed.`, 'info');
  } else {
    // Team member removal
    if (State.registeredTeams[teamName]) {
      const team = State.registeredTeams[teamName];
      team.members = (team.members || []).filter(m => m.username && m.username.toLowerCase().replace(/\s+/g, '') !== cleanUser);

      // If team has no members left, delete the team
      if (team.members.length === 0) {
        delete State.registeredTeams[teamName];
        delete State.teamSelections[teamName];
        delete State.teamSubmissions[teamName];
        localStorage.setItem('shristi_team_selections', JSON.stringify(State.teamSelections));
        localStorage.setItem('shristi_team_submissions', JSON.stringify(State.teamSubmissions));
      }

      localStorage.setItem('shristi_registered_teams', JSON.stringify(State.registeredTeams));
      if (syncChannel) {
        syncChannel.postMessage({ type: 'TEAM_REGISTERED', payload: { teamName: teamName, registeredTeams: State.registeredTeams } });
      }
      showToast(`User @${username} removed from "${teamName}".`, 'info');
    }
  }

  renderAdminTables();
}

// Step 1: Switch between Login and Register Team tabs
function switchStep1Tab(tab) {
  const loginPanel = document.getElementById('step1LoginPanel');
  const registerPanel = document.getElementById('step1RegisterPanel');
  const btnLogin = document.getElementById('btnStep1TabLogin');
  const btnRegister = document.getElementById('btnStep1TabRegister');

  if (tab === 'register') {
    if (loginPanel) loginPanel.style.display = 'none';
    if (registerPanel) registerPanel.style.display = 'block';
    if (btnLogin) btnLogin.classList.remove('active');
    if (btnRegister) btnRegister.classList.add('active');
  } else {
    if (loginPanel) loginPanel.style.display = 'block';
    if (registerPanel) registerPanel.style.display = 'none';
    if (btnLogin) btnLogin.classList.add('active');
    if (btnRegister) btnRegister.classList.remove('active');
  }
}

// Step 1: Teammates Dynamic Row Adder / Remover
function addTeammateRow() {
  const container = document.getElementById('teammatesFieldsContainer');
  if (!container) return;

  const currentRows = container.querySelectorAll('.teammate-row').length;
  const memberIndex = currentRows + 2; // +1 lead, +1 next index

  if (memberIndex > 6) {
    showToast('Maximum 6 members allowed per team.', 'info');
    return;
  }

  const row = document.createElement('div');
  row.className = 'teammate-row';
  row.style.cssText = 'display: grid; grid-template-columns: 1.2fr 1fr auto; gap: 0.5rem; align-items: center;';
  row.innerHTML = `
    <input type="text" class="form-input teammate-name-input" placeholder="Teammate ${memberIndex} Name" required />
    <input type="text" class="form-input teammate-role-input" placeholder="Role (e.g. Developer)" value="Developer" required />
    <button type="button" class="btn btn-outline btn-sm" style="color: var(--neon-rose); border-color: rgba(244, 63, 94, 0.3); padding: 0.5rem;" onclick="removeTeammateRow(this)" title="Remove">✕</button>
  `;
  container.appendChild(row);
}

function removeTeammateRow(btn) {
  const row = btn.closest('.teammate-row');
  if (row) {
    row.remove();
  }
}

// Step 1: Handle Team & Teammates Registration
function handleTeamRegistration(e) {
  e.preventDefault();

  const teamName = document.getElementById('regTeamName').value.trim();
  const leadFullName = document.getElementById('regLeadFullName').value.trim();
  const leadUsername = document.getElementById('regLeadUsername').value.trim();
  const password = document.getElementById('regTeamPassword').value.trim();

  if (!teamName || !leadFullName || !leadUsername || !password) {
    showToast('Please fill in all required team details.', 'error');
    return;
  }

  if (State.registeredTeams[teamName]) {
    showToast(`Team name "${teamName}" is already registered. Choose another name.`, 'error');
    return;
  }

  const cleanLead = leadUsername.toLowerCase().replace(/\s+/g, '');
  if (cleanLead === 'nareenkarthik' || cleanLead === 'nareen' || cleanLead === 'admin') {
    showToast('This username is reserved for Administrator.', 'error');
    return;
  }

  const teammates = [];
  // Add Lead as first member
  teammates.push({
    fullName: leadFullName,
    username: leadUsername,
    role: 'Team Lead'
  });

  // Extract other teammates from dynamic inputs
  const nameInputs = document.querySelectorAll('.teammate-name-input');
  const roleInputs = document.querySelectorAll('.teammate-role-input');

  nameInputs.forEach((input, idx) => {
    const tName = input.value.trim();
    const tRole = roleInputs[idx] ? roleInputs[idx].value.trim() : 'Developer';
    if (tName) {
      const cleanMember = tName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const tUser = cleanMember + '.' + teamName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
      teammates.push({
        fullName: tName,
        username: tUser,
        role: tRole || 'Developer'
      });
    }
  });

  const newTeam = {
    teamName: teamName,
    leadFullName: leadFullName,
    leadUsername: leadUsername,
    password: password,
    members: teammates,
    registeredAt: new Date().toLocaleString()
  };

  State.registeredTeams[teamName] = newTeam;
  localStorage.setItem('shristi_registered_teams', JSON.stringify(State.registeredTeams));

  if (syncChannel) {
    syncChannel.postMessage({
      type: 'TEAM_REGISTERED',
      payload: { teamName: teamName, registeredTeams: State.registeredTeams }
    });
  }

  // Push to Google Sheets Sheet 1
  pushToGoogleSheets({
    action: 'register_team',
    teamName: teamName,
    members: teammates,
    timestamp: new Date().toISOString()
  });

  // Register in MongoDB User Database
  if (typeof MongoAPI !== 'undefined' && MongoAPI.isOnline) {
    MongoAPI.registerTeam({
      teamName: teamName,
      leadFullName: leadFullName,
      leadUsername: leadUsername,
      password: password,
      members: teammates
    }).then(res => {
      if (res && res.success) {
        MongoAPI.checkStatus();
      }
    }).catch(err => console.warn('Mongo register error:', err));
  }

  showToast(`Team "${teamName}" registered with ${teammates.length} members!`, 'success');

  // Automatically log in as the newly registered Team Lead
  loginUser({
    username: leadUsername,
    fullName: leadFullName,
    teamName: teamName,
    role: 'Team Lead'
  }, true);
}

async function initFreshGoogleSheets() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Only Administrator Nareen Karthik can initialize sheets.', 'error');
    return;
  }
  showToast('Initializing fresh sheets structure in Google Sheets...', 'info');
  await pushToGoogleSheets({ 
    action: 'init_fresh_sheet', 
    timestamp: new Date().toISOString() 
  });
  showToast('Fresh Google Sheets successfully initialized with styled headers!', 'success');
}


// Modal Handlers
function openModal(modalId) {
  if (modalId === 'adminModal') {
    if (!State.currentUser || (State.currentUser.role !== 'SuperAdmin' && State.currentUser.role !== 'Coordinator')) {
      showToast('Access Denied: Admin console is restricted to organizers. Please log in as Admin.', 'error');
      openModal('loginModal');
      return;
    }
  }

  const modal = document.getElementById(modalId);
  if (modal) {
    if (modalId === 'adminModal') {
      renderAdminTables();
      const isSuperAdmin = State.currentUser && State.currentUser.role === 'SuperAdmin';
      const mongoBtn = document.getElementById('btn-admin-mongo');
      if (mongoBtn) mongoBtn.style.display = isSuperAdmin ? 'inline-block' : 'none';
      if (!isSuperAdmin) {
        switchAdminTab('attendance');
      }
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function openMongoAdminPanel() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Access Denied: MongoDB database controls are strictly restricted to SuperAdmin (Nareen Karthik) only.', 'error');
    openModal('loginModal');
    return;
  }
  openModal('adminModal');
  switchAdminTab('mongo');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `
    <span style="font-weight: 800; font-size: 1.1rem; color: ${type === 'success' ? 'var(--neon-emerald)' : type === 'error' ? 'var(--neon-rose)' : 'var(--neon-cyan)'}">${icon}</span>
    <span style="font-size: 0.88rem; line-height: 1.4;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Search and Filter Handling
function setFilter(filterTag, element) {
  State.activeFilter = filterTag;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (element) element.classList.add('active');
  renderProblemCards();
}

function clearFilters() {
  State.activeFilter = 'all';
  State.searchQuery = '';
  const searchInput = document.getElementById('problemSearchInput');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.filter-chip[data-filter="all"]')?.classList.add('active');
  renderProblemCards();
}

// Event Listeners Setup
function setupEventListeners() {
  const searchInput = document.getElementById('problemSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      State.searchQuery = e.target.value.trim();
      renderProblemCards();
    });
  }

  // Login form handling for Step 1 Login Form and Modal Login Form
  const handleAuthSubmit = async (usernameInput, passwordInput) => {
    const cleanInput = usernameInput.toLowerCase().replace(/\s+/g, '');
    let user = null;

    // 0. Primary Check: Authenticate against MongoDB Database via API
    if (typeof MongoAPI !== 'undefined' && MongoAPI.isOnline) {
      try {
        const mongoRes = await MongoAPI.login(usernameInput, passwordInput);
        if (mongoRes && mongoRes.success && mongoRes.user) {
          loginUser(mongoRes.user, true);
          closeModal('loginModal');
          showToast(`Authenticated via MongoDB database (${mongoRes.user.role})!`, 'success');
          return;
        }
      } catch (err) {
        console.warn('MongoDB login fallback to local cache:', err);
      }
    }

    // 1. Primary Administrator Check
    user = PRELOADED_USERS.find(u => {
      const matchUser = u.username.toLowerCase().replace(/\s+/g, '') === cleanInput ||
                        (u.fullName && u.fullName.toLowerCase().replace(/\s+/g, '') === cleanInput);
      const matchPass = u.password === passwordInput;
      return matchUser && matchPass;
    });

    // 2. Event Coordinators Check
    if (!user && State.coordinators) {
      const coord = State.coordinators.find(c => {
        const matchUser = c.username.toLowerCase().replace(/\s+/g, '') === cleanInput ||
                          (c.fullName && c.fullName.toLowerCase().replace(/\s+/g, '') === cleanInput);
        const matchPass = c.password === passwordInput;
        return matchUser && matchPass;
      });
      if (coord) {
        user = {
          username: coord.username,
          fullName: coord.fullName,
          teamName: coord.track || 'Event Coordinator',
          role: 'Coordinator'
        };
      }
    }

    // 3. Registered Participant Teams & Members Check
    if (!user && State.registeredTeams) {
      for (const team of Object.values(State.registeredTeams)) {
        if (team.password === passwordInput) {
          // Check Team Lead
          const leadMatch = (team.leadUsername && team.leadUsername.toLowerCase().replace(/\s+/g, '') === cleanInput) ||
                            (team.leadFullName && team.leadFullName.toLowerCase().replace(/\s+/g, '') === cleanInput) ||
                            (team.teamName && team.teamName.toLowerCase().replace(/\s+/g, '') === cleanInput);
          if (leadMatch) {
            user = {
              username: team.leadUsername,
              fullName: team.leadFullName,
              teamName: team.teamName,
              role: 'Team Lead'
            };
            break;
          }

          // Check Teammates
          if (team.members && Array.isArray(team.members)) {
            const memberMatch = team.members.find(m => 
              (m.username && m.username.toLowerCase().replace(/\s+/g, '') === cleanInput) ||
              (m.fullName && m.fullName.toLowerCase().replace(/\s+/g, '') === cleanInput)
            );
            if (memberMatch) {
              user = {
                username: memberMatch.username,
                fullName: memberMatch.fullName,
                teamName: team.teamName,
                role: memberMatch.role || 'Team Member'
              };
              break;
            }
          }
        }
      }
    }

    if (user) {
      loginUser(user, true);
      closeModal('loginModal');
    } else {
      showToast('Invalid credentials. Check user ID / team name and password.', 'error');
    }
  };

  const firstStepForm = document.getElementById('firstStepLoginForm');
  if (firstStepForm) {
    firstStepForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('firstStepUsername').value.trim();
      const passwordInput = document.getElementById('firstStepPassword').value.trim();
      await handleAuthSubmit(usernameInput, passwordInput);
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('loginUsername').value.trim();
      const passwordInput = document.getElementById('loginPassword').value.trim();
      await handleAuthSubmit(usernameInput, passwordInput);
    });
  }

  // Register Team form handling
  const registerTeamForm = document.getElementById('registerTeamForm');
  if (registerTeamForm) {
    registerTeamForm.addEventListener('submit', handleTeamRegistration);
  }

  // Add Coordinator form handling
  const addCoordinatorForm = document.getElementById('addCoordinatorForm');
  if (addCoordinatorForm) {
    addCoordinatorForm.addEventListener('submit', handleAddCoordinator);
  }

  // Admin Add User form handling
  const adminAddUserForm = document.getElementById('adminAddUserForm');
  if (adminAddUserForm) {
    adminAddUserForm.addEventListener('submit', handleAdminAddUser);
  }

  // Webhook configuration save
  const webhookInput = document.getElementById('sheetsWebhookUrlInput');
  if (webhookInput) {
    webhookInput.value = State.webhookUrl;
    webhookInput.addEventListener('change', (e) => {
      State.webhookUrl = e.target.value.trim();
      localStorage.setItem('shristi_webhook_url', State.webhookUrl);
      showToast('Google Apps Script Webhook URL updated.', 'success');
    });
  }

  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });
}

function quickLogin(username) {
  const user = PRELOADED_USERS.find(u => u.username === username);
  if (user) {
    loginUser(user, true);
  }
}

// Switch admin tabs
function switchAdminTab(tabName) {
  if (tabName === 'mongo') {
    if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
      showToast('Access Denied: MongoDB database controls are strictly restricted to SuperAdmin (Nareen Karthik) only.', 'error');
      return;
    }
  }

  document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.admin-tab-panel').forEach(panel => panel.style.display = 'none');

  document.getElementById(`btn-admin-${tabName}`)?.classList.add('active');
  const panel = document.getElementById(`panel-admin-${tabName}`);
  if (panel) panel.style.display = 'block';

  if (tabName === 'mongo') {
    fetchMongoUsers();
    MongoAPI.checkStatus();
  }
}

// ==================== MONGODB USER DATABASE API CLIENT ====================
const MongoAPI = {
  // Use current host or default to port 5000 where server.js runs
  baseUrl: (window.location.protocol.startsWith('http') && window.location.port !== '8000')
    ? window.location.origin
    : 'http://localhost:5000',
  isOnline: false,
  dbStatus: null,

  async parseResponse(res) {
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      if (!res.ok) {
        return {
          success: false,
          status: res.status,
          message: `Server returned HTTP ${res.status}. If deployed on Vercel, please provide a MongoDB Atlas Cloud URI.`
        };
      }
      return {
        success: false,
        message: 'Non-JSON server response: ' + (text.length > 80 ? text.slice(0, 80) + '...' : text)
      };
    }
    if (!res.ok && data && !data.message) {
      data.message = `Request failed with status ${res.status}`;
    }
    return data;
  },

  async checkStatus() {
    try {
      const res = await fetch(`${this.baseUrl}/api/status`, { cache: 'no-store' });
      const data = await this.parseResponse(res);
      if (data && data.database) {
        this.isOnline = true;
        this.dbStatus = data.database;
        this.updateStatusBadge(true, data.database);
        return data.database;
      }
      throw new Error(data?.message || 'Status check failed');
    } catch (e) {
      this.isOnline = false;
      this.dbStatus = null;
      this.updateStatusBadge(false);
      return null;
    }
  },

  updateStatusBadge(isOnline, db) {
    const pill = document.getElementById('mongoStatusPill');
    const text = document.getElementById('mongoStatusText');
    const statStatus = document.getElementById('mongoStatStatus');
    const statDb = document.getElementById('mongoStatDb');
    const statUsers = document.getElementById('mongoStatUsers');
    const statTeams = document.getElementById('mongoStatTeams');

    // Strictly show MongoDB status pill to SuperAdmin only
    const isSuperAdmin = State.currentUser && State.currentUser.role === 'SuperAdmin';
    if (pill) {
      pill.style.display = isSuperAdmin ? 'inline-flex' : 'none';
    }

    if (!pill || !text) return;

    if (isOnline && db && db.isConnected) {
      pill.classList.remove('offline');
      const userCount = db.counts ? db.counts.users : 0;
      pill.title = `MongoDB Connected: ${db.dbName || 'shristi_hackathon'} (${userCount} users stored)`;
      text.textContent = `MongoDB: Connected (${userCount} users)`;

      if (statStatus) {
        statStatus.textContent = 'Connected (Active)';
        statStatus.style.color = 'var(--neon-emerald)';
      }
      if (statDb) statDb.textContent = db.dbName || 'shristi_hackathon';
      if (statUsers) statUsers.textContent = userCount;
      if (statTeams) statTeams.textContent = db.counts ? db.counts.teams : 0;
    } else {
      pill.classList.add('offline');
      pill.title = 'MongoDB Server: Standby / Local Mode (Click to configure)';
      text.textContent = 'MongoDB: Standby / Local';

      if (statStatus) {
        statStatus.textContent = 'Standby (Local)';
        statStatus.style.color = 'var(--neon-rose)';
      }
    }
  },

  async login(username, password) {
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return await this.parseResponse(res);
    } catch (err) {
      return { success: false, offline: true, message: err.message };
    }
  },

  async getUsers() {
    try {
      const res = await fetch(`${this.baseUrl}/api/users`, { cache: 'no-store' });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, users: [] };
    }
  },

  async deleteUser(id) {
    try {
      const res = await fetch(`${this.baseUrl}/api/users/${id}`, { method: 'DELETE' });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  async createUser(userData) {
    try {
      const res = await fetch(`${this.baseUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  async registerTeam(teamData) {
    try {
      const res = await fetch(`${this.baseUrl}/api/teams/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  async saveProblemSelection(data) {
    try {
      const res = await fetch(`${this.baseUrl}/api/teams/select-problem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  async saveSubmission(data) {
    try {
      const res = await fetch(`${this.baseUrl}/api/teams/submission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  async recordAttendance(record) {
    try {
      const res = await fetch(`${this.baseUrl}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  async seed() {
    try {
      const res = await fetch(`${this.baseUrl}/api/seed`, { method: 'POST' });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  async connect(uri) {
    try {
      const res = await fetch(`${this.baseUrl}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri })
      });
      return await this.parseResponse(res);
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
};

// Render users in MongoDB User Explorer
async function fetchMongoUsers() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    return;
  }

  const tbody = document.getElementById('mongoUsersTbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; color: var(--neon-cyan); padding: 1.5rem;">
        ⚡ Fetching user records from MongoDB...
      </td>
    </tr>
  `;

  const data = await MongoAPI.getUsers();
  if (!data || !data.success || !data.users || data.users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.75rem;">
          No users found in MongoDB yet. Click <strong style="color: var(--neon-cyan); cursor: pointer;" onclick="seedMongoDatabase()">"⚡ Seed Users"</strong> to populate initial admins, coordinators & teams.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.users.map(u => {
    const roleClass = u.role === 'SuperAdmin' ? 'db-tag-admin' :
                      u.role === 'Coordinator' ? 'db-tag-coord' :
                      u.role === 'Team Lead' ? 'db-tag-lead' : 'db-tag-member';
    const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleString() : 'Preloaded';

    return `
      <tr>
        <td><strong style="color: #fff; font-family: var(--font-mono);">${escapeHtml(u.username)}</strong></td>
        <td>${escapeHtml(u.fullName || '')}</td>
        <td><span class="db-tag ${roleClass}">${escapeHtml(u.role || 'Participant')}</span></td>
        <td>${escapeHtml(u.teamName || 'Unassigned')}</td>
        <td style="font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-muted);">${dateStr}</td>
        <td>
          <button type="button" class="btn btn-outline btn-sm" style="color: var(--neon-rose); border-color: rgba(244, 63, 94, 0.3); padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="deleteMongoUser('${u._id}', '${escapeHtml(u.username)}')" title="Delete from MongoDB">
            ✕ Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function seedMongoDatabase() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Access Denied: SuperAdmin privileges required to seed MongoDB.', 'error');
    return;
  }

  showToast('Seeding MongoDB database with preloaded accounts...', 'info');
  const res = await MongoAPI.seed();
  if (res && res.success) {
    showToast(res.message, 'success');
    MongoAPI.checkStatus();
    fetchMongoUsers();
  } else {
    showToast(res?.message || 'Failed to seed MongoDB. Is database connected?', 'error');
  }
}

async function connectMongoDatabase() {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Access Denied: Only SuperAdmin (Nareen Karthik) can connect or modify MongoDB.', 'error');
    return;
  }

  const uriInput = document.getElementById('mongoUriInput');
  const uri = uriInput ? uriInput.value.trim() : '';
  if (!uri) {
    showToast('Please enter a MongoDB connection URI.', 'error');
    return;
  }

  // Check if running on cloud / Vercel host and user entered localhost / 127.0.0.1
  const isCloudHost = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const isLocalUri = uri.includes('127.0.0.1') || uri.includes('localhost');

  if (isCloudHost && isLocalUri) {
    showToast('Cloud Notice: 127.0.0.1 cannot be reached from hosted Vercel servers. Please enter a MongoDB Atlas Cloud URI (mongodb+srv://...) or run locally using "node server.js".', 'error');
    return;
  }

  showToast('Connecting to MongoDB...', 'info');
  const res = await MongoAPI.connect(uri);
  if (res && res.success) {
    showToast('Successfully connected to MongoDB!', 'success');
    MongoAPI.checkStatus();
    fetchMongoUsers();
  } else {
    showToast('MongoDB connection failed: ' + (res?.message || 'Check connection / URI'), 'error');
  }
}

async function deleteMongoUser(id, username) {
  if (!State.currentUser || State.currentUser.role !== 'SuperAdmin') {
    showToast('Access Denied: SuperAdmin privileges required to delete MongoDB users.', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to delete user "@${username}" from MongoDB?`)) return;
  const res = await MongoAPI.deleteUser(id);
  if (res && res.success) {
    showToast(`User @${username} removed from MongoDB.`, 'success');
    fetchMongoUsers();
    MongoAPI.checkStatus();
  } else {
    showToast('Failed to delete user: ' + (res?.message || 'Error'), 'error');
  }
}

function initMongoSync() {
  MongoAPI.checkStatus().then(status => {
    if (status && status.isConnected) {
      console.log('MongoDB User Database is Connected and Active.');
    } else {
      console.info('MongoDB running in offline/standby mode.');
    }
  });

  // Periodically check MongoDB status
  setInterval(() => {
    MongoAPI.checkStatus();
  }, 15000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

