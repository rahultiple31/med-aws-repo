const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

const courses = [
  {
    id: "full-stack",
    title: "Full Stack Development",
    duration: "6 Months",
    mode: "Online + Offline",
    fee: "$399",
    description: "Learn HTML, CSS, JavaScript, Node.js, databases, and deployment."
  },
  {
    id: "data-science",
    title: "Data Science Foundations",
    duration: "4 Months",
    mode: "Online",
    fee: "$349",
    description: "Build practical skills in Python, data analysis, visualization, and ML basics."
  },
  {
    id: "ui-ux",
    title: "UI/UX Design",
    duration: "3 Months",
    mode: "Offline",
    fee: "$299",
    description: "Create user-centered interfaces, wireframes, prototypes, and design systems."
  },
  {
    id: "digital-marketing",
    title: "Digital Marketing",
    duration: "3 Months",
    mode: "Online + Offline",
    fee: "$279",
    description: "Master SEO, social ads, analytics, and campaign strategy for real businesses."
  }
];

const inquiryStore = [];

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(helmet());
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  res.locals.year = new Date().getFullYear();
  res.locals.currentPath = req.path;
  next();
});

app.get("/", (req, res) => {
  res.render("index", {
    pageTitle: "NetCircle Academy",
    courses: courses.slice(0, 3)
  });
});

app.get("/courses", (req, res) => {
  res.render("courses", {
    pageTitle: "Courses",
    courses
  });
});

app.get("/admissions", (req, res) => {
  res.render("admissions", { pageTitle: "Admissions" });
});

app.get("/contact", (req, res) => {
  res.render("contact", { pageTitle: "Contact" });
});

app.post("/api/inquiry", (req, res) => {
  const { name, email, phone, course, message } = req.body;

  if (!name || !email || !course) {
    return res.status(400).json({
      ok: false,
      error: "Name, email, and course are required."
    });
  }

  const inquiry = {
    id: inquiryStore.length + 1,
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone || "").trim(),
    course: String(course).trim(),
    message: String(message || "").trim(),
    createdAt: new Date().toISOString()
  };

  inquiryStore.push(inquiry);
  console.log("New inquiry:", inquiry);

  return res.status(201).json({
    ok: true,
    message: "Thanks! Our team will contact you shortly."
  });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

app.use((req, res) => {
  res.status(404).render("404", { pageTitle: "Page Not Found" });
});

app.listen(PORT, () => {
  console.log(`Academy site running on http://localhost:${PORT}`);
});
