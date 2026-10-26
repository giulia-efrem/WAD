'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config');
const db = require('./db');
const { loadUser } = require('./middleware/auth');
const { notFoundApi, errorHandler } = require('./middleware/errors');

const app = express();
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      /* The design sets colours per card with inline style="--cv:…", so inline styles stay allowed. */
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      /* Photos may be any https URL pasted in /admin; blob: is the admin upload preview. */
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: config.isProduction ? [] : null
    }
  },
  strictTransportSecurity: config.isProduction
}));
app.use(cookieParser());
app.use(express.json({ limit: '50kb' }));

app.use('/api', loadUser);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/addresses', require('./routes/addresses'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/restaurants', require('./routes/restaurants'));
app.use('/api/promo', require('./routes/promo'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/credits', require('./routes/credits'));
app.use('/api', notFoundApi);

app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d' }));
app.get('/admin', (req, res) => res.sendFile(path.join(config.publicDir, 'admin.html')));
app.get('/admin/photos', (req, res) => res.sendFile(path.join(config.publicDir, 'admin-photos.html')));
/* Pages of the main app with their own address. The front end picks the view from the path. */
app.get(['/credits'], (req, res) => res.sendFile(path.join(config.publicDir, 'index.html')));
app.use(express.static(config.publicDir, { extensions: ['html'] }));

app.use(errorHandler);

async function start() {
  try {
    await db.connect();
  } catch (err) {
    console.error(`Could not connect to MongoDB at ${config.mongoUri.replace(/\/\/[^@]*@/, '//***@')}: ${err.message}`);
    process.exit(1);
  }
  app.listen(config.port, () => {
    console.log(`Morsel is running at http://localhost:${config.port} (demo speed ${config.demoSpeed}x)`);
  });
}

if (require.main === module) start();

module.exports = app;
