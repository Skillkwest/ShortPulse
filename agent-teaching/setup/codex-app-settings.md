# Codex App Settings

Purpose: set Codex up for local repo work before training agents.

## 1. General Work Mode And Permissions

Open `Settings -> General`.

Set:
- Work mode: `For coding`
- Default permissions: `On`
- Auto-review: `On`
- Full access: `On`

![General work mode and permissions](../assets/codex-settings-setup/01-general-work-mode-and-permissions.png)

## 2. General Operating Preferences

In `Settings -> General`, set:
- Default open destination: `VS Code`
- Prevent sleep while running: `On`

![General open destination and prevent sleep](../assets/codex-settings-setup/02-general-open-destination-and-prevent-sleep.png)

## 3. General Chat Behavior

In `Settings -> General`, set:
- Require Cmd + Enter to send long prompts: `Off`
- Speed: `Standard`
- Follow-up behavior: `Queue`
- Code review: `Inline`
- Suggested prompts: `On`

![General speed follow-ups and suggested prompts](../assets/codex-settings-setup/03-general-speed-followups-suggested-prompts.png)

## 4. Configuration Defaults

Open `Settings -> Configuration`.

Set:
- Approval policy: `On request`
- Sandbox settings: `Read only`

These are the app defaults. Individual sessions can still be elevated later when needed.

![Configuration default approval and sandbox](../assets/codex-settings-setup/04-configuration-default-approval-and-sandbox.png)

## 5. MCP Servers

Open `Settings -> MCP servers`.

Enable the servers you actually use for the project. In the current teaching setup, the visible enabled examples are:
- `openaiDeveloperDocs`
- `playwright`
- `stripe`

Use `Add server` when a new external tool is required.

![MCP servers](../assets/codex-settings-setup/05-mcp-servers.png)

## 6. Browser Use

Open `Settings -> Browser use`.

Set:
- Browser Use plugin: enabled
- Approval: `Always ask`
- History: `Always ask`

![Browser use](../assets/codex-settings-setup/06-browser-use.png)

## 7. Computer Use

Open `Settings -> Computer use`.

Set:
- Computer Use plugin: enabled

![Computer use](../assets/codex-settings-setup/07-computer-use.png)

## 8. Session Controls In The Composer

Before starting a run, verify the composer controls:
- Access mode: `Full access`
- Model: `5.4 High` or above

These controls are set per working session, not only in app settings.

![Composer session controls](../assets/codex-settings-setup/08-home-composer-session-controls.png)

## Practical Note

The app defaults are the base layer. The composer session controls are the run-time layer. Check both before training or automating an agent.
