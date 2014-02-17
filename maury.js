var fs = require('fs'),
    readline = require('readline'),
		path = require('path'),
		PNG = require('pngjs').PNG;
  	dir = __dirname + '/imgs'

var myArgs = process.argv.slice(2);

var startYear = parseInt(myArgs[0]);
var endYear = parseInt(myArgs[1]);
var step = parseInt(myArgs[2]);

var filePath = path.join(__dirname + '/' + myArgs[3]);

var outputPath = dir + "/" + myArgs[4];

var width = 2000;
var height = 800;

var latRes = 0.01;
var lonRes = 0.01;

var latCenter = 0;
var latMax = 90;

var lonCenter = 180;
var lonMax = 360;

// voyages.txt format
// 21       1750    1750    0       -31.2   53.54   1       -31.63  50.99   1       -32.3   47.99   1       -32.93  44.83   1       -33.52  42.04   1       -34.08  40.74   1       -34.02  39.29   1       -34.28  39.24   1       -34.72  37.19   1       -34.800000000000004     36.410000000000004      1       -35.88  35.96   1       -36.550000000000004     35.31   1       -36.730000000000004     34.71   1       -36.35  34.88   1       -35.85  34.230000000000004      1       -35.88  32.04   1       -35.68  30.21   1       -34.97  30.09   1       -34.65  29.41   1       -36.050000000000004     26.34   1       -36     23.04   1       -35.45  22.39   1       -35.300000000000004     21.91
// tab separated
// line[0] shipid
// line[1] start of voyage
// line[2] end of voyage
// line[3+n*3] time form last sample
// line[3+n*3+1] lat
// line[3+n*3+2] lon

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

function dist2(x0,y0,x1,y1) {
	return (x0-x1)*(x0-x1)+(y0-y1)*(y0-y1);
}

console.log("reading points");

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

var voyages = [];

var voyagesCount = 0;

function drawVoyages(name,start,end) {
	var found = false;
	pts = {};

	for (var v=0;v<voyages.length;v++) {
		var voyage = voyages[v];
		if (voyage[1] <= end && voyage[2] >= start) {
			for (var p=3;p<voyage.length-5;p += 5) {
				var drawy0 = (height*0.5 - voyage[p+3]/latMax*height*0.5)|0;
				var drawx0 = ((voyage[p+4]/lonMax*width+3*width/4)%width)|0;
				var drawy1 = (height*0.5 - voyage[p+5+3]/latMax*height*0.5)|0;
				var drawx1 = ((voyage[p+5+4]/lonMax*width+3*width/4)%width)|0;
				if (dist2(drawx0,drawy0,drawx1,drawy1) < 400) {
				  found = true;
					draw_line(drawx0,drawy0,drawx1,drawy1);
				}
			}
		}
	}
	if (found)
		dump_png(name);
}

var lineCount = 0;

rd.on('line', function(line) {
	var varray = line.split("\t");
	varray[1] = parseInt(varray[1]);
	varray[2] = parseInt(varray[2]);
	
	if (varray[1] <= endYear && varray[2] >= startYear) {
		for (var i=3;i<varray.length;i+=5) {
			varray[i] = parseInt(varray[i]);
			varray[i+1] = parseInt(varray[i+1]);
			varray[i+2] = parseInt(varray[i+2]);
			varray[i+3] = parseFloat(varray[i+3]);
			varray[i+4] = parseFloat(varray[i+4]);
		}
		voyages.push(varray)
	}
	
	lineCount++;
	if (lineCount % 10000 == 0) {
		console.log("ingested voyage "+lineCount);
	}
}).on('close', function() {
	console.log("wrapping up");
	for (var y=startYear;y<=endYear;y += step) {
		var delta = step < (endYear - startYear + 1) ? step : (endYear - startYear + 1);
		drawVoyages(outputPath+y+".png",y,y+delta);
	}
});