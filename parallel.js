var exec = require('child_process').exec;

for (var i = 0; i < 40; i++) {
	var command = "node --max-old-space-size=1700 find_voyages.js maury-data-1950.txt "+i+" "+(i+1);
	console.log("launcing " + command)
	exec(command);
}