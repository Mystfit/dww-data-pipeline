/**
* Processing script that creates a time control widget to scrub through the animation. 
* This widget replaces the in-built GE TimeControl object. 
**/

/* @pjs transparent=true; */

void setup(){
	$(document).ready(function(){
		timeUI = Processing.getInstanceById('timeControl');
		size(timeUI.innerWidth, timeUI.innerHeight);
		smooth();
		$(function(){
			$("#timeControl").slider();
		});
	});
}

void draw(){

}

/**
* Dynamically resize the Processing canvas upon a $(window).resize() event.
**/
$(window).resize(function() {
    timeUI.size(window.innerWidth, window.innerHeight);
});