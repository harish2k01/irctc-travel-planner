import { expect,it } from "vitest";
import { ticketPdfText,ticketOcrText } from "./ticket-pdf-text";
import { parseTicketDetails } from "./ticket-details";
const item=(str:string,x:number,y:number)=>({str,transform:[1,0,0,1,x,y]});
it("reads visually aligned ticket columns even when PDF emission order is interleaved",()=>{const text=ticketPdfText([item("B2",20,86),item("Coach Number",20,100),item("21:45",350,86),item("Scheduled Departure*",350,100),item("56",140,86),item("Seat Number",140,100),item("Berth Type",240,100),item("LOWER",240,86)]);expect(parseTicketDetails(text)).toMatchObject({coach:"B2",seat:"56",berth:"LOWER",departure:"21:45"});});
it("does not join unrelated values across a large vertical gap",()=>{expect(parseTicketDetails(ticketPdfText([item("Coach Number",20,100),item("B2",20,40)]))).not.toHaveProperty("coach");});
it("extracts scanned ticket columns and passenger allocation from positioned OCR words",()=>{
 const words=[{str:"Train No./Name",x:200,y:100},{str:"Class",x:500,y:100},{str:"12345 / SAMPLE EXPRESS",x:200,y:120},{str:"SLEEPER CLASS (SL)",x:500,y:120}];
 const tsv=words.map(w=>[5,1,1,1,1,1,w.x,w.y,100,12,95,w.str].join("\t")).join("\n");
 const text=ticketOcrText(tsv)+"\nStart Date* 01-Dec-2026 Departure* 23:10 01-Dec-2026\nCNF/S2/17/UPPER";
 expect(parseTicketDetails(text)).toMatchObject({trainNumber:"12345",travelClass:"SL",date:"2026-12-01",departure:"23:10",coach:"S2",seat:"17",berth:"UPPER"});
});
