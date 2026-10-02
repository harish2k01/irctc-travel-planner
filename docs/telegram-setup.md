# Telegram Reminders

## Administrator Setup

1. Open https://t.me/BotFather in Telegram and send `/newbot`.
2. Choose a display name and a unique username ending in `bot`. Use a dedicated bot for this RailWatch instance.
3. In RailWatch, open **Admin Settings > Integrations > Telegram**. Enter the bot username (without `@`) and the token from BotFather.
4. Select **Save Telegram Configuration**. RailWatch checks the token with `getMe` and registers an authenticated webhook automatically. Its public `APP_URL` must use HTTPS. If verification fails, credentials remain saved; correct them or select **Verify Telegram Connection** to retry.
5. Ensure **Booking Reminders** and **Telegram Reminders** are enabled under **Admin Settings > General**.

The token and webhook secret are encrypted at rest and never returned to browsers. A blank token field retains the saved token. Changing the bot token or username disconnects existing users; they must reconnect. This avoids sending reminders through an unintended bot after a credential change. The bot's webhook is owned by RailWatch, so do not share the same bot with another app that registers a webhook.

## Individual User Setup

1. Open **User Settings > Connections > Telegram Reminders**.
2. Select **Connect Telegram**, then **Open Telegram And Press Start**.
3. Press **Start** in the bot's private chat. The bot confirms the connection and enables booking reminders.
4. Return to RailWatch and select **Refresh Connection**, or wait for automatic refresh.
5. Select **Send Test Reminder** to verify delivery.

Connection links expire in ten minutes and can be used once. Keep the link private. No phone number or copied chat ID is required. Each Telegram chat can be linked to only one RailWatch account at a time. Use Disconnect on the original account before switching accounts.

Reminder times come from **User Settings > Preferences**, with routine and journey overrides. **Pause Reminders**, **Disconnect**, or `/stop` in Telegram stops future Telegram reminders. In-app reminders remain independent. Admin feature switches apply to both connection actions and worker delivery. The worker runs every minute and uses retry/deduplication records; as with other network providers, a failure after Telegram accepts a message but before the worker records success can cause a retry.

## Deployment

Apply migration `20261002000500_telegram` before upgrading the web app and worker. No separate Telegram pod or extra credentials in Kubernetes are needed; configuration is stored securely in the application database.

Official documentation: https://core.telegram.org/bots/features#deep-linking and https://core.telegram.org/bots/api#setwebhook.
