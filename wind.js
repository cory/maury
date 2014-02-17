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

var lonCenter = 0;
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

var lat, lon, year, month, winddir, windspeed;
var drawx, drawy;
var lastyear = -1000000;

var pts = {};
var wind = {};

function pt2idx(x,y) {
 	return (width * y + x) << 2;
}

function addPoint(x,y, color) {
	var idx = pt2idx(x,y);
	if (idx in pts) {
		if (pts[idx].color < color)
			pts[idx].color = color;
	} else {
		pts[idx] = {count:1,x:x,y:y,color:color};
	}
}

function draw_line(x0, y0, x1, y1, color) {
	var dx = Math.abs(x1-x0);
	var dy = Math.abs(y1-y0);
	var sx = (x0 < x1) ? 1 : -1;
	var sy = (y0 < y1) ? 1 : -1;
	var err = dx-dy;

	while(true){
		addPoint(x0,y0,color);
		if (((x0|0) == (x1|0)) && ((y0|0)==(y1|0))) 
			break;
		var e2 = 2*err;
		if (e2 >= -dy){ err -= dy; x0  += sx; }
		if (e2 <= dx){ err += dx; y0  += sy; }
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
	    png.data[idx ] = 0x00;
	    png.data[idx+1] = 0x00;
	    png.data[idx+2] = 0x00;
	    png.data[idx+3] = 0xff;
		}
	}
	for (idx in pts) {
		idx = idx|0;
		png.data[idx  ] = pts[idx].color;
		png.data[idx+1] = pts[idx].color;
		png.data[idx+2] = pts[idx].color;
	}
	console.log("writing image");
	png.pack().pipe(fs.createWriteStream(name));
}

var maxwind = 0;

function wind2pts(month) {
	console.log("drawing wind");
	pts = {};
	for (var idx in wind) {
		var w = wind[idx][month];
		if (w) {
				var dx = w.wx/w.count;
				var dy = w.wy/w.count;
				var speed = dx*dx+dy*dy;
				var color = speed/maxwind/maxwind;
				if (color > 1)
					color = 1;
				dx = dx|0;
				dy = dy|0;
				draw_line(w.x,w.y,w.x+dx,w.y+dy,(0xff*color)|0);
			}
		}
}

function addWind(month,x,y,wd,w) {
	var wx,wy;
	wd -= 90;
	wx = w * Math.cos(wd/180*Math.PI);
	wy = w * Math.sin(wd/180*Math.PI);
	var idx = pt2idx(x,y);
	if (idx in wind) {
		  if (month in wind[idx]) {
				wind[idx][month].count++;
				wind[idx][month].wx += wx;
				wind[idx][month].wy += wy;
			} else {
				wind[idx][month] = {count:1,x:x,y:y,wx:wx,wy:wy};
			}
	} else {
		wind[idx] = {};
		wind[idx][month] = {count:1,x:x,y:y,wx:wx,wy:wy};
	}
}

rd.on('line', function(line) {
	year = parseInt(line.slice(0,4));
	month = parseInt(line.slice(4,6));
	lat = parseInt(line.slice(12,17));
	lon = parseInt(line.slice(17,23));
	winddir = parseInt(line.slice(46,49))-2;
	windspeed = parseInt(line.slice(50,53))/20;
	
	if (windspeed*0.9 > maxwind)
		maxwind = windspeed*0.9;

	drawy = (height*0.5 - lat*latRes/latMax*height*0.5)|0;
	drawx = ((lon*lonRes/lonMax*width+3*width/4)%width)|0;
	if (winddir === winddir && windspeed === windspeed && month == month) {
		addWind(month,drawx,drawy,winddir,windspeed);		
	}
	lastx=drawx;
	lasty=drawy;
}).on('close', function() {
	for (var m=1;m<=12;m++) {
		wind2pts(m);
		dump_png(dir+"/maury_"+m+".png");
	}
});