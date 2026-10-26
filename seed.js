require('dotenv').config();
const { connectDB, mongoose } = require('./db');
const User = require('./models/User');
const Team = require('./models/Team');

const INITIAL_USERS = [
  {
    username: 'nareen',
    password: 'Nareen@06',
    fullName: 'Nareen Karthik',
    role: 'SuperAdmin',
    teamName: 'Admin Operations',
    track: 'All Tracks'
  },
  {
    username: 'nareen karthik',
    password: 'Nareen@06',
    fullName: 'Nareen Karthik',
    role: 'SuperAdmin',
    teamName: 'Admin Operations',
    track: 'All Tracks'
  },
  {
    username: 'admin',
    password: 'admin@shristi2026',
    fullName: 'Hackathon Administrator',
    role: 'SuperAdmin',
    teamName: 'Admin Operations',
    track: 'All Tracks'
  },
  {
    username: 'coordinator.ai',
    password: 'Coord@2026',
    fullName: 'Dr. Vikram Raman',
    role: 'Coordinator',
    teamName: 'Event Operations',
    track: 'AI & Multimedia Track'
  },
  {
    username: 'coordinator.cyber',
    password: 'Coord@2026',
    fullName: 'Priya Sharma',
    role: 'Coordinator',
    teamName: 'Event Operations',
    track: 'Cybersecurity & Media Track'
  }
];

const INITIAL_TEAMS = [
  {
    teamName: 'Team CyberPulse',
    leadFullName: 'Alex Rivera',
    leadUsername: 'alex.cyber',
    password: 'Cyber@2026',
    members: [
      { fullName: 'Sarah Chen', username: 'sarah.cyber', role: 'Fullstack Developer' },
      { fullName: 'Marcus Vance', username: 'marcus.cyber', role: 'AI Specialist' }
    ]
  },
  {
    teamName: 'Quantum Innovators',
    leadFullName: 'Rohan Patel',
    leadUsername: 'rohan.quantum',
    password: 'Quantum@2026',
    members: [
      { fullName: 'Ananya Rao', username: 'ananya.quantum', role: 'ML Researcher' },
      { fullName: 'Devansh Gupta', username: 'devansh.quantum', role: 'Backend Engineer' }
    ]
  }
];

async function seedDatabase() {
  console.log('--- Seeding MongoDB Database for SHRISTI 2026 ---');
  const res = await connectDB();
  if (!res.success) {
    console.error('Failed to connect to MongoDB. Aborting seed.');
    process.exit(1);
  }

  try {
    // 1. Seed Users
    console.log('\nSeeding Preloaded Administrators & Coordinators...');
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
        console.log(`  + Created User: ${u.fullName} (@${cleanUser}) [${u.role}]`);
      } else {
        console.log(`  = User already exists: @${cleanUser}`);
      }
    }

    // 2. Seed Sample Teams and Members
    console.log('\nSeeding Initial Teams and Participant Users...');
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
        console.log(`  + Created Team: "${cleanTeam}" (Lead: ${t.leadFullName})`);
      } else {
        console.log(`  = Team already exists: "${cleanTeam}"`);
      }

      // Ensure Team Lead user exists in User collection
      const cleanLead = t.leadUsername.toLowerCase().trim();
      const existingLead = await User.findOne({ username: cleanLead });
      if (!existingLead) {
        await User.create({
          username: cleanLead,
          password: t.password,
          fullName: t.leadFullName,
          role: 'Team Lead',
          teamName: cleanTeam,
          track: 'Participant Track'
        });
        console.log(`  + Created Lead User: @${cleanLead}`);
      }

      // Ensure teammates exist in User collection
      for (const m of t.members) {
        const cleanMember = m.username.toLowerCase().trim();
        const existingMember = await User.findOne({ username: cleanMember });
        if (!existingMember) {
          await User.create({
            username: cleanMember,
            password: t.password,
            fullName: m.fullName,
            role: 'Team Member',
            teamName: cleanTeam,
            track: 'Participant Track'
          });
          console.log(`  + Created Member User: @${cleanMember}`);
        }
      }
    }

    const totalUsers = await User.countDocuments();
    const totalTeams = await Team.countDocuments();
    console.log(`\n✔ Database seeding complete! Total Users: ${totalUsers}, Total Teams: ${totalTeams}`);
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, INITIAL_USERS, INITIAL_TEAMS };
