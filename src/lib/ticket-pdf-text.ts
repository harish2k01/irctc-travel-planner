type TextItem={str:string;transform:number[]};
const LABELS:Record<string,string>={bookedfrom:"From",boardingat:"Boarding Station",currentstatus:"Current Status",pnr:"PNR",pnrnumber:"PNR",pnrno:"PNR",trainnoname:"Train No./Name",trainnumbername:"Train No./Name",trainname:"Train Name",trainno:"Train No",class:"Class",dateofjourney:"Date of Journey",journeydate:"Journey Date",boardingdate:"Boarding Date",from:"From",to:"To",boardingstation:"Boarding Station",scheduleddeparture:"Scheduled Departure",departuretime:"Departure Time",boardingtime:"Boarding Time",coach:"Coach",coachno:"Coach",coachnumber:"Coach",seatno:"Seat No",seatnumber:"Seat No",berthtype:"Berth"};
// PDF emission order does not necessarily follow visible rows or columns.
/** Reconstructs visible PDF rows and aligns header columns with their values. */
export function ticketPdfText(items:TextItem[]):string{
 const lines:{y:number;items:{x:number;text:string}[]}[]=[];
 for(const item of items){const y=item.transform[5],x=item.transform[4];let line=lines.find(line=>Math.abs(line.y-y)<=3);if(!line){line={y,items:[]};lines.push(line);}line.items.push({x,text:item.str});}
 lines.sort((a,b)=>b.y-a.y);for(const line of lines)line.items.sort((a,b)=>a.x-b.x);
 const fields:string[]=[];
 for(let index=0;index<lines.length;index++){
  const line=lines[index],headers:{x:number;label:string}[]=[];
  for(let start=0;start<line.items.length;start++){
   let found:{label:string;end:number}|undefined;
   for(let end=start;end<Math.min(start+4,line.items.length);end++){
    if(end>start&&line.items[end].x-line.items[end-1].x>90)break;
    const label=LABELS[line.items.slice(start,end+1).map(item=>item.text).join("").toLowerCase().replace(/[^a-z0-9]/g,"")];
    if(label)found={label,end};
   }
   if(found){headers.push({x:line.items[start].x,label:found.label});start=found.end;}
  }
  // Extract only recognizable headers with values on the next visible row.
  const next=lines[index+1];if(!next||line.y-next.y>36)continue;
  for(let column=0;column<headers.length;column++){
   const header=headers[column];const left=column===0?header.x-24:(headers[column-1].x+header.x)/2;
   const right=headers[column+1]?(header.x+headers[column+1].x)/2:Infinity;
   const values=next.items.filter(item=>item.x>=left&&item.x<right&&!LABELS[item.text.toLowerCase().replace(/[^a-z0-9]/g,"")]);
   if(values.length)fields.push(`${header.label}: ${values.map(item=>item.text).join(" ")}`);
  }
 }
 return [...fields,...lines.map(line=>line.items.map(item=>item.text).join(" "))].join("\n");
}

/** Converts positioned OCR words into the same row-and-column parsing format. */
export function ticketOcrText(tsv:string):string{
 const items:TextItem[]=tsv.split("\n").flatMap(line=>{const cells=line.split("\t");if(cells[0]!=="5"||!cells[11]?.trim())return [];const x=Number(cells[6])/2,y=-Number(cells[7])/2;if(!Number.isFinite(x)||!Number.isFinite(y))return [];return [{str:cells.slice(11).join("\t"),transform:[1,0,0,1,x,y]}];});
 return ticketPdfText(items);
}
