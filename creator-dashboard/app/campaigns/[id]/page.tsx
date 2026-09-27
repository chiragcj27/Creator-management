import { Suspense } from "react";
import CampaignDetail from "../../components/CampaignDetail";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <CampaignDetail id={id} />
    </Suspense>
  );
}
