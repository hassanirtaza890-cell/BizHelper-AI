import express from "express";
import crypto from "crypto";

const app = express();

app.use(express.json());

const users = [];

const OWNER_EMAIL = "hassanirtaza890@gmail.com";

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

app.get("/", (req, res) => {
  res.json({
    message: "BizHelper AI is running!"
  });
});

app.post("/signup", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email aur password zaroori hai."
    });
  }

  const cleanEmail = email.toLowerCase().trim();

  if (users.some(u => u.email === cleanEmail)) {
    return res.status(400).json({
      error: "Account already exists."
    });
  }

  const isOwner =
    cleanEmail === OWNER_EMAIL.toLowerCase().trim();

  const user = {
    name: name.trim(),
    email: cleanEmail,
    password: hashPassword(password),
    credits: isOwner ? 999999 : 5,
    owner: isOwner
  };

  users.push(user);

  res.json({
    message: "Account created!",
    name: user.name,
    email: user.email,
    credits: user.credits,
    owner: user.owner
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email aur password zaroori hai."
    });
  }

  const cleanEmail = email.toLowerCase().trim();

  const user = users.find(
    u =>
      u.email === cleanEmail &&
      u.password === hashPassword(password)
  );

  if (!user) {
    return res.status(401).json({
      error: "Email ya password ghalat hai."
    });
  }

  res.json({
    message: "Login successful!",
    name: user.name,
    email: user.email,
    credits: user.credits,
    owner: user.owner
  });
});

app.post("/generate", async (req, res) => {
  try {
    const { email, productName, details } = req.body;

    const user = users.find(
      u => u.email === email?.toLowerCase().trim()
    );

    if (!user) {
      return res.status(401).json({
        error: "Pehle login karo."
      });
    }

    if (!user.owner && user.credits <= 0) {
      return res.status(403).json({
        error: "Credits khatam ho gaye."
      });
    }

    const prompt = `
You are BizHelper AI, a professional business assistant.

Product:
${productName}

Task:
${details}

Give a useful, clear and professional answer.

Do not invent product specifications.
`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${process.env.openrouter_api_key}`,
          "HTTP-Referer":
            "https://biz-helper-ai.vercel.app",
          "X-Title": "BizHelper AI"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(data);

      return res.status(500).json({
        error: "OpenRouter AI error."
      });
    }

    const result =
      data.choices?.[0]?.message?.content;

    if (!result) {
      return res.status(500).json({
        error: "AI response nahi mili."
      });
    }

    if (!user.owner) {
      user.credits -= 1;
    }

    res.json({
      result,
      credits: user.owner ? 999999 : user.credits
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Online AI generation failed."
    });
  }
});

export default app;
