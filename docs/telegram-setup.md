# Telegram Reminders

RailWatch uses outbound HTTPS requests only. The existing worker reads bot messages with Telegram's getUpdates API and sends reminders with sendMessage. No public webhook, public domain, incoming port, or separate bot pod is needed for pairing. Use a dedicated bot; another app must not poll it or register a webhook.

## Administrator Setup

1. Open https://t.me/BotFather and send `/newbot`.
2. Choose a display name and a unique username ending in `bot`.
3. Open **Admin Settings > Integrations > Telegram**, enter the username (without `@`) and bot token, then select **Save Telegram Configuration**.
4. RailWatch verifies the bot and removes any previous webhook without discarding pending messages. **Verify Telegram Connection** retries this operation and shows its result. The worker also automatically moves previously verified installations from webhooks to polling.
5. Enable **Booking Reminders** and **Telegram Reminders** under **Admin Settings > General**.

Tokens and login secrets are encrypted in the database and never returned to browsers. Blank secret fields retain saved credentials. Changing the bot token or username disconnects users; they must reconnect. Changing only login credentials preserves existing reminder connections and invalidates pending authorization attempts.

## Optional Telegram Authorization

To enable **Connect With Telegram**, open the bot's **Login Widget** settings in BotFather. Register your RailWatch origin and the **Telegram Login Callback URL** shown in Admin Settings. Enter the Login Client ID and Secret in RailWatch, then save. Keep Telegram's default RS256 signing algorithm.

The callback is reached by the user's browser after consent, not by a Telegram server webhook. Authorization needs a URL accepted and registered with Telegram and an APP_URL that matches the browser address. For local-only installations or unsupported redirect URLs, use pairing codes. RailWatch requests profile identity and permission for the bot to send messages, without requesting a phone number. It links to the already signed-in RailWatch account; it does not create a new account or replace RailWatch login.

## Individual User Setup

Open **User Settings > Connections > Telegram Reminders** and choose either:

- **Connect With Telegram**: authorize on Telegram's screen. The browser returns to RailWatch and opens Connections with a success or failure message.
- **Pair With Code**: copy the displayed `/connect XXXX-XXXX-XXXX` command and send it in the bot's private chat. The command expires in ten minutes and works once. Do not send a plain `/start`; the bot now explains how to pair. The worker checks every minute, and the settings panel checks for connection automatically.

Select **Send Test Reminder** after connecting. **Refresh Connection** always reports whether the account is linked. One Telegram chat can belong to one RailWatch account at a time; disconnect the original account before switching.

Reminder times come from **User Settings > Preferences**, with routine and journey overrides. **Pause Reminders**, **Disconnect**, or `/stop` in the bot chat stops Telegram reminders. In-app reminders are independent. Feature switches apply to both pairing and worker delivery.

## Deployment

Apply migration `20261002000600_telegram_login` before upgrading the web app and worker. Pending authorization state and PKCE verifiers expire after ten minutes; verifiers are encrypted. Polling has a database lease and an encrypted update cursor so concurrent workers do not read the same batch. Network failure after Telegram accepts a reply but before its cursor is recorded can produce a repeated reply.

Official documentation: https://core.telegram.org/bots/telegram-login and https://core.telegram.org/bots/api#getupdates.
