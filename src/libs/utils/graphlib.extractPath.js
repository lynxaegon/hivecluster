module.exports = extractPath;

function extractPath(paths, source, target) {
		if (paths[source].predecessor !== undefined) {
		throw new Error("Invalid source node");
	}
	if (paths[target].predecessor === undefined && target !== source) {
		throw new Error("Invalid target node");
	}

	return {
		distance: paths[target].distance - 1,
		path: runExtractPath(paths, source, target)
	};
}

function runExtractPath(paths, source, target) {
	let path = [];
	let currentNode = target;

	while(currentNode !== source) {
		path.push(currentNode);
		currentNode = paths[currentNode].predecessor;
	}
	return path.reverse();
}