const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    teamName: {
      type: String,
      required: true,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    deviceInfo: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Attendance', AttendanceSchema);
