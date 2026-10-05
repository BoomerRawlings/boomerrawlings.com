export type LectureResource = {
  kind:'slides'|'paper'|'video'; title:string; url?:string; optional?:boolean;
  slides?:LectureSlide[];
};
export type LectureSlide = {
  id:string; title:string; kicker?:string; takeaway:string;
  bullets:string[]; notes?:string; sourceIds:string[];
  source?:{title:string;page:number};
  reference?:{image:string;alt:string};
  visual:{kind:'model';topicId:string;representation?:string}|
    {kind:'lab';lab:'spike'|'summation'|'rate-code'|'methods'}|
    {kind:'figure';image:string;alt:string;caption?:string;hotspots?:{x:number;y:number;label:string;explanation:string}[]}|
    {kind:'comparison';prompt:string;choices:{label:string;explanation:string}[]};
};
export type Lecture = {
  id:string; number:number; title:string; week:string; summary:string;
  status:'awaiting-slides'|'ready'; topics:{label:string;topicId?:string}[];
  resources:LectureResource[]; slides:LectureSlide[];
};
export type LectureCourse = {
  version:1; id:string; title:string; instructor:string; term:string;
  moduleTitle:string; description:string;
  lectures:Lecture[];
  connections:{from:string;to:string;label:string;kind:'sequence'|'concept'}[];
  preview:{title:string;description:string;slides:LectureSlide[]};
};
