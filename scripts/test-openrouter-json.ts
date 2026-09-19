import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const apiKey = (process.env.GMAIL_SUPPORT_AI_API_KEY || "").trim();
  const baseUrl = (process.env.GMAIL_SUPPORT_AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const model = process.env.GMAIL_SUPPORT_AI_MODEL || "openrouter/free";

  console.log("Calling OpenRouter with model:", model);

  // Test 1: With response_format
  console.log("\n--- Test 1: WITH response_format ---");
  try {
    const res1 = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a support bot. Respond strictly in JSON: {\"isSupport\": true, \"classification\": \"CUSTOMER_SUPPORT\"}" },
          { role: "user", content: "hello" },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const json1 = await res1.json();
    console.log("Status:", res1.status);
    console.log("Choice content:", JSON.stringify(json1.choices?.[0]?.message?.content));
    console.log("Full choice:", JSON.stringify(json1.choices?.[0]));
  } catch (e: any) {
    console.error("Test 1 error:", e.message);
  }

  // Test 2: WITHOUT response_format
  console.log("\n--- Test 2: WITHOUT response_format ---");
  try {
    const res2 = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a support bot. Respond strictly in JSON: {\"isSupport\": true, \"classification\": \"CUSTOMER_SUPPORT\"}" },
          { role: "user", content: "hello" },
        ],
      }),
    });
    const json2 = await res2.json();
    console.log("Status:", res2.status);
    console.log("Choice content:", JSON.stringify(json2.choices?.[0]?.message?.content));
    console.log("Full choice:", JSON.stringify(json2.choices?.[0]));
  } catch (e: any) {
    console.error("Test 2 error:", e.message);
  }
}

main().catch(console.error);
