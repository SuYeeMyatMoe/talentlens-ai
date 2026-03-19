"""
TalentLens AI - Gemini Job Description Generator (Flash)
Generates professional job descriptions using a lean, fast prompt.
"""
import json
import re
from typing import Dict
from app.ai_modules.gemini_client import flash_generate

# Pre-built fast templates as instant fallback
_TEMPLATES = {
    "frontend":   ("We are seeking a talented Frontend Developer to build exceptional user interfaces. You'll collaborate with designers and backend engineers to deliver high-quality, responsive web applications.",
                   "- 2+ years React / Vue / Angular\n- Strong HTML5, CSS3, JavaScript (ES6+)\n- Experience with REST APIs and state management\n- Eye for UI/UX detail"),
    "backend":    ("We are looking for a skilled Backend Developer to design and build robust server-side systems. You'll work on APIs, databases, and scalable architecture.",
                   "- 2+ years Python / Node.js / Java\n- RESTful API design and database modeling\n- SQL/NoSQL proficiency (MySQL, PostgreSQL, MongoDB)\n- Cloud experience (AWS / GCP / Azure)"),
    "fullstack":  ("Join us as a Full Stack Developer and own features end-to-end. You'll work across the entire stack from React front-ends to FastAPI/Node back-ends.",
                   "- 3+ years full-stack development\n- Proficient in React + one backend framework\n- Database and API design experience\n- DevOps / CI/CD familiarity"),
    "data":       ("We are hiring a Data Scientist / ML Engineer to turn data into actionable insights and production models.",
                   "- Proficiency in Python (Pandas, NumPy, Scikit-learn)\n- Experience with ML frameworks (TensorFlow / PyTorch)\n- Strong statistics and mathematics background\n- SQL and data pipeline experience"),
    "devops":     ("We are seeking a DevOps / Platform Engineer to build and maintain our cloud infrastructure and CI/CD pipelines.",
                   "- Experience with Docker, Kubernetes, Terraform\n- CI/CD pipeline setup (GitHub Actions, Jenkins)\n- Cloud platforms (AWS / GCP / Azure)\n- Linux administration and scripting"),
    "mobile":     ("We need a Mobile Developer to craft beautiful native or cross-platform mobile experiences for iOS and Android.",
                   "- 2+ years React Native / Flutter / Swift / Kotlin\n- App Store / Play Store deployment experience\n- REST API integration and offline-first design\n- Performance optimization skills"),
    "default":    ("We are looking for a passionate {title} to join our growing team. You will contribute meaningfully to our mission and collaborate with a talented, diverse team.",
                   "- Proven experience in a {title} or similar role\n- Strong analytical and communication skills\n- Self-starter who thrives in fast-paced environments\n- Relevant degree or equivalent practical experience"),
}

def _quick_template(title: str) -> Dict[str, str]:
    """Return instant template-based JD — zero latency."""
    t = title.lower()
    key = "default"
    if any(x in t for x in ["frontend", "front-end", "react", "vue", "angular", "ui"]):
        key = "frontend"
    elif any(x in t for x in ["fullstack", "full stack", "full-stack"]):
        key = "fullstack"
    elif any(x in t for x in ["backend", "back-end", "python", "node", "java", "api"]):
        key = "backend"
    elif any(x in t for x in ["data", "machine learning", "ml", "ai", "scientist", "analyst"]):
        key = "data"
    elif any(x in t for x in ["devops", "cloud", "infrastructure", "platform", "sre"]):
        key = "devops"
    elif any(x in t for x in ["mobile", "ios", "android", "flutter", "react native"]):
        key = "mobile"
    desc, reqs = _TEMPLATES[key]
    return {
        "description": desc.replace("{title}", title),
        "requirements": reqs.replace("{title}", title),
    }


def generate_job_description(title: str) -> Dict[str, str]:
    """
    Generate job description using Gemini Flash with a very short prompt.
    Falls back instantly to templates if Gemini is slow or unavailable.
    """
    # Use a very lean prompt — fewer tokens = much faster response
    prompt = (
        f'Write a job posting for "{title}". '
        f'Return JSON only: {{"description":"<2 sentence role summary>","requirements":"<5 bullet points starting with ->"}}. '
        f'No explanation.'
    )

    raw = flash_generate(prompt)
    if raw:
        result = _parse_jd_response(raw)
        if result:
            return result

    # Instant fallback — no wait
    return _quick_template(title)


def _parse_jd_response(raw: str) -> Dict[str, str] | None:
    try:
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
        # Handle single-line JSON that may have trailing text
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            cleaned = match.group()
        data = json.loads(cleaned)
        desc = str(data.get("description", "")).strip()
        reqs = str(data.get("requirements", "")).strip()
        if desc and reqs:
            return {"description": desc, "requirements": reqs}
    except Exception as e:
        print(f"[JD Generator] parse error: {e}")
    return None
