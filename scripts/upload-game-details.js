#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const YAML = require('yaml');

const REQUIRED_ENV_VARS = ['MONGODB_URL', 'MONGODB_USER', 'MONGODB_PASSWORD'];
for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar] || !process.env[envVar].trim()) {
    console.error(`Set ${envVar} before running this script.`);
    process.exit(1);
  }
}

const dbName = process.env.MONGODB_DATABASE || 'marathon-game-data';
const collectionName =
  process.env.MONGODB_GAMES_COLLECTION || 'marathon-game-details';

const dataArgs = process.argv.slice(2);
const dataFiles = collectDataFiles(dataArgs);
if (!dataFiles.length) {
  console.error('No YAML files found to process.');
  process.exit(1);
}

const gameDocuments = dataFiles.map(filePath => {
  let parsed;
  try {
    parsed = YAML.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse ${filePath}: ${err.message}`);
    process.exit(1);
  }
  return { _id: path.basename(filePath, path.extname(filePath)), ...parsed };
});

async function uploadGameDetails() {
  const client = new MongoClient(process.env.MONGODB_URL, {
    auth: {
      username: process.env.MONGODB_USER,
      password: process.env.MONGODB_PASSWORD
    }
  });

  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);

    const bulkOps = gameDocuments.map(game => ({
      replaceOne: {
        filter: { _id: game._id },
        replacement: game,
        upsert: true
      }
    }));

    const result = await collection.bulkWrite(bulkOps, { ordered: false });
    const upserted = result.upsertedCount || 0;
    const modified = result.modifiedCount || 0;
    console.log(
      `Synced ${gameDocuments.length} games to ${dbName}.${collectionName} (upserted: ${upserted}, modified: ${modified}).`
    );
  } catch (err) {
    console.error(`Failed to upload game details: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {});
  }
}

uploadGameDetails();

function collectDataFiles(inputs) {
  if (!inputs.length) {
    return readYamlFilesFromDir(path.resolve('data'));
  }

  const files = [];
  for (const input of inputs) {
    const fullPath = path.resolve(input);
    if (!fs.existsSync(fullPath)) {
      console.error(`Data path not found: ${fullPath}`);
      process.exit(1);
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...readYamlFilesFromDir(fullPath));
    } else if (stats.isFile() && isYamlFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return Array.from(new Set(files));
}

function readYamlFilesFromDir(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(dirPath)
    .filter(name => isYamlFile(name))
    .map(name => path.join(dirPath, name));
}

function isYamlFile(filePath) {
  return /\.ya?ml$/i.test(filePath);
}
