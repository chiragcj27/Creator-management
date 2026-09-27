import { Suspense } from "react";
import CampaignsBoard from "../components/CampaignsBoard";

export default function CampaignsPage() {
  return (
    <Suspense>
      <CampaignsBoard />
    </Suspense>
  );
}
