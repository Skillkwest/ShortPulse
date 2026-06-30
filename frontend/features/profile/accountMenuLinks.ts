/**
 * Shared account-menu navigation targets for authenticated app surfaces.
 */

export type AccountMenuLink = {
  href: string;
  label: string;
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
