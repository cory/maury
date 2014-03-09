var exec = require('child_process').exec;

for (var i=1660;i<=1850;i+=10) {
	i=i|0;
	exec("gm convert -font Helvetica -pointsize 32 -fill white -draw \'text 1900,780 \""+i+"\"\' imgs/animate-"+i+"-1660.png imgs/annotated-"+i+".png")
}
