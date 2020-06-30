const admin = require('firebase-admin');
const serviceAccount = require('../ptsocial-29078.json');

admin.initializeApp();

const db = admin.firestore();

module.exports = { admin, db };

