const nav = document.getElementById("siteNav");
const menuToggle = document.getElementById("menuToggle");

if (nav && menuToggle) {
  menuToggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => nav.classList.remove("open"));
  });
}

const inquiryForm = document.getElementById("inquiryForm");
const formStatus = document.getElementById("formStatus");

if (inquiryForm && formStatus) {
  const presetCourse = new URLSearchParams(window.location.search).get("course");
  if (presetCourse && inquiryForm.course) {
    inquiryForm.course.value = presetCourse;
  }

  inquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    formStatus.className = "form-status";
    formStatus.textContent = "Submitting...";

    const formData = new FormData(inquiryForm);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not submit form.");
      }

      inquiryForm.reset();
      formStatus.classList.add("success");
      formStatus.textContent = result.message || "Inquiry sent successfully.";
    } catch (error) {
      formStatus.classList.add("error");
      formStatus.textContent = error.message || "Something went wrong.";
    }
  });
}
