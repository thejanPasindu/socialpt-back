const { db } = require('../util/admin');

exports.getAllScreams = (req, res) => {
    db.collection('screams')
        .orderBy('createdAt', 'desc')
        .get()
        .then(data => {
            let screams = [];
            data.forEach(doc => {
                screams.push({
                    screamId: doc.id,
                    body: doc.data().body,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt,
                    commentCount: doc.data().commentCount,
                    likeCount: doc.data().likeCount,
                    userImage: doc.data().userImage
                });
            });
            return res.json(screams);
        })
        .catch(err => console.error(err));
};

exports.createScream = (req, res) => {

    const newScream = {
        body: req.body.body,
        userHandle: req.user.handle,
        createdAt: new Date().toISOString(),
        userImage: req.user.userImage,
        likeCount: 0,
        commentCount: 0
    };

    db.collection('screams')
        .add(newScream)
        .then(data => {
            const resScream = newScream;
            resScream.screamId = data.id;
            res.status(200).json(resScream);
        })
        .catch(err => {
            res.status(500).json({ error: 'something went wrong' });
            console.error(err);
        });
};

exports.getScream = (req, res) => {
    let screamData = {};
    db
        .doc(`/screams/${req.params.screamId}`)
        .get()
        .then(doc => {
            if (!doc.exists) {
                return res.status(404).json({ error: 'Scream not Found' });
            }
            screamData = doc.data();
            screamData.screamId = doc.id;

            return db.collection('comments')
                .where('screamId', '==', req.params.screamId)
                .orderBy('createdAt', 'desc')
                .get();
        })
        .then(data => {
            screamData.comments = [];
            data.forEach(doc => {
                screamData.comments.push(doc.data());
            });
            return res.status(201).json(screamData);
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: err.code });
        })
};

exports.commentOnScream = (req, res) => {
    if (req.body.body == '') return res.status(400).json({ comment: 'Must not be empty' });

    const newComment = {
        body: req.body.body,
        createdAt: new Date().toISOString(),
        userHandle: req.user.handle,
        userImage: req.user.userImage,
        screamId: req.params.screamId
    };

    db
        .doc(`/screams/${req.params.screamId}`)
        .get()
        .then(doc => {
            if (!doc.exists) return res.status(404).json({ error: 'Scream not Found' });
            return doc.ref.update({commentCount: doc.data().commentCount + 1});
        })
        .then(()=>{
            return db.collection('comments').add(newComment);
        })
        .then(() => {
            return res.status(201).json({ message: 'Successfully Commented', comment: newComment });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: 'Somthing went wrong' });
        });
};

exports.likeScream = (req, res) => {
    const likeDocument = db.collection('likes')
        .where('userHandle', '==', req.user.handle)
        .where('screamId', '==', req.params.screamId)
        .limit(1);
    const screamDoc = db.doc(`/screams/${req.params.screamId}`);

    let screamData;

    screamDoc.get()
    .then(doc=>{
        if(!doc.exists) return res.status(404).json({error: 'Scream not found'});

        screamData = doc.data();
        screamData.screamId = doc.id;
        return likeDocument.get();
    })
    .then(data=>{
        if(data.empty){
            return db.collection('likes').add({
                screamId: req.params.screamId,
                userHandle: req.user.handle
            })
            .then(()=>{
                screamData.likeCount++;
                return screamDoc.update({likeCount: screamData.likeCount});
            })
            .then(()=>{
                return res.status(201).json(screamData);
            })
        }else{
            return db.doc(`/likes/${data.docs[0].id}`)
            .delete()
            .then(()=>{
                screamData.likeCount--;
                return screamDoc.update({likeCount: screamData.likeCount});
            })
            .then(()=>{
                return res.status(201).json(screamData);
            })     
        }
    })
    .catch(err=>{
        console.error(err);
        return res.status(500).json({error: err.code});
    })
};


exports.deleteScream = (req, res) =>{
    const document = db.doc(`/screams/${req.params.screamId}`);
    document.get()
    .then(doc=>{
        if(!doc.exists){
            return res.status(404).json({error: 'Scream not found'});
        }
        if(doc.data().userHandle !== req.user.handle){
            return res.status(403).json({error: 'Unauthorized'});
        }
        return document.delete()
    })
    .then(()=>{
        return res.status(201).json({message: 'Successfully Deleted'})
    })
    .catch(err=>{
        console.error(err);
        return res.status(500).json({error: err.code});
    })
};