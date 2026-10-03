import { afterEach,expect,it,vi } from "vitest";
import { animateView } from "@/components/travel-planner/view-motion";

afterEach(()=>vi.unstubAllGlobals());
it("skips reduced motion and browsers without animation support",()=>{
  const animate=vi.fn();vi.stubGlobal("window",{matchMedia:()=>({matches:true})});
  animateView({animate} as unknown as HTMLElement)();
  animateView(null)();animateView({} as HTMLElement)();
  expect(animate).not.toHaveBeenCalled();
});
it("cancels the active fade when motion preferences change and cleans up on switching",()=>{
  const preference={matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()};
  const cancel=vi.fn(),animate=vi.fn(()=>({cancel}));
  vi.stubGlobal("window",{matchMedia:()=>preference});
  const cleanup=animateView({animate} as unknown as HTMLElement);
  expect(animate).toHaveBeenCalledWith([{opacity:0.65},{opacity:1}],expect.objectContaining({duration:160}));
  preference.matches=true;preference.addEventListener.mock.calls[0][1]();
  expect(cancel).toHaveBeenCalledTimes(1);cleanup();
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(preference.removeEventListener).toHaveBeenCalledWith("change",preference.addEventListener.mock.calls[0][1]);
});
