var fs = require('fs'),
    readline = require('readline'),
		path = require('path'),
		PNG = require('pngjs').PNG;
  	dir = __dirname + '/imgs';

var myArgs = process.argv.slice(2);

var filePath = path.join(__dirname + '/' + myArgs[0]);
var lineStart = parseInt(myArgs[1])*1000000;
var lineLimit = parseInt(myArgs[2])*1000000;

if (lineStart == 0) {
	lineStart = "00000000"
} else if (lineStart < 10000000) {
	lineStart = "0"+ lineStart;
}

if (lineLimit < 10000000) {
	lineLimit = "0"+lineLimit;
}

var	ws = fs.createWriteStream('voyages-'+lineStart+'-'+lineLimit+'.txt');

var width = 2000;
var height = 800;

var latRes = 0.01;
var lonRes = 0.01;

var latCenter = 0;
var latMax = 90;

var lonCenter = 180;
var lonMax = 360;

// elements of IMMA format that matter to us
//           1         2         3         4         5 
// 0123456789012345678901234567890123456789012345678901234567890
// 1827 817 500 -827 10047 0006    10        1NL 1355 46                                                       
// 166210151200 4962 35378 0206    10     1134NL 1585 26                                                        165 17796730133 5 0                   2FF11FF11AAAAAAAAAAAA     99 0 NAN     NATIONAAL ARCHIEF OF THE NETHERLANDS              DEN HAAG  NEDERLAND     1.11.01.01     1229             AANW                                   
// 1850 1 1     5057 32005 02 4    10LIBERTY    13155123                                                        165 138 9701 69 5 0 1                  FF11FF71AAAAAAAAAAAA     99 0 430167118500101  5034N 3957W                                                                           NW     26 NW     26 NW     26                                1R        201S.W.PEABODY     GLASGOW                 NEW YORK                 2762 199

// line[0-4] year
// line[4-6] month
// line[6-8] day
// line[12-17] lat -90-90, units 0.1
// line[17-23] lon 0-360, units 0.1
// line[34-43] shipid

var rd = readline.createInterface({
    input: fs.createReadStream(filePath),
    output: process.stdout,
    terminal: false
});

var lat, lon, year, month, day, shipid;

var voyages = {};

function dist2(x0,y0,x1,y1) {
	return (x0-x1)*(x0-x1)+(y0-y1)*(y0-y1);
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

var voyages = {};

function recent(y1,m1,d1,y2,m2,d2) {
	var delta;
	if (y1 == y2) {
		delta = (m2-m1)*30+(d2-d1);
	} else if (y2 - y1 == 1) {
		delta = (m2+12-m1)*30+(d2-d1);
	}
	return delta;
}

var lineCount = 0;
var voyagesCount = 0;

function dumpVoyage(v) {
	if (v.points.length >= 10) {
		var str = v.id+"\t"+v.start+"\t"+v.end;
		for (var i=0;i<v.points.length-5;i += 5) {
			str += "\t"+v.points[i]+"\t"+v.points[i+1]+"\t"+v.points[i+2]+"\t"+v.points[i+3]+"\t"+v.points[i+4];
		}
		ws.write(str+"\n");
	}
}

function add2voyage(id,year,month,day,lat,lon) {
	if (id in voyages) {
		var v = voyages[id];
		var d = getDistanceFromLatLonInKm(lat,lon,v.points[5*v.next+3],v.points[5*v.next+4]);
		var r = recent(v.end,v.points[5*v.next],v.points[5*v.next+1],year,month,day);
		if (d < 1000 && r < 60) {
			v.end = year;
			v.next++;
			v.points = v.points.concat([month,day,r,lat,lon]);
		} else {
			dumpVoyage(voyages[id]);
			if (lineCount < lineLimit)
				voyages[id] = {id:id,start:year,end:year,next:0,points:[month,day,0,lat,lon]};
			else
			  delete voyages[id];
		}
	} else {
		if (lineCount < lineLimit)
			voyages[id] = {id:id,start:year,end:year,next:0,points:[month,day,0,lat,lon]};
	}
}

rd.on('line', function(line) {
	lineCount++;
	if (lineCount % 1000000 == 0) {
		console.log("processed line "+lineCount);
	}
	year = parseInt(line.slice(0,4));
	month = parseInt(line.slice(4,6));
	day = parseInt(line.slice(6,8));
	lat = parseInt(line.slice(12,17))*latRes;
	lon = parseInt(line.slice(17,23))*lonRes;
	shipid = line.slice(34,43);
	if (lineCount >= lineStart && year === year && month === month && day === day && lat === lat && lon === lon && shipid.replace(/\s/g, '').length) {
		add2voyage(shipid,year,month,day,lat,lon);
	}
}).on('close', function() {
	console.log("dumping remainder");
	for (var id in voyages) {
		dumpVoyage(voyages[id]);
	}
	console.log("finishing up");
	ws.end();
});