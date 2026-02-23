#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

if (!process.env.MONGODB_URL || !process.env.MONGODB_URL.trim()) {
  console.error('Set MONGODB_URL before running this script.');
  process.exit(1);
}
if (!process.env.MONGODB_USER || !process.env.MONGODB_USER.trim()) {
  console.error('Set MONGODB_USER before running this script.');
  process.exit(1);
}
if (!process.env.MONGODB_PASSWORD || !process.env.MONGODB_PASSWORD.trim()) {
  console.error('Set MONGODB_PASSWORD before running this script.');
  process.exit(1);
}

const dbName = process.env.MONGODB_DATABASE || 'marathon-game-data';
const collectionName = process.env.MONGODB_COLLECTION || 'marathon-level-data';

const statsArg = process.argv[2];
const statsFile = path.resolve(statsArg || 'stats.json');

if (!fs.existsSync(statsFile)) {
  console.error(`Stats file not found: ${statsFile}`);
  process.exit(1);
}

const contents = fs.readFileSync(statsFile, 'utf8');
const lines = contents
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

if (!lines.length) {
  console.log(`No documents found in ${statsFile}`);
  process.exit(0);
}

const documents = lines.map((line, index) => {
  let doc;
  try {
    doc = JSON.parse(line);
  } catch (err) {
    console.error(`Failed to parse JSON on line ${index + 1}: ${err.message}`);
    process.exit(1);
  }

  if (!doc.date || typeof doc.date !== 'string') {
    console.error(`Document on line ${index + 1} is missing a date string.`);
    process.exit(1);
  }

  const parsedDate = new Date(doc.date);
  if (Number.isNaN(parsedDate.getTime())) {
    console.error(`Document on line ${index + 1} has an invalid date: ${doc.date}`);
    process.exit(1);
  }

  return { ...doc, date: parsedDate };
});

async function uploadDocuments() {
  const client = new MongoClient(process.env.MONGODB_URL, {
    auth: {
      username: process.env.MONGODB_USER,
      password: process.env.MONGODB_PASSWORD,
    },
  });

  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);

    const latestDoc = await collection.find().sort({ date: -1 }).limit(1).next();
    const latestDate =
      latestDoc && latestDoc.date instanceof Date ? latestDoc.date : null;

    const docsToInsert = latestDate
      ? documents.filter(doc => doc.date > latestDate)
      : documents;

    if (!docsToInsert.length) {
      const latestMsg = latestDate ? latestDate.toISOString() : 'none';
      console.log(`No new documents to insert; latest date in DB is ${latestMsg}.`);
      return;
    }

    const result = await collection.insertMany(docsToInsert, { ordered: false });
    console.log(
      `Inserted ${result.insertedCount} documents into ${dbName}.${collectionName} (latest DB date: ${
        latestDate ? latestDate.toISOString() : 'none'
      })`
    );
  } catch (err) {
    console.error(`Failed to upload stats: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {});
  }
}

uploadDocuments();
