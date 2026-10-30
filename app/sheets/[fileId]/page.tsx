import StudioRoute from '@/components/StudioRoute';
export default async function SpreadsheetEditorPage({params}:{params:Promise<{fileId:string}>}){
 const {fileId}=await params;return <StudioRoute kind="sheet" fileId={fileId}/>;
}
