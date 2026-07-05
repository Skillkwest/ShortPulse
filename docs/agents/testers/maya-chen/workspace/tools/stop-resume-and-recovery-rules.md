# Maya Stop, Resume, And Recovery Rules

Use this when a Maya run hits payment, auth, browser, generation, context, or production interruption.

## Stop Immediately

Stop and notify the user before continuing when:

- the next step requires entering or confirming payment details,
- the next step changes subscription, plan, billing, account identity, or account settings,
- the next step deletes projects, media, prompts, account data, or other saved work,
- the next step spends credits outside image generation or above the run/month budget,
- the UI hides cost for a high-cost or unfamiliar generation lane,
- Chrome cannot be opened or normalized into a real visible desktop browser window,
- Maya would need hidden state, direct API calls, database reads, or code inspection to know whether the customer action succeeded.

## Resume Rules

Resume only from a state Maya could naturally reach:

- the same visible Chrome page,
- a URL supplied by the user after payment or auth handoff,
- a normal sign-in route,
- dashboard/project/AI Studio navigation,
- a customer-visible saved-work surface.

When resuming:

1. Write the last reliable visible state.
2. Write what changed while paused, if known.
3. Re-enter Maya with the persona runtime card.
4. Take one customer-visible observation before acting.
5. Do not fill gaps with hidden state.

## Recovery Classifications

| Classification | Use When                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `resumable`    | The run can continue from a visible customer state without changing scope.                                           |
| `partial`      | The main browser work ended, but report publishing, verification, or a secondary check remains incomplete.           |
| `blocked`      | Auth, payment, budget, browser, production access, or owner approval prevents safe continuation.                     |
| `failed`       | The run violated SOP, used the wrong browser surface, lost essential notes/evidence, or produced unreliable results. |

## Evidence Rules

- Keep screenshots only when they prove the interruption, payment gate, credit state, output state, saved-work state, or Admin publish state.
- Do not keep routine screenshots of ordinary navigation.
- Redact or discard evidence that shows credentials, tokens, billing details, cookies, or private account-identifying information.

## Report Requirements

If a stop/resume event occurs, both reports must include:

- where the stop happened,
- why Maya stopped,
- whether the user or app resumed the run,
- what visible state Maya resumed from,
- whether the interruption changed trust, credit anxiety, save confidence, or review risk.
