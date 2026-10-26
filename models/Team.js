const mongoose = require('mongoose');

const TeammateSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    default: 'Developer',
    trim: true
  }
});

const SubmissionSchema = new mongoose.Schema({
  githubLink: { type: String, default: '', trim: true },
  explanationLink: { type: String, default: '', trim: true },
  videoLink: { type: String, default: '', trim: true },
  submittedBy: { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  simulatedNotes: { type: String, default: '' }
});

const TeamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: [true, 'Team name is required'],
      unique: true,
      trim: true,
      index: true
    },
    leadFullName: {
      type: String,
      required: true,
      trim: true
    },
    leadUsername: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password: {
      type: String,
      required: true
    },
    members: [TeammateSchema],
    selectedProblemId: {
      type: Number,
      default: null
    },
    selectedProblemTitle: {
      type: String,
      default: ''
    },
    selectedBy: {
      type: String,
      default: ''
    },
    selectionTime: {
      type: Date,
      default: null
    },
    submission: {
      type: SubmissionSchema,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Team', TeamSchema);
