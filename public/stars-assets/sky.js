/* Local astronomy for Scripps Pier. SunCalc 2.1.1, MIT (see license).
   Events are absolute instants. UTC event days avoid host-zone and DST errors;
   the display separately formats every event in America/Los_Angeles. */
(function (root) {
    'use strict';
    var DAY=86400000,LAT=32.8663,LON=-117.2546;
    var eventDay=null,events=[],phaseMinute=null,illumination;
    var names=['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
    root.scrippsSky=function(now){
        var ms=now.getTime(),day=Math.floor(ms/DAY);
        if(day!==eventDay){
            events=[];
            // Cover the entire sunset-to-sunrise interval on both sides of UTC
            // midnight. Explicit UTC offsets also make host time zones irrelevant.
            for(var i=-2;i<=3;i++){
                var date=new Date((day+i)*DAY+DAY/2);
                var sun=SunCalc.getTimes(date,LAT,LON,0,0),moon=SunCalc.getMoonTimes(date,LAT,LON,0);
                [['sunrise',sun.sunrise],['sunset',sun.sunset],['peak',moon.transit]].forEach(function(pair){
                    if(pair[1] && Number.isFinite(pair[1].getTime()))events.push({type:pair[0],ms:pair[1].getTime()});
                });
            }
            events.sort(function(a,b){return a.ms-b.ms;});eventDay=day;
        }
        if(phaseMinute!==Math.floor(ms/60000)){
            illumination=SunCalc.getMoonIllumination(now);phaseMinute=Math.floor(ms/60000);
        }
        var lastSolar=events.filter(function(e){return e.type!=='peak' && e.ms<=ms;}).pop();
        function next(type){var e=events.find(function(e){return e.type===type && e.ms>ms;});return e?e.ms:null;}
        var night=!!lastSolar && lastSolar.type==='sunset';
        var sunrise=next('sunrise'),sunset=next('sunset');
        var nightStart=night?lastSolar.ms:null,nightEnd=night?sunrise:null;
        // Select this night's upper transit, even after it has passed. Looking
        // for the next transit after "now" would reset the countdown at the peak
        // or midnight, and can incorrectly choose tomorrow afternoon's transit.
        var transit=night?events.find(function(e){
            return e.type==='peak' && e.ms>=nightStart && e.ms<nightEnd;
        }):null;
        var peak=transit?transit.ms:null;
        var stage=!night?'day':peak!==null && ms<peak?'moonpeak':'sunrise';
        return {
            night:night,sunrise:sunrise,sunset:sunset,peak:peak,
            stage:stage,target:stage==='day'?sunset:stage==='moonpeak'?peak:sunrise,
            nightStart:nightStart,nightEnd:nightEnd,
            phase:illumination.phase,fraction:illumination.fraction,
            phaseName:names[Math.round(illumination.phase*8)%8]
        };
    };
})(typeof window!=='undefined'?window:globalThis);
