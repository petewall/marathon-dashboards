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
const layoutToCopy = clone(arrivalDashboard?.spec?.layout);

if (!elements || Object.keys(elements).length === 0) {
	console.error(`${arrivalDashboardPath} has no panels in spec.elements.`);
	process.exit(1);
}
if (!layoutToCopy) {
	console.error(`${arrivalDashboardPath} is missing spec.layout.`);
	process.exit(1);
}

const panelsToCopy = {};
const panelsRequiringLevelIndex = new Set();
for (const [panelName, panelSpec] of Object.entries(elements)) {
	panelsToCopy[panelName] = clone(panelSpec);
	if (panelHasLevelIndex(panelSpec)) {
		panelsRequiringLevelIndex.add(panelName);
	}
}

function panelHasLevelIndex(panel) {
	const queries =
		panel?.spec?.data?.spec?.queries && Array.isArray(panel.spec.data.spec.queries)
			? panel.spec.data.spec.queries
			: [];
	for (const query of queries) {
		const parsedQuery = query?.spec?.query?.spec?.parsedQuery;
		if (typeof parsedQuery === 'string' && parsedQuery.includes('"level index"')) {
			return true;
		}
	}
	return false;
}

const levelFilePattern = /^(\d{2})-.*\.json$/;

function updateLevelIndex(panel, levelIndex, filePath, panelName) {
	const levelIndexRegex = /"level index":"\d+"/g;
	const queries =
		panel?.spec?.data?.spec?.queries && Array.isArray(panel.spec.data.spec.queries)
			? panel.spec.data.spec.queries
			: [];
	let updated = false;

	for (const [idx, query] of queries.entries()) {
		const querySpec = query?.spec?.query?.spec;
		if (!querySpec || typeof querySpec.parsedQuery !== 'string') {
			continue;
		}

		if (!levelIndexRegex.test(querySpec.parsedQuery)) {
			// Reset lastIndex so the regex can be reused.
			levelIndexRegex.lastIndex = 0;
			continue;
		}

		levelIndexRegex.lastIndex = 0;
		querySpec.parsedQuery = querySpec.parsedQuery.replace(
			levelIndexRegex,
			`"level index":"${levelIndex}"`
		);
		updated = true;
	}

	if (panelsRequiringLevelIndex.has(panelName) && !updated) {
		throw new Error(
			`parsedQuery missing "level index" for ${panelName} in ${filePath}`
		);
	}
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
	spec.layout = clone(layoutToCopy);

	writeJson(filePath, dashboard);
	console.log(`Updated ${filePath}`);
}

fs.readdirSync(dashboardsDir)
	.sort()
	.forEach(syncDashboard);
