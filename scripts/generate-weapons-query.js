#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const util = require('util');

function usage() {
	console.error('Usage: scripts/generate-weapons-query.js <game-data.yaml>');
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

const weapons = Array.isArray(gameData.weapons) ? gameData.weapons : [];
const weaponsWithMetrics = weapons.filter(
	(w) => w.firedMetric && w.hitMetric
);

if (weaponsWithMetrics.length === 0) {
	console.error('No weapons with fired/hit metrics found.');
	process.exit(1);
}

const matchStage = { $match: { 'scenario name': '${game}' } };
const groupStage = { $group: { _id: null } };
const weaponDocs = [];

const slugify = (value) =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_|_$/g, '');

weaponsWithMetrics.forEach((weapon) => {
	const slug = slugify(weapon.name || 'weapon');
	const firedField = `${slug}Fired`;
	const hitField = `${slug}Hits`;

	groupStage.$group[firedField] = {
		$sum: { $toInt: { $ifNull: [`$${weapon.firedMetric}`, 0] } }
	};
	groupStage.$group[hitField] = {
		$sum: { $toInt: { $ifNull: [`$${weapon.hitMetric}`, 0] } }
	};

	weaponDocs.push({
		name: weapon.name || '',
		image: weapon.image || '',
		fired: `$${firedField}`,
		hits: `$${hitField}`,
		accuracy: {
			$cond: [
				{ $eq: [`$${firedField}`, 0] },
				0,
				{ $divide: [`$${hitField}`, `$${firedField}`] }
			]
		}
	});
});

const pipeline = [
	matchStage,
	groupStage,
	{
		$project: {
			_id: 0,
			weapons: weaponDocs
		}
	},
	{ $unwind: '$weapons' },
	{ $replaceRoot: { newRoot: '$weapons' } }
];

const pipelineString = util.inspect(pipeline, {
	depth: null,
	compact: false,
	breakLength: 80
});

console.log(
	`marathon-game-data.marathon-game-data.aggregate(${pipelineString})`
);
