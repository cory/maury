var fs = require('fs'),
    readline = require('readline'),
		path = require('path'),
		PNG = require('pngjs').PNG;
  	dir = __dirname + '/imgs'

var myArgs = process.argv.slice(2);

var filePath = path.join(__dirname + '/' + myArgs[0]);

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
// line[12-17] lat -90-90, units 0.1
// line[17-23] lon 0-360, units 0.1
// line[34-43] shipid
// line[46-49] wind direction 1-361 (degrees - 2)
// line[50-53] wind speed 0-99.9, units 0.1

var rd = readline.createInterface({
    input: fs.createReadStream(filePath),
    output: process.stdout,
    terminal: false
});

var lat, lon, year, month, shipid;

var pts = {};
var voyages = {};

var max_count = 3;
var pt_count = 0;

function pt2idx(x,y) {
 	return (width * y + x) << 2;
}

function addPoint(x,y) {
	var idx = pt2idx(x,y);
	pt_count++;
	if (idx in pts) {
		if (pts[idx].count < 100)
			pts[idx].count++;
	} else {
		pts[idx] = {count:1,x:x,y:y};
	}
	if (pts[idx].count > max_count) {
		max_count++;
	}
}

function draw_line(x0, y0, x1, y1) {
	var dx = Math.abs(x1-x0);
	var dy = Math.abs(y1-y0);
	var sx = (x0 < x1) ? 1 : -1;
	var sy = (y0 < y1) ? 1 : -1;
	var err = dx-dy;
//	console.log("drawing from "+x0+":"+y0+" to "+x1+":"+y1);

	while(true){
//		console.log(x0+":"+y0);
		if (((x0|0) == (x1|0)) && ((y0|0)==(y1|0))) 
			break;
		addPoint(x0,y0);
		var e2 = 2*err;
		if (e2 > -dy){ err -= dy; x0  += sx; }
		if (e2 < dx){ err += dx; y0  += sy; }
	}
}

function dist2(x0,y0,x1,y1) {
	return (x0-x1)*(x0-x1)+(y0-y1)*(y0-y1);
}

console.log("reading points");

function dump_png(name) {
	var png = new PNG({
	    width: width,
	    height: height,
	    filterType: -1
	});

	var i,j, idx;
	for (i=0;i<width;i++) {
		for (j=0;j<height;j++) {
		 	idx = pt2idx(i,j);
	    png.data[idx ] = 0x10;
	    png.data[idx+1] = 0x10;
	    png.data[idx+2] = 0x10;
	    png.data[idx+3] = 0xff;
		}
	}
	for (idx in pts) {
		idx = idx|0;
		var ratio = pts[idx].count/max_count+0.2;
		if (ratio > 1) {
			ratio = 1;
		}
		png.data[idx+1] = (ratio*0xff)|0;
		png.data[idx+2] = (ratio*0xff)|0;
		png.data[idx  ] = (ratio*0xff)|0;
	}
	console.log("writing image " + name);
	png.pack().pipe(fs.createWriteStream(name));
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
var final_voyages = [];

function recent(y1,m1,y2,m2) {
	if (y1 == y2) {
		if (m2-m1 < 3)
		  return true;
	} else if (y2 - y1 == 1) {
		if (y2+12-y1 < 3)
		  return true;
	}
	return false;
}

var voyagesCount = 0;

function add2voyage(id,year,month,lat,lon) {
	if (id in voyages) {
		var v = voyages[id];
		var d = getDistanceFromLatLonInKm(lat,lon,v.points[3*v.next+1],v.points[3*v.next+2]);
		var r = recent(v.end,v.points[3*v.next],year,month);
		if (d < 1000 && r) {
			v.end = year;
			v.next++;
			v.points = v.points.concat([month,lat,lon]);
		} else {
			voyagesCount++;
			final_voyages.push(voyages[id]);
			voyages[id] = {start:year,end:year,next:0,points:[month,lat,lon]};
		}
	} else {
		voyagesCount++;
		voyages[id] = {start:year,end:year,next:0,points:[month,lat,lon]};
	}
}

var counts = 0;

function drawVoyages(name,start,end) {
	pts = {};
	for (var v=0;v<final_voyages.length;v++) {
		if (final_voyages[v].start <= end && final_voyages[v].end >= start) {
			for (var p=0;p<final_voyages[v].points.length-3;p += 3) {
				var drawy0 = (height*0.5 - final_voyages[v].points[p+1]/latMax*height*0.5)|0;
				var drawx0 = ((final_voyages[v].points[p+2]/lonMax*width+3*width/4)%width)|0;
				var drawy1 = (height*0.5 - final_voyages[v].points[p+3+1]/latMax*height*0.5)|0;
				var drawx1 = ((final_voyages[v].points[p+3+2]/lonMax*width+3*width/4)%width)|0;
				if (dist2(drawx0,drawy0,drawx1,drawy1) < 200)
					draw_line(drawx0,drawy0,drawx1,drawy1);
			}
		}
	}
	dump_png(name);
}

var years = [1660,1670,1690,1740,1750,1760,1770,1780,1790,1800,1810,1820,1830,1840,1850,1860,1870,1880,1890,1900,1910,1920,1930,1940];
var lineCount = 0;

rd.on('line', function(line) {
	year = parseInt(line.slice(0,4));
	month = parseInt(line.slice(4,7));
	lat = parseInt(line.slice(12,17))*latRes;
	lon = parseInt(line.slice(17,23))*lonRes;
	shipid = line.slice(34,43);
	lineCount++;
	if (lineCount % 1000000 == 0) {
		console.log("processed line "+lineCount);
	}
	if (year === year && lat === lat && lon === lon && shipid.replace(/\s/g, '').length) {
		add2voyage(shipid,year,month,lat,lon);
	}
}).on('close', function() {
	console.log("wrapping up");
	var totalv = 0;
	var totalpts = 0;
	var singlept = 0;
	
	for (var id in voyages) {
		final_voyages.push(voyages[id]);
	}
	
	totalv = final_voyages.length;

	for (var v=0; v < final_voyages.length;v++) {
		totalpts += final_voyages[v].points.length/3;
		if (final_voyages[v].points.length == 3) {
			singlept++;
		}
	}
	console.log(totalv + " voyages, "+singlept + " single point " + totalpts + " total pts" );
	for (var y=0;y<years.length;y++) {
		drawVoyages(dir+"/maury-"+years[y]+".png",years[y],years[y]+9);
	}
});