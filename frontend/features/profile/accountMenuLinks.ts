/**
 * Shared account-menu navigation targets for authenticated app surfaces.
 */
import { CUSTOMER_SUPPORT_LABEL, CUSTOMER_SUPPORT_MAILTO_HREF } from "../../lib/customerSupport";

export type AccountMenuLink = {
  href: string;
  label: string;
};

/**
 * Mail link for direct customer support from authenticated account menus.
 */
export const CUSTOMER_SUPPORT_MENU_LINK: AccountMenuLink = {
  href: CUSTOMER_SUPPORT_MAILTO_HREF,
  label: CUSTOMER_SUPPORT_LABEL,
};

/**
 * Returns the canonical profile-section links shown from account menus.
 */
export const ACCOUNT_MENU_LINKS: AccountMenuLink[] = [
  { href: "/profile?section=account", label: "Account settings" },
  { href: "/profile?section=account#billing", label: "Billing" },
  { href: "/profile?section=subscription", label: "Subscription" },
  { href: "/profile?section=credits", label: "Credits" },
  { href: "/profile?section=storage", label: "Storage" },
  { href: "/profile?section=transactions", label: "Transactions" },
];
