import fs from 'fs';
import admin from 'firebase-admin';
import path from 'path';
import express from 'express';
// to set mongo auth files to process.env
import 'dotenv/config';
import { db, connectToDb } from './db.js';
// in order to make __dirname works
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// loading credentials before starting up the server synchronously
const credentials = JSON.parse(fs.readFileSync('./credentials.json'));

admin.initializeApp({
  credential: admin.credential.cert(credentials),
});
const app = express();
const port = process.env.port || 8000;
app.use(express.json());
// our server will serve the front end files as static files
app.use(express.static(path.join(__dirname, '../build')));
// to handle requests which are not for our mentioned paths, we will respnse back with out index.html file
app.get('/^(?!/api).+/', (req, res) => {
  res.sendFile(path.join(__dirname, '../build/index.html'));
});
app.use(async (req, res, next) => {
  // to get the auth token
  const { authtoken } = req.headers;

  if (authtoken) {
    try {
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (e) {
      return res.sendStatus(400);
    }
  }
  req.user = req.user || {};
  next();
});
// to load a particular article
app.get('/api/article/:name', async (req, res) => {
  const { name } = req.params;
  // get the id
  const { uid } = req.user;
  const article = await db.collection('articles').findOne({ name });
  if (article) {
    // after loading the article, now we need to check if the same user has already upvoted the article
    const upvoteIds = article.upvoteIds || [];
    article.canUpvote = uid && !upvoteIds.includes(uid);
    res.status(200).json(article);
  } else {
    res.status(404).send('No Article Found');
  }
});

// if user is not logged in, we will not allow them to upvote or add a comment
app.use((req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.status(401).json('Not Allowed');
  }
});

app.put('/api/article/:name/upvote', async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;
  //   find the article
  const article = await db.collection('articles').findOne({ name });

  if (article) {
    const upvoteIds = article.upvoteIds || [];
    const canUpvote = uid && !upvoteIds.includes(uid);
    if (canUpvote) {
      await db
        .collection('articles')
        .updateOne(
          { name },
          { $inc: { upvotes: 1 }, $push: { upvoteIds: uid } },
        );
    }
    const updatedArticle = await db.collection('articles').findOne({ name });
    res.json(updatedArticle);
  } else {
    res.send(`${name} article doesn't exist ☹`);
  }
});

app.post('/api/article/:name/comment', async (req, res) => {
  const { name } = req.params;
  const { content } = req.body;
  const { email } = req.user;

  await db
    .collection('articles')
    .updateOne({ name }, { $push: { comments: { postedBy: email, content } } });
  const article = await db.collection('articles').findOne({ name });
  if (article) {
    res.json(article);
  } else {
    res.send(`${name} article doesn't exist ☹`);
  }
});
connectToDb(() => {
  console.log('Successfully connected to the database');
  app.listen(port, () => {
    console.log('App is listening on port', port);
  });
});
