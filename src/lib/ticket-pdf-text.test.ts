import { expect,it } from "vitest";
import { ticketPdfText } from "./ticket-pdf-text";
import { parseTicketDetails } from "./ticket-details";
const item=(str:string,x:number,y:number)=>({str,transform:[1,0,0,1,x,y]});
it("reads visually aligned ticket columns even when PDF emission order is interleaved",()=>{const text=ticketPdfText([item("B2",20,86),item("Coach Number",20,100),item("21:45",350,86),item("Scheduled Departure*",350,100),item("56",140,86),item("Seat Number",140,100),item("Berth Type",240,100),item("LOWER",240,86)]);expect(parseTicketDetails(text)).toMatchObject({coach:"B2",seat:"56",berth:"LOWER",departure:"21:45"});});
it("does not join unrelated values across a large vertical gap",()=>{expect(parseTicketDetails(ticketPdfText([item("Coach Number",20,100),item("B2",20,40)]))).not.toHaveProperty("coach");});
