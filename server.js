import express from "express";
import fs from "fs";
import crypto from "crypto";

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("public"));

const usersFile = "./data/users.json";
const OWNER_EMAIL = "hassanirtaza890@gmail.com";

function readUsers() {
  if (!fs.existsSync(usersFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.mkdirSync("./data", { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

app.post("/api/signup", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email aur password zaroori hai."
    });
  }

  const cleanEmail = email.toLowerCase().trim();
  const users = readUsers();

  if (users.some(u => u.email === cleanEmail)) {
    return res.status(400).json({
      error: "Account already exists."
    });
  }

  const isOwner =
    cleanEmail === OWNER_EMAIL.toLowerCase().trim();

  users.push({
    name: name.trim(),
    email: cleanEmail,
    password: hashPassword(password),
    credits: isOwner ? 999999 : 5,
    owner: isOwner
  });

  saveUsers(users);

  res.json({
    message: "Account created!",
    name: name.trim(),
    credits: isOwner ? 999999 : 5
  });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email aur password zaroori hai."
    });
  }

  const cleanEmail = email.toLowerCase().trim();
  const users = readUsers();

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

  const isOwner =
    user.email === OWNER_EMAIL.toLowerCase().trim();

  res.json({
    message: "Login successful!",
    name: user.name,
    email: user.email,
    credits: isOwner ? 999999 : user.credits,
    owner: isOwner
  });
});

app.post("/api/generate", async (req, res) => {
  try {
    const { email, productName, details } = req.body;

    if (!email) {
      return res.status(401).json({
        error: "Pehle login karo."
      });
    }

    const users = readUsers();

    const user = users.find(
      u => u.email === email.toLowerCase().trim()
    );

    if (!user) {
      return res.status(401).json({
        error: "User nahi mila."
      });
    }

    const isOwner =
      user.email === OWNER_EMAIL.toLowerCase().trim();

    if (!isOwner && user.credits <= 0) {
      return res.status(403).json({
        error: "Credits khatam ho gaye."
      });
    }

    const prompt = `
You are BizHelper AI, a professional business assistant.

User task:
${details}

Product:
${productName}

Create a useful, clear and professional answer.

Do not invent product specifications.
`;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.openrouter_api_key}`,
          "HTTP-Referer": "https://biz-helper-ai.vercel.app",
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

    if (!isOwner) {
      user.credits -= 1;
      saveUsers(users);
    }

    res.json({
      result,
      credits: isOwner ? 999999 : user.credits
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Online AI generation failed."
    });
  }
});

app.listen(port, () => {
  console.log(`BizHelper AI running at http://localhost:${port}`);
});
