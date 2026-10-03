import { describe,expect,it } from "vitest";
import { quietHoursResume } from "./notification-controls";
import { plannerSchema,EMPTY_PLANNER } from "./travel-planner";

describe("IST quiet hours",()=>{
  const overnight={enabled:true,start:"22:00",end:"07:00"};
  it("resumes an overnight window on the correct local day and excludes its end",()=>{
    expect(quietHoursResume(overnight,new Date("2026-10-03T22:00:00+05:30"))?.toISOString()).toBe("2026-10-04T01:30:00.000Z");
    expect(quietHoursResume(overnight,new Date("2026-10-04T06:59:00+05:30"))?.toISOString()).toBe("2026-10-04T01:30:00.000Z");
    expect(quietHoursResume(overnight,new Date("2026-10-04T07:00:00+05:30"))).toBeNull();
    expect(quietHoursResume(overnight,new Date("2026-10-03T21:59:00+05:30"))).toBeNull();
  });
  it("handles daytime windows, absent preferences, and disabled windows",()=>{
    const now=new Date("2026-10-03T09:30:00+05:30");
    expect(quietHoursResume({enabled:true,start:"09:00",end:"10:00"},now)?.toISOString()).toBe("2026-10-03T04:30:00.000Z");
    expect(quietHoursResume(undefined,now)).toBeNull();
    expect(quietHoursResume({...overnight,enabled:false},now)).toBeNull();
  });
  it("keeps old workspaces valid and rejects an enabled all-day window",()=>{
    expect(plannerSchema.safeParse(EMPTY_PLANNER).success).toBe(true);
    expect(plannerSchema.safeParse({...EMPTY_PLANNER,settings:{...EMPTY_PLANNER.settings,quietHours:{enabled:true,start:"07:00",end:"07:00"}}}).success).toBe(false);
  });
});
