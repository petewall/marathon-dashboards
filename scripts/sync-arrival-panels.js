#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function usage() {
	console.error(
		'Usage: scripts/sync-arrival-panels.js <dashboards-dir> [arrival-dashboard]'
	);
	console.error(
		"Example: scripts/sync-arrival-panels.js dashboards/Marathon dashboards/Marathon/01-arrival.json"
	);
}

if (process.argv.length < 3 || process.argv.length > 4) {
	usage();
	process.exit(1);
}

const dashboardsDir = path.resolve(process.argv[2]);
const arrivalDashboardPath = path.resolve(
	process.argv[3] || path.join(dashboardsDir, '01-arrival.json')
);

if (!fs.existsSync(dashboardsDir) || !fs.statSync(dashboardsDir).isDirectory()) {
	console.error(`Dashboards directory not found: ${dashboardsDir}`);
	process.exit(1);
}
if (!fs.existsSync(arrivalDashboardPath)) {
	console.error(`Arrival dashboard not found: ${arrivalDashboardPath}`);
	process.exit(1);
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

const arrivalDashboard = readJson(arrivalDashboardPath);
const elements = arrivalDashboard?.spec?.elements;

if (!elements || !elements['panel-1'] || !elements['panel-2']) {
	console.error(
		`${arrivalDashboardPath} is missing panel-1 or panel-2 in spec.elements.`
	);
	process.exit(1);
}

const panelsToCopy = {
	'panel-1': clone(elements['panel-1']),
	'panel-2': clone(elements['panel-2'])
};

const levelFilePattern = /^(\d{2})-.*\.json$/;

function updateLevelIndex(panel, levelIndex, filePath, panelName) {
	const querySpec =
		panel?.spec?.data?.spec?.queries?.[0]?.spec?.query?.spec ?? null;
	if (!querySpec || typeof querySpec.parsedQuery !== 'string') {
		throw new Error(
			`Unable to find parsedQuery for ${panelName} in ${filePath}`
		);
	}

	const regex = /"level index":"\d+"/;
	if (!regex.test(querySpec.parsedQuery)) {
		throw new Error(
			`parsedQuery missing "level index" for ${panelName} in ${filePath}`
		);
	}

	querySpec.parsedQuery = querySpec.parsedQuery.replace(
		regex,
		`"level index":"${levelIndex}"`
	);
}

function syncDashboard(fileName) {
	const match = levelFilePattern.exec(fileName);
	if (!match) {
		return;
	}

	const levelNumber = parseInt(match[1], 10);
	const levelIndex = levelNumber - 1;
	const filePath = path.join(dashboardsDir, fileName);

	if (filePath === arrivalDashboardPath) {
		return;
	}

	const dashboard = readJson(filePath);
	const spec = (dashboard.spec = dashboard.spec || {});
	spec.elements = spec.elements || {};

	for (const panelName of Object.keys(panelsToCopy)) {
		spec.elements[panelName] = clone(panelsToCopy[panelName]);
		updateLevelIndex(spec.elements[panelName], levelIndex, filePath, panelName);
	}

	writeJson(filePath, dashboard);
	console.log(`Updated ${filePath}`);
}

fs.readdirSync(dashboardsDir)
	.sort()
	.forEach(syncDashboard);
