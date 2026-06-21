import { LegalPolicyPage } from "../features/legal/components/LegalPolicyPage";
import {
  createLegalPolicyServerSideProps,
  type LegalPolicyPageProps,
} from "../features/legal/server/legalPolicyContent";

export const getServerSideProps = createLegalPolicyServerSideProps("refund-policy");

export default function RefundPolicyPage(props: LegalPolicyPageProps) {
  return <LegalPolicyPage {...props} />;
}
