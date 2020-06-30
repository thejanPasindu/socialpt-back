const {admin, db} = require('./admin');


// middleware
module.exports = (req, res, next) => {
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        return res.status(403).json({ error: 'Unathorized' });
    }

    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken;
            console.log(decodedToken);
            return db.collection('users')
                .where('userId', '==', req.user.uid)
                .limit(1)
                .get();
        })
        .then(data => {
            req.user.handle = data.docs[0].data().handle;
            req.user.userImage = data.docs[0].data().imgUrl;
            return next();
        })
        .catch(err => {
            console.error(err);
            return res.status(403).json(err);
        })
};
