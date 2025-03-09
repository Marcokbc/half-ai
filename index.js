const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const { action, pull_request } = req.body;

  if (action === "opened" || action === "synchronize") {
    await analyzePullRequest(pull_request);
  }

  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function analyzePullRequest(pullRequest) {
  const { title, diff_url } = pullRequest;

  const diffResponse = await axios.get(diff_url, {
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
  });

  const diff = diffResponse.data;

  const response = await axios.post(
    process.env.OPENROUTER_URL,
    {
      model: "deepseek/deepseek-chat:free",
      messages: [
        { role: "system", content: "You are an experienced code reviewer." },
        {
          role: "user",
          content: `Review this Pull Request and provide structured feedback on style, security, and performance. Indicate whether the PR should be approved or not.
${diff}`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const feedback = response.data.choices[0].message.content;

  const formattedFeedback = `📄 **File Review:** ${title}

🎨 **StyleAgent:**
${extractFeedbackSection(feedback, "StyleAgent")}

🔒 **SecurityAgent:**
${extractFeedbackSection(feedback, "SecurityAgent")}

⚡️ **PerformanceAgent:**
${extractFeedbackSection(feedback, "PerformanceAgent")}

✅ **TechLead Decision:** ${extractApprovalDecision(feedback)}`;

  await axios.post(
    pullRequest.comments_url,
    { body: formattedFeedback },
    { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
  );
}

function extractFeedbackSection(feedback, section) {
  const regex = new RegExp(`(?<=${section}:).*?(?=🔒|⚡️|✅|$)`, "s");
  const match = feedback.match(regex);
  return match ? match[0].trim() : "No specific feedback provided.";
}

function extractApprovalDecision(feedback) {
  return feedback.includes("approved") ? "PR Approved." : "PR Needs Changes.";
}
