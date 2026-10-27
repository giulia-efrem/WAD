'use strict';

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  label: { type: String, enum: ['Home', 'Work', 'Other'], required: true },
  street: { type: String, required: true, trim: true, maxlength: 120 },
  details: { type: String, default: '', trim: true, maxlength: 120 },
  city: { type: String, required: true, trim: true, maxlength: 80 },
  isDefault: { type: Boolean, default: false }
});

/* customer: everyone who signs up. partner: works for one restaurant. courier: delivers.
   admin: runs the platform. Only admins (or npm run make-admin) can give staff roles. */
const ROLES = ['customer', 'partner', 'courier', 'admin'];
const VEHICLES = ['bike', 'scooter', 'car'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ROLES, default: 'customer' },
  /* Partners only: the restaurant they work for. */
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', default: null },
  /* Couriers only. */
  vehicle: { type: String, enum: [...VEHICLES, null], default: null },
  /* A disabled account can't log in, and its sessions stop working at once. */
  disabled: { type: Boolean, default: false },
  /* Raised on password change or disable, which signs out every existing session. */
  tokenVersion: { type: Number, default: 0 },
  addresses: { type: [addressSchema], default: [] },
  favorites: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' }], default: [] },
  /* Created by npm run seed; re-seeding replaces only these. */
  seeded: { type: Boolean, default: false }
}, { timestamps: true });

/* What the browser gets: never the password hash. */
userSchema.methods.toPublic = function toPublic(extra = {}) {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    restaurant: this.restaurant ? String(this.restaurant._id || this.restaurant) : null,
    vehicle: this.vehicle || null,
    addresses: this.addresses.map(a => ({ _id: a._id, label: a.label, street: a.street, details: a.details, city: a.city, isDefault: a.isDefault })),
    favorites: this.favorites.map(String),
    createdAt: this.createdAt,
    ...extra
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
module.exports.VEHICLES = VEHICLES;
