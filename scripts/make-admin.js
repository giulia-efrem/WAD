'use strict';

/* npm run make-admin -- you@example.com
   Gives an existing account the admin role (and re-enables it if it was disabled).
   Sign up on the site first; nobody can make themselves an admin from the browser. */

const db = require('../server/db');
const User = require('../server/models/User');

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run make-admin -- you@example.com');
    process.exitCode = 1;
    return;
  }
  try {
    await db.connect();
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`No account uses ${email}. Sign up on the site first, then run this again.`);
      process.exitCode = 1;
      return;
    }
    if (user.role === 'admin' && !user.disabled) console.log(`${email} is already an admin.`);
    else {
      user.role = 'admin';
      user.restaurant = null;
      user.vehicle = null;
      user.disabled = false;
      /* Ends their current sessions, so the new role applies from the next login. */
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      console.log(`${email} is now an admin. Log in again to open /admin.`);
    }
  } catch (err) {
    console.error('make-admin failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.disconnect();
  }
})();
