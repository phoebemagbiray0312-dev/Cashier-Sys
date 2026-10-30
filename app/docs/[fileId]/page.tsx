import StudioRoute from '@/components/StudioRoute';
export default async function DocumentEditorPage({params}:{params:Promise<{fileId:string}>}){
 const {fileId}=await params;return <StudioRoute kind="document" fileId={fileId}/>;
}
