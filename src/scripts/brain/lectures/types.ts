export type LectureResource = {
  kind:'slides'|'paper'|'video'; title:string; url?:string; optional?:boolean;
  slides?:LectureSlide[];
};
export type LecturePresentation = {
  title:string;eyebrow?:string;layout:'title'|'text'|'split'|'gallery'|'comparison';
  groups:{title?:string;items:string[]}[];
  figures:{image:string;alt:string;caption?:string}[];
  takeaway?:string;
};
export type LectureSlide = {
  id:string; title:string; kicker?:string; takeaway:string;
  bullets:string[]; notes?:string; sourceIds:string[];
  source?:{title:string;page:number};
  reference?:{image:string;alt:string};
  presentation?:LecturePresentation;
  teaching?:{
    steps:{title:string;explanation:string;region?:{x:number;y:number;width:number;height:number}}[];
    demo?:{label:string;purpose:string;kind:'existing'|'propagation'};
  };
  visual:{kind:'none'}|{kind:'model';topicId:string;representation?:string}|
    {kind:'lab';lab:'spike'|'summation'|'rate-code'|'methods'|'propagation'}|
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
