"""
TalentLens AI - Resume Parser Service
Extracts skills, experience, projects, education from PDF/DOCX.
Does NOT extract name/email (comes from registration).
"""
import re
import json
from typing import Dict, Any, List

# Try imports gracefully for environments without heavy deps
try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False

try:
    from docx import Document
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False


# ─── Known Skills Dictionary ──────────────────────────────────────────────────
SKILLS_DB = {
    "programming": ["python", "javascript", "typescript", "java", "c++", "c#", "go", "rust", "ruby", "php", "swift", "kotlin", "scala", "r", "matlab"],
    "web": ["react", "vue", "angular", "nextjs", "nodejs", "express", "django", "fastapi", "flask", "spring", "laravel", "rails"],
    "data": ["pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras", "matplotlib", "seaborn", "spark", "hadoop"],
    "cloud": ["aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions", "ci/cd"],
    "database": ["mysql", "postgresql", "mongodb", "redis", "elasticsearch", "cassandra", "sqlite", "oracle", "dynamodb"],
    "tools": ["git", "linux", "bash", "jira", "confluence", "figma", "postman", "graphql", "rest api", "microservices"],
    "soft": ["leadership", "teamwork", "communication", "problem solving", "agile", "scrum", "project management"],
    "ai_ml": ["machine learning", "deep learning", "nlp", "computer vision", "llm", "gpt", "bert", "transformers", "reinforcement learning"],
    "blockchain": ["solidity", "web3", "ethereum", "polygon", "smart contracts", "defi", "nft"],
    "mobile": ["react native", "flutter", "android", "ios", "xamarin"],
}

ALL_SKILLS = []
for cat, skills in SKILLS_DB.items():
    ALL_SKILLS.extend(skills)

EDUCATION_KEYWORDS = [
    "bachelor", "master", "phd", "b.sc", "m.sc", "b.e", "m.e", "b.tech", "m.tech",
    "computer science", "information technology", "software engineering", "data science",
    "electrical", "mechanical", "civil", "mathematics", "physics", "mba"
]

SECTION_HEADERS = {
    "skills": ["skills", "technical skills", "core competencies", "technologies", "tools", "expertise"],
    "experience": ["experience", "work experience", "employment", "professional experience", "work history"],
    "education": ["education", "academic background", "qualifications", "academic qualifications"],
    "projects": ["projects", "personal projects", "academic projects", "key projects", "notable projects"],
}


def extract_text_from_pdf(filepath: str) -> str:
    if not HAS_PDF:
        return ""
    try:
        text = ""
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
        return text
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return ""


def extract_text_from_docx(filepath: str) -> str:
    if not HAS_DOCX:
        return ""
    try:
        doc = Document(filepath)
        return "\n".join([para.text for para in doc.paragraphs])
    except Exception as e:
        print(f"DOCX extraction error: {e}")
        return ""


def clean_text(text: str) -> str:
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    return text.strip()


def detect_sections(text: str) -> Dict[str, str]:
    lines = text.split('\n')
    sections = {"skills": "", "experience": "", "education": "", "projects": "", "other": ""}
    current_section = "other"

    for line in lines:
        line_lower = line.lower().strip()
        detected = False
        for section, keywords in SECTION_HEADERS.items():
            if any(kw in line_lower for kw in keywords) and len(line_lower) < 50:
                current_section = section
                detected = True
                break
        if not detected:
            sections[current_section] += line + "\n"

    return sections


def extract_skills(text: str) -> List[str]:
    text_lower = text.lower()
    found = set()
    for skill in ALL_SKILLS:
        if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
            found.add(skill.title())
    return list(found)[:30]  # Cap at 30 skills


def extract_experience_years(text: str) -> float:
    patterns = [
        r'(\d+)\+?\s*years?\s*(?:of\s*)?(?:experience|exp)',
        r'(\d{4})\s*[-–]\s*(?:present|current|\d{4})',
        r'(\d+)\s*yrs?\s*(?:experience)?',
    ]
    years_found = []
    for pattern in patterns:
        matches = re.findall(pattern, text.lower())
        for m in matches:
            try:
                val = int(m)
                if 1 <= val <= 50:
                    years_found.append(val)
                elif 2000 <= val <= 2025:
                    years_found.append(min(2025 - val, 20))
            except:
                pass

    if years_found:
        return min(max(years_found), 30)
    return 0.0


def extract_projects(text: str) -> List[str]:
    projects = []
    lines = text.split('\n')
    project_markers = ["developed", "built", "created", "designed", "implemented", "project:", "led", "architected"]
    for line in lines:
        line = line.strip()
        if not line:
            continue
        line_lower = line.lower()
        has_bullet = re.match(r'^[-•*]\s+.{10,}', line)
        has_verb = any(m in line_lower for m in project_markers) and len(line) > 15
        is_phrase = len(line) > 10 and len(line) < 150 and line[0].isupper()
        
        # Look for project-like patterns
        if has_bullet or has_verb or is_phrase:
            cleaned = re.sub(r'^[-•*]\s+', '', line).strip()
            if cleaned and 10 < len(cleaned) < 300:
                projects.append(cleaned)
                
    # Remove duplicates but preserve order
    seen = set()
    unique_projects = []
    for p in projects:
        if p not in seen:
            seen.add(p)
            unique_projects.append(p)
            
    return unique_projects[:10]


def extract_education(text: str) -> str:
    lines = text.split('\n')
    educations = []
    extended_keywords = EDUCATION_KEYWORDS + [
        "university", "college", "institute", "degree", 
        "diploma", "school", "academy", "certification"
    ]
    
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if any(kw in line_lower for kw in extended_keywords):
            cleaned = line.strip()
            if 5 < len(cleaned) < 200:
                ed_item = cleaned
                # Include next line for context (dates, major etc.)
                if i + 1 < len(lines):
                    next_line = lines[i+1].strip()
                    if 0 < len(next_line) < 100:
                        ed_item += " - " + next_line
                
                if not any(e in ed_item or ed_item in e for e in educations):
                    educations.append(ed_item)
                    
    return " | ".join(educations[:3]) if educations else ""


async def parse_resume(filepath: str, content_type: str) -> Dict[str, Any]:
    """Main parse function — returns structured JSON without name/email."""
    if "pdf" in content_type:
        raw_text = extract_text_from_pdf(filepath)
    else:
        raw_text = extract_text_from_docx(filepath)

    if not raw_text.strip():
        return {
            "skills": [], "experience_years": 0,
            "projects": [], "education": "", "raw_text": ""
        }

    cleaned = clean_text(raw_text)
    sections = detect_sections(cleaned)

    # Extract from specific sections + full text fallback
    skills_text = sections["skills"] + " " + cleaned
    skills = extract_skills(skills_text)

    experience_years = extract_experience_years(sections["experience"] + " " + cleaned)
    
    projects_text = sections["projects"]
    if not projects_text.strip():
        # Fallback to experience + raw if not found explicitly
        projects_text = sections["experience"] + " " + cleaned
    projects = extract_projects(projects_text)
    
    education = extract_education(sections["education"] + " " + cleaned)

    return {
        "skills": skills,
        "experience_years": experience_years,
        "projects": projects,
        "education": education,
        "raw_text": cleaned[:5000],  # Limit stored raw text
    }
