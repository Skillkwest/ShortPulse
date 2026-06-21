import { LegalPolicyPage } from "../features/legal/components/LegalPolicyPage";
import {
  createLegalPolicyServerSideProps,
  type LegalPolicyPageProps,
} from "../features/legal/server/legalPolicyContent";

export const getServerSideProps = createLegalPolicyServerSideProps("terms");

export default function TermsPage(props: LegalPolicyPageProps) {
  return <LegalPolicyPage {...props} />;
}
