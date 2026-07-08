/**
 * Shared account-menu navigation targets for authenticated app surfaces.
 */
import { CUSTOMER_SUPPORT_LABEL, CUSTOMER_SUPPORT_MAILTO_HREF } from "../../lib/customerSupport";
import type { ProfileSection } from "./profilePageModel";
import { buildProfileSectionHref } from "./profileNavigation";

export type AccountMenuLink = {
  href: string;
  label: string;
};

type AccountMenuLinkDefinition = {
  hash?: string;
  label: string;
  section: ProfileSection;
};

/**
 * Mail link for direct customer support from authenticated account menus.
 */
export const CUSTOMER_SUPPORT_MENU_LINK: AccountMenuLink = {
  href: CUSTOMER_SUPPORT_MAILTO_HREF,
  label: CUSTOMER_SUPPORT_LABEL,
};

/**
 * Canonical profile-section links shown from account menus.
 */
const ACCOUNT_MENU_LINK_DEFINITIONS: AccountMenuLinkDefinition[] = [
  { section: "account", label: "Account settings" },
  { section: "account", hash: "billing", label: "Billing" },
  { section: "subscription", label: "Subscription" },
  { section: "credits", label: "Credits" },
  { section: "storage", label: "Storage" },
  { section: "transactions", label: "Transactions" },
];

/**
 * Builds the canonical profile-section links shown from account menus.
 */
export const buildAccountMenuLinks = (options: { fromPath?: unknown } = {}): AccountMenuLink[] =>
  ACCOUNT_MENU_LINK_DEFINITIONS.map((item) => ({
    href: buildProfileSectionHref({
      section: item.section,
      fromPath: options.fromPath,
      hash: item.hash,
    }),
    label: item.label,
  }));

export const ACCOUNT_MENU_LINKS: AccountMenuLink[] = buildAccountMenuLinks();
