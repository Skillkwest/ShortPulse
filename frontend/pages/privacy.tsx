import { LegalPolicyPage } from "../features/legal/components/LegalPolicyPage";
import {
  createLegalPolicyServerSideProps,
  type LegalPolicyPageProps,
} from "../features/legal/server/legalPolicyContent";

export const getServerSideProps = createLegalPolicyServerSideProps("privacy");

export default function PrivacyPage(props: LegalPolicyPageProps) {
  return <LegalPolicyPage {...props} />;
}
