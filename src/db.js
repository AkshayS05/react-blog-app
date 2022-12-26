// to connect to the database
import { MongoClient } from 'mongodb';
let db;

async function connectToDb(cb) {
  // local server
  // const client = new MongoClient('mongodb://127.0.0.1:27017');
  const client = new MongoClient(
    `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@cluster0.twqlh2c.mongodb.net/?retryWrites=true&w=majority`,
  );
  await client.connect();
  db = client.db('react-blog-db');
  cb();
}
export { db, connectToDb };
