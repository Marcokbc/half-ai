const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  const { action, pull_request } = req.body;

  if (action === "opened" || action === "synchronize") {
    await analisarPR(pull_request);
  }

  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

async function analisarPR(pullRequest) {
  const { title, body, html_url, head } = pullRequest;
  const diffUrl = head.repo.diff_url;

  const diffResponse = await axios.get(diffUrl, {
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
  });

  const diff = diffResponse.data;

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-chat:free",
      messages: [
        { role: "system", content: "Você é um revisor de código experiente." },
        {
          role: "user",
          content: `Revise este Pull Request e diga se aprovaria ou não:\n${diff}`,
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

  await axios.post(
    `${pullRequest.comments_url}`,
    { body: `### Feedback Automático:\n${feedback}` },
    { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
  );
}
