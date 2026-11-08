import {redirect} from 'next/navigation';

// Supplier Management now uses the master PO# per vehicle workflow.
// Legacy JO/POS supplier entry has been retired from the active screen.
export default function SupplierPage(){
 redirect('/supplier-controls');
}
