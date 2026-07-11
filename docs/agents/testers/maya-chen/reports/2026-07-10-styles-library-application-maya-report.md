# Maya Report: I Could Find Styles, But I Could Not Use One

Date: 2026-07-10
Scenario: Choose a consistent visual style for Tiny Apartment Reset Kit.
Session duration: about 25 minutes.
Credits spent: 0
Run status: completed; later viewport correction changed the primary finding

## My Customer Journey

I wanted the apartment-reset images to look like they belonged together before I spent credits on another one. I opened my existing `Tiny Apartment Reset Kit` project and looked through Styles first because I assumed that was where I would choose the overall look.

The library initially only showed `None` and `Add style`, so I wondered whether styles were something I had to build myself. I tried `Restore built-ins`, and five choices appeared. `Digicam Photorealism` sounded closest to the believable, slightly imperfect renter content I want. Its detail window made me pause because it talked about styles being managed globally by ShortPulse and said admins could change previews from Agent Instructions. I do not know what Agent Instructions are, and that made the product feel like I had wandered into an employee setting.

I closed the detail window and went back to Create. When I clicked `Styles` beside the prompt, the button looked active, but no choices appeared in the part of the app I could see. I closed and opened it one more time because I assumed I had missed something. The same thing happened, so I did not generate anything.

After the run, we learned my Chrome window was only about 75% size. The Styles choices open in the right rail, and that rail was not visible in my workspace. My frustration was a real customer reaction, but this run did not prove the Styles control was broken.

## What I Was Thinking

- Are these styles included with my account, or am I supposed to make my own?
- Does restoring a built-in style change other people's accounts?
- Why am I being told what an admin can do?
- Did the Styles button open something off-screen?
- If I generate now, will it use Digicam Photorealism or no style at all?

I was relieved that restoring the built-ins did not cost anything. I was also annoyed because I had finally found a look that sounded right, but the actual creation screen would not let me choose it. I would rather stop than spend credits on an image with an unknown style.

## Product Decision Signal

- `Trust`: Weaker. The product exposed internal-sounding instructions and then failed at the point where I expected to apply the style.
- `Retention`: At risk if this happens again; style consistency is important to my content package.
- `Support`: High risk. I would ask whether my account is broken and whether the style was actually selected.
- `Revenue/Credits`: Directly blocked. I chose not to spend because the generation setup was ambiguous.
- `Launch readiness`: This run cannot judge style application reliability. It does show that a customer in a smaller desktop window may not realize the result opened off-screen.

## Customer Service Simulation

Support message I would send:

```text
Hi, I restored the built-in styles and can see Digicam Photorealism in the Styles Library, but when I go back to Create and click Styles nothing opens. The button highlights like it is open, but there are no choices. I tried closing and opening it again. Also the style page says admins can change previews in Agent Instructions, which I don't understand. Is my style actually selected? I don't want to spend credits until I know what it will use.
```

Review I might have written before learning the window was clipped:

```text
The app lets you browse styles but apparently not use them. The Styles button just lights up and shows nothing, and customer screens contain instructions for admins. I was not going to waste paid credits guessing whether a style was selected.
```

What would calm me down:

- Make the style choices visibly open from the Create screen.
- Show the selected style name before I generate.
- Remove internal Admin and Agent Instructions language from customer views.
- Confirm that restoring built-ins only changes my own library.

## What I Would Do Next

I would maximize Chrome and try again before contacting support or deciding the feature was broken. I still would not generate until the selected style was visible.

## Behavior Metrics

| Metric                           | Value         | Notes                                                          |
| -------------------------------- | ------------- | -------------------------------------------------------------- |
| Time to first confident step     | `~3 min`      | Opening the existing project and checking Styles felt natural. |
| Time to clear failure conclusion | `~18 min`     | Included library exploration and one normal retry.             |
| Clarifying questions             | `8`           | Mostly about inclusion, ownership, selection, and credit risk. |
| Backtracks                       | `3`           | Library to Create, close/reopen, and one retry.                |
| Dead ends                        | `1`           | The Create style picker never became usable.                   |
| Navigation confidence            | `3/5`         | The library was findable; applying a style was not.            |
| Style-selection confidence       | `0/5`         | No selected option or picker was visible.                      |
| Credit anxiety                   | `4/5`         | I stopped before spending on an unknown setup.                 |
| Spend readiness                  | `1/5`         | The broken control prevented generation.                       |
| Review risk                      | `high`        | Paid-credit uncertainty makes the failure feel serious.        |
| Customer support risk            | `high`        | Maya would contact support before continuing.                  |
| Retention risk                   | `medium-high` | The project can wait, but repeated failure would cause churn.  |

## Issue Tags

- `ai-studio`
- `styles`
- `broken-control`
- `customer-copy`
- `credit-confidence`

## Evidence

- [Styles expanded with no visible picker](assets/2026-07-10-styles-library-application/01-styles-expanded-no-picker.png)
- [Evidence manifest](assets/2026-07-10-styles-library-application/evidence-manifest.md)

## Admin Publish Status

Published successfully to Agent Tester Reports.

- External run id: `2026-07-10-styles-library-application`
- Stored row id: `9a38923f-25fe-46db-aecf-5df256e307e6`
- Maya did not access Admin; publishing was a separate authenticated system action.
