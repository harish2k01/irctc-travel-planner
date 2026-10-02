export type FeaturePolicy = {allowSignups:boolean;bookingWindowDays:number;remindersEnabled:boolean;whatsappEnabled:boolean;googleCalendarEnabled:boolean;ticketUploadsEnabled:boolean;calendarExportEnabled:boolean};
export type UserProfile = {id:string;name:string;email:string;phoneNumber:string;role:"ADMIN"|"USER";policy:FeaturePolicy};
