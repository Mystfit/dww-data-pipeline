/**
* Processing code that displays:
*
* > Company dialog box( company name, roles selected, maximum density ) 
* > Current time beneath the time slider
* 
* This particular sketch will sit atop the GE Plugin and will display content only. (i.e. unclickable) 
**/

/* @pjs transparent=true; */ 
/* @pjs preload="images/pMan.png"; */

var studioName; // the name of the studio we are currently observing, or null if no studio is being observed
var timeLabel; // the year or period of time we are currently observing 
var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
PFont helvetica; // the font used to write the studio name to the screen
color fontCol = color(255); // the colour of the font  
color boxCol = color(150);
color boxStroke = color(120);
int displayAlpha = 0; // the alpha of the font 
int maxAlpha = 60; // the maximum amount of opacity

int densityReportTotal; // the number of people at the current studioName at the current time

PImage populationMan;  

void setup(){
	$(document).ready(function(){
		size(window.innerWidth, window.innerHeight);
		smooth();
		hud = Processing.getInstanceById('hudCanvas');
		helvetica = createFont("Helvetica");
		textFont(helvetica, 32);
		rectMode(CENTER);
		imageMode(CENTER);
		studioName = null;
		densityReportTotal = 0; 
		updateTime(vizTimeStart);
		populationMan = loadImage("images/pMan.png");
	});
}

void draw(){
	if(!ge) return; //wait until the google earth plugin has successfully loaded 
	background(0,0,0,0);
	drawStudioDisplay(); 
	if(timeLabel) write(timeLabel, width*(0.1125), height/5.0, CENTER, 16); //write time label in keeping with css alignment of time slider 
}

/**
* Handles the drawing of the studio information dialog.
**/
void drawStudioDisplay(){
	pushStyle();
	//draw display box 
	fill(boxCol, displayAlpha);
	stroke(boxStroke, displayAlpha);
	rect(width/2.0, height*7/8.0, width/2.0, height*2/8.0, 20);
	if(studioName){
		fill(fontCol, map(displayAlpha, 0, maxAlpha, 0, 255));
		displayAlpha = displayAlpha >= maxAlpha ? maxAlpha : displayAlpha + 5; 
		write(studioName, width/2.0, height*(0.8), CENTER, 32); //write studio name to bottom center
		//if interactive mode is on, draw the year and the currently selected roles 
		if(interactiveMode){
			write(getTime("year")[0], width/2.0, height*(0.85), CENTER, 24);
			drawDensity(densityReportTotal, width/2.0, height*(0.875));
			//drawRoleBuckets(densityReport);
		}
	} 
	else{
		displayAlpha = displayAlpha <= 0 ? 0 : displayAlpha - 5; 
	}
	popStyle();
}


/**
* Writes a string of text onto the screen.
*
* @param word - the text to be displayed 
* @param xpos - the horizontal point to anchor the text
* @param ypos - the vertical point to anchor the text
* @param alignment - the alignment through which xpos and ypos are interpreted 
* @param fSize - the size of the font 
**/
void write(String word, float xpos, float ypos, String alignment, int fSize){
	textAlign(alignment);
	textSize(fSize);
	text(word, xpos, ypos);
}

/**
* Draws human iconography to the screen to represent population density. The
* number of humans drawn depends upon the number of the population input. 
*
* @param population - the number specifying the amount of humans to draw (greater => more) 
* @param xpos - float specifying where to center horizontally
* @param ypos - float specifying where to center vertically  
**/
void drawDensity(int population, float xpos, float ypos){
	int drawNum = floor(log(population) / log(3.0)); //calculation to get within appropriate range 
	float imgSize = 40; //pixels 
	float x = xpos - (drawNum-1)*imgSize;
	tint(fontCol, map(displayAlpha, 0, maxAlpha, 0, 180));
	for(int i=0; i<drawNum; i++){
		image(populationMan, x, ypos, imgSize, imgSize);
		x += imgSize*2; 
	}
}


/**
* Sets the current studio name to the String parameter 's'. 
* Note: erasing the current studio name can be achieved by making s == "".
*
* @param s - the studioName to update the display with.
* @returns true if name has been successfully set.  
**/
boolean setStudioName(String s){
	if(s == undefined) return false;
	studioName = s;
	return true;
}

/**
* Updates the current density of the current studio to be integer parameter 'i'.
*
* @param i - the integer representing this studio's density 
* @returns true if name has been successfully set. 
**/
boolean updateDensityTotal(int i){
	if(i == undefined) return false;
	densityReportTotal = i;
	return true;
}

/**
* Sets the current timeLabel to a string that indicates a time, or a period of time. 
* Note: no parameters clears the display. 
*
* @param timeBegin - [OPT] the time to display, or the first time in a span.
* @param timeEnd - [OPT] the last time in a span to display. 
* @returns true if the time has been successfully updated. 
**/
boolean updateTime(String timeBegin, String timeEnd){
	if(!timeBegin) {
		timeLabel = "";
		currentYear = "";
		return true;
	}
	var belements = timeBegin.split('-');
	var byear = belements[0];
	var bmonth = months[parseInt(belements[1])-1]; 
	timeLabel = bmonth + ", " + byear; 
	if(!timeEnd) return true;
	timeLabel += "  --->  ";
	var eelements = timeEnd.split('-');
	var eyear = eelements[0];
	var emonth = months[parseInt(eelements[1])-1];
	timeLabel += emonth + ", " + eyear; 
	return true;
}

/**
* Dynamically resize the Processing canvas upon a $(window).resize() event.
**/
$(window).resize(function() {
    hud.size(window.innerWidth, window.innerHeight);
});