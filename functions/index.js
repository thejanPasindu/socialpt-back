const functions = require('firebase-functions');
const app = require('express')();
const { db } = require('./util/admin');

const {
    getAllScreams,
    createScream,
    getScream,
    commentOnScream,
    likeScream,
    deleteScream
} = require('./handlers/sceams');

const {
    singup,
    login,
    uploadImage,
    userDetails,
    getAuthUserDetails,
    getUserDetails,
    markNotifications
} = require('./handlers/users');

const FBAuth = require('./util/fbAuth');

//screams
app.get('/screams', getAllScreams);
app.post('/scream', FBAuth, createScream);
app.get('/scream/:screamId', getScream);
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);
app.post('/scream/:screamId/like', FBAuth, likeScream);
app.delete('/scream/:screamId', FBAuth, deleteScream);


// singUp & login
app.post('/singup', singup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user', FBAuth, userDetails);
app.get('/user', FBAuth, getAuthUserDetails);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotifications);


exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions.firestore
    .document('likes/{id}')
    .onCreate((snapshot) => {
        return db.doc(`/screams/${snapshot.data().screamId}`).get()
            .then(doc => {
                if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'like',
                        read: false,
                        screamId: doc.id
                    });
                }
            })
            .catch(err => {
                console.error(err);
                return;
            })
    });

exports.deleteNotificationOnUnLike = functions.firestore
    .document('likes/{id}')
    .onDelete((snapshot) => {
        return db.doc(`/notifications/${snapshot.id}`)
            .delete()
            .catch(err => {
                console.error(err);
                return;
            })
    });

exports.createNotificationOnComment = functions.firestore
    .document('comments/{id}')
    .onCreate((snapshot) => {
        return db.doc(`/screams/${snapshot.data().screamId}`).get()
            .then(doc => {
                if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'comment',
                        read: false,
                        screamId: doc.id
                    });
                }
            })
            .catch(err => {
                console.error(err);
                return;
            })
    });



exports.onUserImageChange = functions
    .firestore.document('/users/{userId}')
    .onUpdate((change) => {
        console.log(change.before.data());
        console.log(change.after.data());
        if (change.before.data().imgUrl !== change.after.data().imgUrl) {
            console.log('image has changed');
            const batch = db.batch();
            return db
                .collection('screams')
                .where('userHandle', '==', change.before.data().handle)
                .get()
                .then((data) => {
                    data.forEach((doc) => {
                        const scream = db.doc(`/screams/${doc.id}`);
                        batch.update(scream, { userImage: change.after.data().imgUrl });
                    });
                    return batch.commit();
                });
        } else return true;
    });

exports.onScreamDelete = functions
    .firestore.document('/screams/{screamId}')
    .onDelete((snapshot, context) => {
        const screamId = context.params.screamId;
        const batch = db.batch();
        return db
            .collection('comments')
            .where('screamId', '==', screamId)
            .get()
            .then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/comments/${doc.id}`));
                });
                return db
                    .collection('likes')
                    .where('screamId', '==', screamId)
                    .get();
            })
            .then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/likes/${doc.id}`));
                });
                return db
                    .collection('notifications')
                    .where('screamId', '==', screamId)
                    .get();
            })
            .then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/notifications/${doc.id}`));
                });
                return batch.commit();
            })
            .catch((err) => console.error(err));
    });