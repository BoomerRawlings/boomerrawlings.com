"""Boundary tests target DST omissions, repeated hours, and accumulation alignment."""
import datetime as dt
import unittest
from acquire_civil_weather import boundaries, instantaneous, accumulated, LOCAL, UTC

class CivilTests(unittest.TestCase):
    def test_spring_forward(self):
        a,b=boundaries(dt.date(2021,3,14))
        self.assertEqual(dt.datetime.fromtimestamp(a,UTC).isoformat(),'2021-03-14T08:00:00+00:00')
        self.assertEqual(dt.datetime.fromtimestamp(b,UTC).isoformat(),'2021-03-15T07:00:00+00:00')
        self.assertEqual((b-a)//3600,23)
    def test_fall_repeated_hour(self):
        a,b=boundaries(dt.date(2021,11,7))
        self.assertEqual((b-a)//3600,25)
        local=[dt.datetime.fromtimestamp(t,UTC).astimezone(LOCAL) for t in range(a,b,3600)]
        repeated=[v for v in local if v.hour==1]
        self.assertEqual([v.fold for v in repeated],[0,1])
        self.assertEqual([v.utcoffset().total_seconds()/3600 for v in repeated],[-7,-8])
    def test_standard_and_daylight_midnights(self):
        winter=boundaries(dt.date(2024,1,1));summer=boundaries(dt.date(2024,7,1))
        self.assertEqual(dt.datetime.fromtimestamp(winter[0],UTC).hour,8)
        self.assertEqual(dt.datetime.fromtimestamp(summer[0],UTC).hour,7)
        self.assertEqual([b-a for a,b in [winter,summer]],[86400,86400])
    def test_precipitation_uses_hour_ending_not_hour_start(self):
        a,b=boundaries(dt.date(2021,3,14));stamps=list(range(a,b+3600,3600))
        h={'value':list(range(len(stamps)))};index={t:i for i,t in enumerate(stamps)}
        self.assertEqual(instantaneous(h,index,'value',a,b),list(range(23)))
        self.assertEqual(accumulated(h,index,'value',a,b),list(range(1,24)))
        self.assertEqual(sum(accumulated(h,index,'value',a,b)),276)

if __name__=='__main__':unittest.main()
