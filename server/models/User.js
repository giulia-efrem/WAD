'use strict';

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  label: { type: String, enum: ['Home', 'Work', 'Other'], required: true },
  street: { type: String, required: true, trim: true, maxlength: 120 },
  details: { type: String, default: '', trim: true, maxlength: 120 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  isDefault: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  addresses: { type: [addressSchema], default: [] },
  favorites: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }], default: [] }
}, { timestamps: true });

/* What the browser gets: never the password hash. */
userSchema.methods.toPublic = function toPublic(extra = {}) {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    addresses: this.addresses.map(a => ({ _id: a._id, label: a.label, street: a.street, details: a.details, city: a.city, isDefault: a.isDefault })),
    favorites: this.favorites.map(String),
    createdAt: this.createdAt,
    ...extra
  };
};

module.exports = mongoose.model('User', userSchema);
