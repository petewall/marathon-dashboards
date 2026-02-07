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
const monstersWithKills = monsters.filter(
	(monster) => monster && typeof monster.killsMetric === 'string'
);

if (monstersWithKills.length === 0) {
	console.error('No monsters with killsMetric found in monsters list.');
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

monstersWithKills.forEach((monster) => {
	const slug = slugify(monster.name || 'monster');
	const killsField = `${slug}Kills`;
	groupStage.$group[killsField] = {
		$sum: { $toInt: { $ifNull: [`$${monster.killsMetric}`, 0] } }
	};

	let punchField;
	let sparedField;
	if (monster.punchKillsMetric) {
		punchField = `${slug}PunchKills`;
		groupStage.$group[punchField] = {
			$sum: { $toInt: { $ifNull: [`$${monster.punchKillsMetric}`, 0] } }
		};
	}
	if (monster.sparedMetric) {
		sparedField = `${slug}Spared`;
		groupStage.$group[sparedField] = {
			$sum: { $toInt: { $ifNull: [`$${monster.sparedMetric}`, 0] } }
		};
	}

	const monsterDoc = {
		name: monster.name || '',
		image: monster.image || '',
		kills: `$${killsField}`
	};
	if (punchField) {
		monsterDoc.punchKills = `$${punchField}`;
	}
	if (sparedField) {
		monsterDoc.spared = `$${sparedField}`;
	}
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
