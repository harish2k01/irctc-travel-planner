import { afterEach,expect,it,vi } from "vitest";
import { sendWhatsApp } from "./railwatch-providers";
import { EMPTY_PLANNER,type Journey } from "./travel-planner";
vi.mock("./provider-config",()=>({getProviderConfiguration:async()=>({whatsapp:{accessToken:"fake-token",phoneNumberId:"12345",apiVersion:"v25.0",templateName:"booking_reminder",language:"en_US"}}),whatsappConfigured:()=>true}));
afterEach(()=>vi.unstubAllGlobals());
it("sends the configured template from the business sender to the account recipient",async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({messages:[{id:"accepted-message"}]})});vi.stubGlobal("fetch",fetch);
  const journey:Journey={id:"j",from:"Madurai",to:"Chennai",date:"2026-12-01",departure:"20:00",train:"",pnr:"",travelClass:"",windowDays:EMPTY_PLANNER.settings.bookingWindowDays,originOffset:0,status:"needs_booking",notes:""};
  expect(await sendWhatsApp("+919876543210",journey)).toBe("accepted-message");
  expect(fetch.mock.calls[0][0]).toBe("https://graph.facebook.com/v25.0/12345/messages");
  const request=fetch.mock.calls[0][1];expect(request.headers.Authorization).toBe("Bearer fake-token");const body=JSON.parse(request.body);expect(body.to).toBe("919876543210");expect(body.template.language.code).toBe("en_US");expect(body.template.components[0].parameters).toHaveLength(3);
});
