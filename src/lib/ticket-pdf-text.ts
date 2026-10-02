type TextItem={str:string;transform:number[]};
const LABELS:Record<string,string>={pnr:"PNR",pnrnumber:"PNR",pnrno:"PNR",trainnoname:"Train No./Name",trainnumbername:"Train No./Name",trainname:"Train Name",trainno:"Train No",class:"Class",dateofjourney:"Date of Journey",journeydate:"Journey Date",boardingdate:"Boarding Date",from:"From",to:"To",boardingstation:"Boarding Station",scheduleddeparture:"Scheduled Departure",departuretime:"Departure Time",boardingtime:"Boarding Time",coach:"Coach",coachno:"Coach",coachnumber:"Coach",seatno:"Seat No",seatnumber:"Seat No",berthtype:"Berth"};
// PDF emission order does not necessarily follow visible rows or columns.
export function ticketPdfText(items:TextItem[]):string{
 const lines:{y:number;items:{x:number;text:string}[]}[]=[];
 for(const item of items){const y=item.transform[5],x=item.transform[4];let line=lines.find(line=>Math.abs(line.y-y)<=3);if(!line){line={y,items:[]};lines.push(line);}line.items.push({x,text:item.str});}
 lines.sort((a,b)=>b.y-a.y);for(const line of lines)line.items.sort((a,b)=>a.x-b.x);
 const fields:string[]=[];
 for(let index=0;index<lines.length;index++){
  const line=lines[index],headers=line.items.map(item=>({...item,label:LABELS[item.text.toLowerCase().replace(/[^a-z0-9]/g,"")]})).filter(item=>item.label);
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
