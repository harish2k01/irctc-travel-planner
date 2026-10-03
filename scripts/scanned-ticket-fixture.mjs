// Synthetic image-only PDF for browser OCR regression coverage; no real passenger data.
export async function scannedTicketFixture(context,date,pages=1){
 const page=await context.newPage();
 let jpeg;
 try{
  await page.setViewportSize({width:1000,height:700});
  await page.setContent(`<html><body style="margin:40px;background:white;color:black;font:24px monospace;line-height:1.8"><h2>Electronic Reservation Slip</h2><div>PNR: 1234567890</div><div>Train No: 12345</div><div>Train Name: SAMPLE EXPRESS</div><div>From: Madurai</div><div>To: Chennai</div><div>Journey Date: ${date}</div><div>Class: SL</div><div>Departure: 23:10</div><div>Current Status: CNF/S2/17/UPPER</div></body></html>`);
  jpeg=await page.screenshot({type:"jpeg",quality:95});
 }finally{await page.close();}
 const chunks=[Buffer.from("%PDF-1.4\n")],offsets=[0];let length=chunks[0].length;
 const append=value=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(value);chunks.push(bytes);length+=bytes.length;};
 const object=(id,body)=>{offsets[id]=length;append(`${id} 0 obj\n`);append(body);append("\nendobj\n");};
 object(1,"<< /Type /Catalog /Pages 2 0 R >>");object(2,`<< /Type /Pages /Kids [3 0 R ${Array.from({length:pages-1},(_,i)=>`${i+6} 0 R`).join(" ")}] /Count ${pages} >>`);
 object(3,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 700] /Resources << /XObject << /Image 4 0 R >> >> /Contents 5 0 R >>");
 object(4,Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 1000 /Height 700 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,Buffer.from("\nendstream")]));
 const draw="q 1000 0 0 700 0 0 cm /Image Do Q";object(5,`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
 for(let i=0;i<pages-1;i++)object(i+6,"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 700] /Resources << /XObject << /Image 4 0 R >> >> /Contents 5 0 R >>");
 const xref=length;append(`xref\n0 ${pages+5}\n0000000000 65535 f \n`);for(const offset of offsets.slice(1))append(`${String(offset).padStart(10,"0")} 00000 n \n`);
 append(`trailer\n<< /Size ${pages+5} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);return Buffer.concat(chunks);
}
