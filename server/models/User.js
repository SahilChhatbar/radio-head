const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  provider: {
    type: String,
    default: 'local'
  },
  favoriteStations: [{
    stationuuid: { type: String, required: true },
    name: { type: String, required: true },
    url: String,
    url_resolved: String,
    favicon: String,
    country: String,
    countrycode: String,
    codec: String,
    bitrate: Number,
    votes: Number,
    clickcount: Number,
    addedAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt before saving
// CHANGED: Use async/await and REMOVE 'next' parameter to prevent "next is not a function"
userSchema.pre('save', async function() {
  // Only run this function if password was modified
  if (!this.isModified('password')) {
    return;
  }

  // Generate salt and hash using await
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);