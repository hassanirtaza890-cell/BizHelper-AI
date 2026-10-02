import express from "express";
import crypto from "crypto";
import fs from "fs";

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("."));

const usersFile = "./data/users.json";

const OWNER_EMAIL = "hassanirtaza890@gmail.com";

function readUsers() {
  if (!fs.existsSync(usersFile)) return [];
  return JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}


// SIGNUP
app.post("/api/signup", (req, res) => {

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, email aur password zaroori hai."
    });
  }

  const cleanEmail = email.toLowerCase();
  const users = readUsers();

  if (users.some(u => u.email === cleanEmail)) {
    return res.status(400).json({
      error: "Account already exists."
    });
  }

  const isOwner =
    cleanEmail === OWNER_EMAIL.toLowerCase();

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


// LOGIN
app.post("/api/login", (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email aur password zaroori hai."
    });
  }

  const users = readUsers();

  const user = users.find(
    u =>
      u.email === email.toLowerCase() &&
      u.password === hashPassword(password)
  );

  if (!user) {
    return res.status(401).json({
      error: "Email ya password ghalat hai."
    });
  }

  const isOwner =
    user.email === OWNER_EMAIL.toLowerCase();

  res.json({
    message: "Login successful!",
    name: user.name || user.email.split("@")[0],
    email: user.email,
    credits: isOwner ? 999999 : user.credits,
    owner: isOwner
  });
});


// AI GENERATE
app.post("/api/generate", async (req, res) => {

  try {

    const {
      email,
      productName,
      details
    } = req.body;

    if (!email) {
      return res.status(401).json({
        error: "Pehle login karo."
      });
    }

    const users = readUsers();

    const user = users.find(
      u => u.email === email.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        error: "User nahi mila."
      });
    }

    const isOwner =
      user.email === OWNER_EMAIL.toLowerCase();

    if (!isOwner && user.credits <= 0) {
      return res.status(403).json({
        error: "Credits khatam ho gaye."
      });
    }

    const response = await fetch(
      "http://localhost:11434/api/generate",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          model: "llama3.2:3b",

          prompt: `Create useful business content for:

Product: ${productName}

Details:
${details}

Do not invent product specifications.`,

          stream: false
        })
      }
    );

    const data = await response.json();

    if (!data.response) {
      return res.status(500).json({
        error: "AI response nahi mili."
      });
    }

    if (!isOwner) {
      user.credits -= 1;
      saveUsers(users);
    }

    res.json({
      result: data.response,
      credits: isOwner ? 999999 : user.credits
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Local AI generation failed."
    });
  }
});


app.listen(port, () => {
  console.log(
    `BizHelper AI running at http://localhost:${port}`
  );
});
