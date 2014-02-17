// gm - Copyright Aaron Heckmann <aaron.heckmann+github@gmail.com> (MIT Licensed)

var gm = require('gm')
  , dir = __dirname + '/imgs'

var years = [1660,1670,1690,1740,1750,1760,1770,1780,1790,1800,1810,1820,1830,1840,1850,1860,1870,1880,1890,1900,1910,1920,1930,1940];

for (var y=0;y<years.length;y++) {
	gm(dir + '/maury-'+years[y]+'.png')
		.blur(3,2)
	  .write(dir + '/maury-blur-'+years[y]+'.png', function(err){
	    if (err) return console.dir(arguments)
	    console.log(this.outname + ' created :: ' + arguments[3])
	  }
	)}

