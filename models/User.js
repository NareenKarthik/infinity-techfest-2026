const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password: {
      type: String,
      required: [true, 'Password is required']
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    role: {
      type: String,
      enum: ['SuperAdmin', 'Coordinator', 'Team Lead', 'Team Member', 'Participant'],
      default: 'Participant',
      index: true
    },
    teamName: {
      type: String,
      default: 'Unassigned',
      trim: true,
      index: true
    },
    track: {
      type: String,
      default: 'General',
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    lastLogin: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Method to verify password (supports both plaintext matching and flexible checking)
UserSchema.methods.comparePassword = function (candidatePassword) {
  return this.password === candidatePassword;
};

// Transform output to strip sensitive fields if needed
UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
