import {BRANCHES,normalizePlate, type BranchId,type Role} from './data';

/** PB vehicle details are optional; the plate and authorized branch drive POS/COGS association. */
export function partsPurchaseHeaderIssue(details:{
 branch:BranchId;assignedBranch:BranchId;plate:string;vehicleYear:string;role?:Role;
},currentYear=new Date().getFullYear()):string|null {
 if(!BRANCHES.some(b=>b.id===details.branch))return 'Select a valid purchase branch.';
 // PB handles purchases for every configured branch; other staff stay assigned-branch only.
 if(details.role!=='pb'&&details.branch!==details.assignedBranch)return 'You may record parts purchases only for your assigned branch.';
 if(!normalizePlate(details.plate))return 'Plate number is required to match parts with the correct POS.';
 const year=details.vehicleYear.trim();
 if(year&&(!/^[0-9]{4}$/.test(year)||Number(year)<1950||Number(year)>currentYear+1))return 'Enter a valid year or leave Year blank.';
 return null;
}
