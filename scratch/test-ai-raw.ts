import { generateGroundedReply } from "../lib/ai/support-engine";

async function test() {
  const result = await generateGroundedReply(
    {
      id: "11",
      threadId: "test",
      subject: "hello",
      sender: "lifestylebeam@gmail.com",
      recipient: "vivecode999@gmail.com",
      date: new Date().toISOString(),
      bodyText: "this is a test mail to know the timing of your work",
      bodyHtml: "<p>this is a test mail to know the timing of your work</p>",
    },
    {
      business_id: "default",
      tone: "professional",
      working_hours: "Monday to Saturday, 9:00 AM to 7:00 PM IST",
      support_policies: "We respond to all customer inquiries within 24 hours.",
      auto_reply_enabled: true,
      confidence_threshold: 0.65,
    } as any,
    []
  );
  console.log("Generate Result:", result);
}

test().catch(console.error);
