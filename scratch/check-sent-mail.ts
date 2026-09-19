import { listUnreadImapMessages } from "../lib/integrations/providers/imap";
import { vaultDecrypt } from "../lib/crypto/vault";
import { prisma } from "../lib/prisma";
import { ImapFlow } from "imapflow";

async function main() {
  // Get credentials from Prisma
  const conn = await prisma.integrationConnection.findFirst({
    where: { provider: "GOOGLE", status: "CONNECTED" },
  });

  if (!conn || !conn.accountEmail || !conn.accessTokenEncrypted) {
    console.log("No connection found");
    return;
  }

  const appPassword = vaultDecrypt({
    version: conn.vaultVersion || 1,
    iv: conn.accessTokenIv,
    authTag: conn.accessTokenAuthTag,
    encryptedValue: conn.accessTokenEncrypted,
  });

  console.log("Checking Sent mailbox for:", conn.accountEmail);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: conn.accountEmail, pass: appPassword },
    logger: false,
  });

  await client.connect();

  // Check [Gmail]/Sent Mail
  const mailbox = await client.mailboxOpen("[Gmail]/Sent Mail");
  console.log("Sent mailbox message count:", mailbox.exists);

  // Get the last 3 sent messages
  const messages: any[] = [];
  for await (const msg of client.fetch(`${Math.max(1, mailbox.exists - 2)}:*`, {
    envelope: true,
    bodyStructure: true,
  })) {
    messages.push({
      uid: msg.uid,
      subject: msg.envelope?.subject,
      to: msg.envelope?.to?.map((t: any) => t.address).join(", "),
      date: msg.envelope?.date instanceof Date
        ? msg.envelope.date.toISOString()
        : String(msg.envelope?.date ?? ""),
    });
  }
  console.log("Recent sent messages:", JSON.stringify(messages, null, 2));

  await client.logout();
  await prisma.$disconnect();
}

main().catch(console.error);
