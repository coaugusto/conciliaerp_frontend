import { redirect } from "next/navigation";
export default async function EditPage({ params }: { params: Promise<{ section: string; id: string }> }) { const { section, id } = await params; redirect(`/${section}/${id}`); }
