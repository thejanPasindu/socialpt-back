const { admin, db } = require('../util/admin');
const firebase = require('firebase');

const config = require('../util/config');
firebase.initializeApp(config);

const { singupDataValidator, loginValidator, redusUserDetaild } = require('../util/validator');
const { user } = require('firebase-functions/lib/providers/auth');
const { connect } = require('http2');


exports.singup = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confrimPassword: req.body.confrimPassword,
        handle: req.body.handle,
    };

    // validation
    const { valid, errors } = singupDataValidator(newUser);
    if (!valid) return res.status(400).json(errors);

    let token, userId;
    const imgUser = "default-user.png";
    db.doc(`/users/${newUser.handle}`)
        .get()
        .then(doc => {
            if (doc.exists) {
                return res.status(400).json({ handle: 'handle is alredy taken' });
            } else {
                return firebase
                    .auth()
                    .createUserWithEmailAndPassword(newUser.email, newUser.password)
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then(idToken => {
            token = idToken;
            const userCredi = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                imgUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imgUser}?alt=media`,
                userId
            };

            return db.doc(`/users/${newUser.handle}`).set(userCredi);
        })
        .then(() => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                return res.status(400).json({ email: 'email is alredy taken' });
            }

            if (err.code === 'auth/invalid-email') {
                return res.status(400).json({ email: 'Invalid email' });
            }

            return res.status(500).json({ error: err.code });
        });
};


exports.login = (req, res) => {

    const user = {
        email: req.body.email,
        password: req.body.password
    };

    // validation
    const { valid, errors } = loginValidator(user);
    if (!valid) return res.status(400).json(errors);

    firebase
        .auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            return res.status(403).json({ general: "Wrong credentials, Please Tryagain" });
        })

};

// Auth User Details
exports.getAuthUserDetails = (req, res) => {
    let userData = {};

    db
        .doc(`/users/${req.user.handle}`)
        .get()
        .then(doc => {
            if (doc.exists) {
                userData.credentials = doc.data();
                return db
                    .collection('likes')
                    .where('userHandle', '==', req.user.handle)
                    .get();
            };
        })
        .then(data => {
            userData.likes = [];
            data.forEach(doc => {
                userData.likes.push(doc.data());
            });
            return db.collection('notifications')
                .where('recipient', '==', req.user.handle)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get()
        })
        .then(data => {
            userData.notifications = [];
            data.forEach(doc => {
                d = doc.data();
                d.notificationId = doc.id;
                userData.notifications.push(d);
            });
            return res.status(201).json(userData);
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: err.code });
        });
};

// user details
exports.userDetails = (req, res) => {

    let userDetails = redusUserDetaild(req.body);

    db.doc(`/users/${req.user.handle}`).update(userDetails)
        .then(() => {
            return res.status(201).json({ message: 'Details added successfully' });
        })
        .catch(err => {
            console.error(err);
            return escape.status(400).json({ error: err.code });
        })
};


exports.uploadImage = (req, res) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    const busboy = new BusBoy({ headers: req.headers });

    let imgName;
    let image = {};
    busboy.on('file', (fieldName, file, fileName, encoding, mimetype) => {

        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res.status(400).json({ error: 'Wrong file type' });
        }

        const imgExe = fileName.split('.')[fileName.split('.').length - 1];
        imgName = `${Math.round(Math.random() * 1000000000)}.${imgExe}`;

        const filePath = path.join(os.tmpdir(), imgName);
        image = { filePath, mimetype };
        file.pipe(fs.createWriteStream(filePath));
    });

    busboy.on('finish', () => {
        admin.storage().bucket().upload(image.filePath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: image.mimetype
                }
            }
        })
            .then(() => {
                const imgUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imgName}?alt=media`;
                return db.doc(`/users/${req.user.handle}`).update({ imgUrl });
            })
            .then(() => {
                return res.status(201).json({ message: 'Image upload Successfully' });
            })
            .catch(err => {
                console.error(err)
                return res.status(500).json({ error: err.code });
            });
    });

    busboy.end(req.rawBody);
};


exports.getUserDetails = (req, res) => {
    let userData = {};
    db
        .doc(`/users/${req.params.handle}`)
        .get()
        .then(doc => {
            if (doc.exists) {
                userData.user = doc.data();
                return db.collection('screams')
                    .where('userHandle', '==', req.params.handle)
                    .orderBy('createdAt', 'desc')
                    .get()
            } else {
                return res.status(404).json({ error: ' User not found' });
            }
        })
        .then(data => {
            userData.screams = [];
            data.forEach(doc => {
                let d = doc.data();
                d.screamId = doc.id;
                userData.screams.push(d);
            });
            return res.status(201).json(userData);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
};

exports.markNotifications = (req, res) => {
    let batch = db.batch();
    req.body.forEach(notiId => {
        const notification = db.doc(`/notifications/${notiId}`);
        batch.update(notification, { read: true });
    });
    batch.commit()
        .then(() => {
            return res.status(201).json({ message: 'Notification marked successfully' });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        });
};