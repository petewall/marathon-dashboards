#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const util = require('util');

function usage() {
	console.error('Usage: scripts/generate-enemies-query.js <game-data.yaml>');
}

if (process.argv.length !== 3) {
	usage();
	process.exit(1);
}

const dataFile = path.resolve(process.argv[2]);
if (!fs.existsSync(dataFile)) {
	console.error(`File not found: ${dataFile}`);
	process.exit(1);
}

const yqResult = spawnSync('yq', ['-o=json', dataFile], { encoding: 'utf8' });
if (yqResult.status !== 0) {
	console.error(yqResult.stderr.trim());
	process.exit(yqResult.status || 1);
}

let gameData;
try {
	gameData = JSON.parse(yqResult.stdout);
} catch (err) {
	console.error(`Failed to parse ${dataFile}: ${err.message}`);
	process.exit(1);
}

const monsters = Array.isArray(gameData.monsters) ? gameData.monsters : [];
const monstersWithPrefixes = monsters.filter(
	(monster) =>
		monster &&
		typeof monster.metricPrefix === 'string' &&
		monster.metricPrefix.trim().length > 0
);

if (monstersWithPrefixes.length === 0) {
	console.error('No monsters with metricPrefix entries found in monsters list.');
	process.exit(1);
}

const slugify = (value) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');

const matchStage = {
	$match: {
		'scenario name': '${game}',
		'level index': '${levelIndex}'
	}
};
const groupStage = { $group: { _id: null } };
const monsterDocs = [];

const buildMetricNames = (prefix) => {
	const trimmed = prefix.trim();
	return {
		kills: `${trimmed} kills`,
		punchKills: `${trimmed} punch kills`,
		spared: trimmed.endsWith('s')
			? `${trimmed} spared`
			: `${trimmed}s spared`
	};
};

monstersWithPrefixes.forEach((monster) => {
	const slug = slugify(monster.name || 'monster');
	const metricNames = buildMetricNames(monster.metricPrefix);
	
	const killsField = `${slug} kills`;
	groupStage.$group[killsField] = {
		$sum: { $toInt: { $ifNull: [`$${metricNames.kills}`, 0] } }
	};

	const punchField = `${slug} punch kills`;
	groupStage.$group[punchField] = {
		$sum: { $toInt: { $ifNull: [`$${metricNames.punchKills}`, 0] } }
	};

	const sparedField = `${slug}s spared`;
	groupStage.$group[sparedField] = {
		$sum: { $toInt: { $ifNull: [`$${metricNames.spared}`, 0] } }
	};

	const monsterDoc = {
		name: monster.name || '',
		image: monster.image || '',
		kills: `$${killsField}`,
		punchKills: `$${punchField}`,
		spared: `$${sparedField}`
	};
	monsterDocs.push(monsterDoc);
});

const pipeline = [
	matchStage,
	groupStage,
	{
		$project: {
			_id: 0,
			monsters: monsterDocs
		}
	},
	{ $unwind: '$monsters' },
	{ $replaceRoot: { newRoot: '$monsters' } }
];

const pipelineString = util.inspect(pipeline, {
	depth: null,
	compact: false,
	breakLength: 80
});

console.log(
	`marathon-game-data.marathon-game-data.aggregate(${pipelineString})`
);
