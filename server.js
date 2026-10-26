require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, getDBStatus, mongoose } = require('./db');
const User = require('./models/User');
const Team = require('./models/Team');
const Attendance = require('./models/Attendance');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Auto-seed initial users if DB is empty on connection
async function autoSeedIfEmpty() {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('\x1b[33mℹ Database empty. Auto-seeding initial users...\x1b[0m');
      const { INITIAL_USERS, INITIAL_TEAMS } = require('./seed');
      
      for (const u of INITIAL_USERS) {
        await User.create({
          username: u.username.toLowerCase().trim(),
          password: u.password,
          fullName: u.fullName,
          role: u.role,
          teamName: u.teamName,
          track: u.track
        });
      }

      for (const t of INITIAL_TEAMS) {
        await Team.create({
          teamName: t.teamName.trim(),
          leadFullName: t.leadFullName,
          leadUsername: t.leadUsername.toLowerCase().trim(),
          password: t.password,
          members: t.members
        });

        // Seed lead
        await User.create({
          username: t.leadUsername.toLowerCase().trim(),
          password: t.password,
          fullName: t.leadFullName,
          role: 'Team Lead',
          teamName: t.teamName.trim(),
          track: 'Participant Track'
        });

        // Seed members
        for (const m of t.members) {
          await User.create({
            username: m.username.toLowerCase().trim(),
            password: t.password,
            fullName: m.fullName,
            role: 'Team Member',
            teamName: t.teamName.trim(),
            track: 'Participant Track'
          });
        }
      }
      console.log('\x1b[32m✔ Auto-seeded default users into MongoDB!\x1b[0m');
    }
  } catch (e) {
    console.warn('Auto-seed check failed:', e.message);
  }
}

// Connect to MongoDB
connectDB().then((res) => {
  if (res.success) {
    autoSeedIfEmpty();
  }
});

// URL normalization for Vercel Serverless Function invocations
app.use((req, res, next) => {
  if (req.query && req.query.match) {
    req.url = '/api/' + req.query.match.replace(/^\/+/, '');
  } else if (req.query && req.query['...path']) {
    req.url = '/api/' + req.query['...path'].replace(/^\/+/, '');
  } else if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// ==================== REST API ROUTES ====================

// 1. Health & Database Status
app.get('/api/status', async (req, res) => {
  const dbStatus = getDBStatus();
  let counts = { users: 0, teams: 0, attendance: 0 };

  if (dbStatus.isConnected) {
    try {
      counts.users = await User.countDocuments();
      counts.teams = await Team.countDocuments();
      counts.attendance = await Attendance.countDocuments();
    } catch (e) {
      // ignore count query errors
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      ...dbStatus,
      counts
    }
  });
});

// 2. Dynamic MongoDB URI Test / Reconnect
app.post('/api/connect', async (req, res) => {
  const { uri } = req.body;
  if (!uri) {
    return res.status(400).json({ success: false, message: 'MongoDB URI is required' });
  }

  // If on Vercel, loopback IP (127.0.0.1 / localhost) points to AWS Lambda container, not user machine
  if (process.env.VERCEL && (uri.includes('127.0.0.1') || uri.includes('localhost'))) {
    return res.status(400).json({
      success: false,
      message: 'Cannot connect to 127.0.0.1 / localhost from Vercel cloud environment. Please provide a MongoDB Atlas Cloud URI (e.g. mongodb+srv://<username>:<password>@cluster.mongodb.net/shristi_hackathon).'
    });
  }

  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const result = await connectDB(uri);
    if (result.success) {
      await autoSeedIfEmpty();
      res.json({ success: true, message: 'Connected to MongoDB', details: result });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Middleware to verify database connectivity
function requireDB(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      dbConnected: false,
      message: 'MongoDB is currently in standby or disconnected. Connect your local mongod or MongoDB Atlas URI in the Admin Dashboard.'
    });
  }
  next();
}

// 3. User Authentication (Login)
app.post('/api/auth/login', requireDB, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  const cleanUser = username.toLowerCase().replace(/\s+/g, '');

  try {
    // A. Check in MongoDB User collection
    const allUsers = await User.find({ status: 'active' });
    let matchedUser = allUsers.find(u => {
      const matchUser = u.username.toLowerCase().replace(/\s+/g, '') === cleanUser ||
                        (u.fullName && u.fullName.toLowerCase().replace(/\s+/g, '') === cleanUser);
      return matchUser && u.comparePassword(password);
    });

    if (matchedUser) {
      matchedUser.lastLogin = new Date();
      await matchedUser.save();

      return res.json({
        success: true,
        user: {
          id: matchedUser._id,
          username: matchedUser.username,
          fullName: matchedUser.fullName,
          role: matchedUser.role,
          teamName: matchedUser.teamName,
          track: matchedUser.track
        }
      });
    }

    // B. Check in MongoDB Team collection (for Teams and Teammates)
    const teams = await Team.find();
    for (const team of teams) {
      if (team.password === password) {
        // Check Team Lead
        const leadMatch = (team.leadUsername && team.leadUsername.toLowerCase().replace(/\s+/g, '') === cleanUser) ||
                          (team.leadFullName && team.leadFullName.toLowerCase().replace(/\s+/g, '') === cleanUser) ||
                          (team.teamName && team.teamName.toLowerCase().replace(/\s+/g, '') === cleanUser);
        if (leadMatch) {
          return res.json({
            success: true,
            user: {
              username: team.leadUsername,
              fullName: team.leadFullName,
              teamName: team.teamName,
              role: 'Team Lead'
            }
          });
        }

        // Check Members
        if (team.members && Array.isArray(team.members)) {
          const memberMatch = team.members.find(m =>
            (m.username && m.username.toLowerCase().replace(/\s+/g, '') === cleanUser) ||
            (m.fullName && m.fullName.toLowerCase().replace(/\s+/g, '') === cleanUser)
          );
          if (memberMatch) {
            return res.json({
              success: true,
              user: {
                username: memberMatch.username,
                fullName: memberMatch.fullName,
                teamName: team.teamName,
                role: memberMatch.role || 'Team Member'
              }
            });
          }
        }
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. User not found in MongoDB database or password incorrect.'
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
  }
});

// 4. Get All Users (User Database Explorer)
app.get('/api/users', requireDB, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Create New User (Admin or Coordinator)
app.post('/api/users', requireDB, async (req, res) => {
  const { username, password, fullName, role, teamName, track } = req.body;

  if (!username || !password || !fullName) {
    return res.status(400).json({ success: false, message: 'Username, password, and full name are required' });
  }

  const cleanUser = username.toLowerCase().trim();

  try {
    const existing = await User.findOne({ username: cleanUser });
    if (existing) {
      return res.status(409).json({ success: false, message: `Username "${username}" already exists in MongoDB database.` });
    }

    const newUser = await User.create({
      username: cleanUser,
      password,
      fullName: fullName.trim(),
      role: role || 'Participant',
      teamName: teamName || 'General',
      track: track || 'General'
    });

    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Delete User
app.delete('/api/users/:id', requireDB, async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted from MongoDB', user: deleted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Register Team & Teammates directly into MongoDB
app.post('/api/teams/register', requireDB, async (req, res) => {
  const { teamName, leadFullName, leadUsername, password, members } = req.body;

  if (!teamName || !leadFullName || !leadUsername || !password) {
    return res.status(400).json({ success: false, message: 'Missing required team fields' });
  }

  const cleanTeam = teamName.trim();
  const cleanLeadUser = leadUsername.toLowerCase().trim();

  try {
    // Check if team name already exists
    const existingTeam = await Team.findOne({ teamName: new RegExp(`^${cleanTeam}$`, 'i') });
    if (existingTeam) {
      return res.status(409).json({ success: false, message: `Team "${teamName}" is already registered.` });
    }

    // Check if lead username exists
    const existingLeadUser = await User.findOne({ username: cleanLeadUser });
    if (existingLeadUser) {
      return res.status(409).json({ success: false, message: `Username "${leadUsername}" is already taken.` });
    }

    // Create Team in MongoDB
    const newTeam = await Team.create({
      teamName: cleanTeam,
      leadFullName: leadFullName.trim(),
      leadUsername: cleanLeadUser,
      password,
      members: members || []
    });

    // Create User record for Team Lead
    await User.create({
      username: cleanLeadUser,
      password,
      fullName: leadFullName.trim(),
      role: 'Team Lead',
      teamName: cleanTeam,
      track: 'Participant Track'
    });

    // Create User records for all teammates
    if (members && Array.isArray(members)) {
      for (const m of members) {
        if (m.username) {
          const mUser = m.username.toLowerCase().trim();
          const exists = await User.findOne({ username: mUser });
          if (!exists) {
            await User.create({
              username: mUser,
              password,
              fullName: m.fullName ? m.fullName.trim() : mUser,
              role: m.role || 'Team Member',
              teamName: cleanTeam,
              track: 'Participant Track'
            });
          }
        }
      }
    }

    res.status(201).json({ success: true, team: newTeam });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Get All Teams
app.get('/api/teams', requireDB, async (req, res) => {
  try {
    const teams = await Team.find().sort({ createdAt: -1 });
    res.json({ success: true, count: teams.length, teams });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. Select Problem Statement
app.post('/api/teams/select-problem', requireDB, async (req, res) => {
  const { teamName, problemId, problemTitle, selectedBy } = req.body;

  if (!teamName || !problemId) {
    return res.status(400).json({ success: false, message: 'Team name and problem ID are required' });
  }

  try {
    let team = await Team.findOne({ teamName: new RegExp(`^${teamName.trim()}$`, 'i') });
    if (!team) {
      team = await Team.create({
        teamName: teamName.trim(),
        leadFullName: selectedBy || 'Team Lead',
        leadUsername: (selectedBy || 'lead').toLowerCase().replace(/\s+/g, ''),
        password: 'defaultPassword',
        members: []
      });
    }

    team.selectedProblemId = problemId;
    team.selectedProblemTitle = problemTitle || `Problem #${problemId}`;
    team.selectedBy = selectedBy;
    team.selectionTime = new Date();
    await team.save();

    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. Reset Problem Statement (Admin feature)
app.post('/api/teams/reset-problem', requireDB, async (req, res) => {
  const { teamName } = req.body;
  if (!teamName) {
    return res.status(400).json({ success: false, message: 'Team name required' });
  }

  try {
    const team = await Team.findOne({ teamName: new RegExp(`^${teamName.trim()}$`, 'i') });
    if (team) {
      team.selectedProblemId = null;
      team.selectedProblemTitle = '';
      team.selectedBy = '';
      team.selectionTime = null;
      await team.save();
    }
    res.json({ success: true, message: `Selection reset for ${teamName}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 11. Submit Deliverables
app.post('/api/teams/submission', requireDB, async (req, res) => {
  const { teamName, githubLink, explanationLink, videoLink, submittedBy, notes, simulatedNotes } = req.body;

  if (!teamName) {
    return res.status(400).json({ success: false, message: 'Team name required' });
  }

  try {
    let team = await Team.findOne({ teamName: new RegExp(`^${teamName.trim()}$`, 'i') });
    if (!team) {
      team = await Team.create({
        teamName: teamName.trim(),
        leadFullName: submittedBy || 'Team Lead',
        leadUsername: (submittedBy || 'lead').toLowerCase().replace(/\s+/g, ''),
        password: 'defaultPassword',
        members: []
      });
    }

    team.submission = {
      githubLink: githubLink || '',
      explanationLink: explanationLink || '',
      videoLink: videoLink || '',
      submittedBy: submittedBy || '',
      submittedAt: new Date(),
      notes: notes || '',
      simulatedNotes: simulatedNotes || ''
    };
    await team.save();

    res.json({ success: true, submission: team.submission });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 12. Attendance API
app.get('/api/attendance', requireDB, async (req, res) => {
  try {
    const logs = await Attendance.find().sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, count: logs.length, attendance: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/attendance', requireDB, async (req, res) => {
  const { username, fullName, teamName, deviceInfo } = req.body;

  if (!username || !fullName) {
    return res.status(400).json({ success: false, message: 'Username and fullName are required' });
  }

  try {
    const record = await Attendance.create({
      username: username.toLowerCase().trim(),
      fullName: fullName.trim(),
      teamName: teamName || 'General',
      timestamp: new Date(),
      deviceInfo: deviceInfo || req.headers['user-agent'] || ''
    });

    res.status(201).json({ success: true, record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 13. Trigger Manual Database Seed
app.post('/api/seed', requireDB, async (req, res) => {
  try {
    const { INITIAL_USERS, INITIAL_TEAMS } = require('./seed');
    let usersAdded = 0;
    let teamsAdded = 0;

    for (const u of INITIAL_USERS) {
      const cleanUser = u.username.toLowerCase().trim();
      const existing = await User.findOne({ username: cleanUser });
      if (!existing) {
        await User.create({
          username: cleanUser,
          password: u.password,
          fullName: u.fullName,
          role: u.role,
          teamName: u.teamName,
          track: u.track
        });
        usersAdded++;
      }
    }

    for (const t of INITIAL_TEAMS) {
      const cleanTeam = t.teamName.trim();
      let teamDoc = await Team.findOne({ teamName: cleanTeam });
      if (!teamDoc) {
        teamDoc = await Team.create({
          teamName: cleanTeam,
          leadFullName: t.leadFullName,
          leadUsername: t.leadUsername.toLowerCase().trim(),
          password: t.password,
          members: t.members
        });
        teamsAdded++;
      }

      // Add lead to users
      const cleanLead = t.leadUsername.toLowerCase().trim();
      if (!(await User.findOne({ username: cleanLead }))) {
        await User.create({
          username: cleanLead,
          password: t.password,
          fullName: t.leadFullName,
          role: 'Team Lead',
          teamName: cleanTeam,
          track: 'Participant Track'
        });
        usersAdded++;
      }

      // Add members to users
      for (const m of t.members) {
        const cleanM = m.username.toLowerCase().trim();
        if (!(await User.findOne({ username: cleanM }))) {
          await User.create({
            username: cleanM,
            password: t.password,
            fullName: m.fullName,
            role: 'Team Member',
            teamName: cleanTeam,
            track: 'Participant Track'
          });
          usersAdded++;
        }
      }
    }

    res.json({
      success: true,
      message: `Database seeded successfully. Added ${usersAdded} users, ${teamsAdded} teams.`,
      usersAdded,
      teamsAdded
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 14. Admin Event Timer State (Broadcast to all users)
let globalTimerState = {
  active: false,
  endTime: null,
  durationMinutes: 150,
  startedBy: null,
  startedAt: null
};

app.get('/api/timer', (req, res) => {
  res.json({ success: true, timer: globalTimerState });
});

app.post('/api/timer', (req, res) => {
  const { active, durationMinutes, startedBy } = req.body;
  if (active) {
    const mins = parseInt(durationMinutes, 10) || 150;
    globalTimerState = {
      active: true,
      endTime: Date.now() + (mins * 60 * 1000),
      durationMinutes: mins,
      startedBy: startedBy || 'Administrator',
      startedAt: new Date().toISOString()
    };
    console.log(`✔ Timer started by ${globalTimerState.startedBy}: ${mins} minutes`);
  } else {
    globalTimerState = {
      active: false,
      endTime: null,
      durationMinutes: 150,
      startedBy: null,
      startedAt: null
    };
    console.log('ℹ Timer removed by admin for all users.');
  }
  res.json({ success: true, timer: globalTimerState });
});

// Fallback route to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server locally if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 SHRISTI Hackathon Server with MongoDB Active!`);
    console.log(`   URL: \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    console.log(`   API Endpoint: \x1b[36mhttp://localhost:${PORT}/api/status\x1b[0m`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
