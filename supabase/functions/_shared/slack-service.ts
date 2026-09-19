/**
 * supabase/functions/_shared/slack-service.ts
 *
 * Optional Slack notification sender for team awareness on incoming support requests.
 */

export interface SlackNotificationPayload {
  webhookUrl?: string | null;
  channelId?: string | null;
  botToken?: string | null;
  businessName: string;
  sender: string;
  subject: string;
  classification: string;
  confidence: number;
  actionTaken: "AUTO_REPLIED" | "ESCALATED" | "SKIPPED" | "FAILED";
  summaryOrReasoning?: string;
  threadUrl?: string;
}

function getEnv(key: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env?.get) {
    return Deno.env.get(key);
  }
  if (typeof process !== "undefined" && process?.env) {
    return process.env[key];
  }
  return undefined;
}

export async function sendSlackNotification(payload: SlackNotificationPayload): Promise<boolean> {
  const webhookUrl =
    payload.webhookUrl ||
    getEnv("SLACK_WEBHOOK_URL") ||
    getEnv("SLACK_SUPPORT_WEBHOOK_URL");

  const botToken = payload.botToken || getEnv("SLACK_BOT_TOKEN");
  const channelId = payload.channelId || getEnv("SLACK_CHANNEL_ID");

  const actionEmoji =
    payload.actionTaken === "AUTO_REPLIED"
      ? "🤖 ✅"
      : payload.actionTaken === "ESCALATED"
      ? "⚠️ 🙋"
      : payload.actionTaken === "FAILED"
      ? "❌"
      : "ℹ️";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${actionEmoji} Gmail Support: ${payload.actionTaken}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Business:*\n${payload.businessName}` },
        { type: "mrkdwn", text: `*Customer:*\n${payload.sender}` },
        { type: "mrkdwn", text: `*Subject:*\n${payload.subject}` },
        { type: "mrkdwn", text: `*Intent:*\n${payload.classification} (${Math.round(payload.confidence * 100)}%)` },
      ],
    },
  ];

  if (payload.summaryOrReasoning) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Details:*\n>${payload.summaryOrReasoning.replace(/\n/g, "\n>")}`,
      },
    } as any);
  }

  try {
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });
      return res.ok;
    }

    if (botToken && channelId) {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: channelId, blocks }),
      });
      return res.ok;
    }

    // Neither webhook nor bot token configured; no-op
    return true;
  } catch (err) {
    console.error("Failed to send Slack notification:", err);
    return false;
  }
}
