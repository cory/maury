var fs = require('fs'),
    request = require('request'),
	  dir = __dirname + '/icoads';
	
var start = 1900;
var last = 1950;
var baseURI = "http://www1.ncdc.noaa.gov/pub/data/icoads2.5/";

// IMMA_R2.5.1662.10_ENH
var fileNameBase = "IMMA_R2.5.";
var fileNameSuffix = "_ENH";

var year = start, month = 1;

function download(url, filename, cb) {
	request(url, filename, function (error, response, body) {
	  if (!error && response.statusCode == 200) {
		  fs.writeFile(filename, body, function() {
		  });
		} else {
		}
	});
	cb();
}

function go() {
	var name = fileNameBase+year+"."+(month < 10 ? "0"+month : month)+fileNameSuffix;
	download(baseURI+year+"/"+name, dir+"/"+name, next);
}

function next() {
	month++;
	if (month == 13) {
		month = 1;
		year++;
	}
	if (year < last) {
		go();
	} else {
		console.log("done");
	}
}

go();