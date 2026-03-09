"""
TalentLens AI - Synthetic Data Generator
Generates 1000 realistic candidate accounts + resumes for testing.

Usage:
  cd backend
  pip install faker
  python ../synthetic_data/generate_data.py
"""
import json
import random
import hashlib
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from faker import Faker
from passlib.context import CryptContext

fake = Faker()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

SKILLS_POOL = {
    "backend": ["Python", "Java", "Go", "Node.Js", "Django", "Fastapi", "Spring", "Express"],
    "frontend": ["React", "Vue", "Angular", "Typescript", "Nextjs", "Tailwindcss"],
    "data": ["Pandas", "Numpy", "Scikit-Learn", "Tensorflow", "Pytorch", "Spark", "Sql"],
    "cloud": ["Aws", "Docker", "Kubernetes", "Gcp", "Azure", "Terraform", "Ci/Cd"],
    "database": ["Mysql", "Postgresql", "Mongodb", "Redis", "Elasticsearch"],
    "tools": ["Git", "Linux", "Rest Api", "Graphql", "Agile", "Jira"],
    "ai_ml": ["Machine Learning", "Deep Learning", "Nlp", "Computer Vision"],
    "soft": ["Leadership", "Communication", "Problem Solving", "Teamwork"],
}

EDUCATIONS = [
    "Bachelor of Computer Science", "Bachelor of Information Technology",
    "Master of Computer Science", "Bachelor of Software Engineering",
    "Bachelor of Electrical Engineering", "Master of Data Science",
    "Bachelor of Mathematics", "Bachelor of Computer Engineering",
    "PhD in Computer Science", "Associate Degree in Information Systems",
]

PROJECTS_TEMPLATES = [
    "E-commerce Platform with React and Node.js",
    "Machine Learning Fraud Detection System",
    "Real-time Chat Application using WebSocket",
    "AI-powered Resume Analyzer",
    "Microservices Architecture with Docker and Kubernetes",
    "Blockchain Voting System on Ethereum",
    "Image Classification with CNN",
    "RESTful API for Social Media Platform",
    "Data Pipeline with Apache Spark",
    "NLP Sentiment Analysis Tool",
    "Full-Stack Dashboard with Charts",
    "Mobile App with React Native",
    "Cloud-native Serverless Application on AWS",
    "DevOps CI/CD Pipeline with GitHub Actions",
    "Recommendation Engine with Collaborative Filtering",
]

JOB_TITLES = [
    "Senior Full Stack Developer",
    "Machine Learning Engineer",
    "Backend Engineer",
    "Frontend Developer",
    "Data Scientist",
    "DevOps Engineer",
    "Cloud Architect",
]


def generate_candidate(idx):
    """Generate one realistic candidate account."""
    # Pick a random skill profile
    categories = random.sample(list(SKILLS_POOL.keys()), random.randint(2, 5))
    skills = []
    for cat in categories:
        skills.extend(random.sample(SKILLS_POOL[cat], random.randint(1, min(3, len(SKILLS_POOL[cat])))))

    skills = list(set(skills))[:random.randint(5, 15)]
    experience = round(random.uniform(0, 12), 1)
    n_projects = random.randint(0, 5)
    projects = random.sample(PROJECTS_TEMPLATES, n_projects)

    return {
        "name": fake.name(),
        "email": f"candidate{idx+1}@{fake.free_email_domain()}",
        "password": "Test@12345",
        "role": "candidate",
        "resume": {
            "skills": skills,
            "experience_years": experience,
            "projects": projects,
            "education": random.choice(EDUCATIONS),
        }
    }


def generate_jobs():
    return [
        {
            "title": title,
            "description": f"We are looking for a talented {title} to join our growing team.",
            "requirements": f"Required: {', '.join(random.sample(list(SKILLS_POOL['backend']) + list(SKILLS_POOL['frontend']) + list(SKILLS_POOL['tools']), 6))}",
            "deadline": "2025-12-31",
            "published": True,
        }
        for title in JOB_TITLES
    ]


def save_data():
    candidates = [generate_candidate(i) for i in range(1000)]
    jobs = generate_jobs()

    output = {
        "candidates": candidates,
        "jobs": jobs,
        "stats": {
            "total_candidates": len(candidates),
            "avg_experience": round(sum(c["resume"]["experience_years"] for c in candidates) / len(candidates), 1),
            "total_jobs": len(jobs),
        }
    }

    os.makedirs("synthetic_data", exist_ok=True)
    with open("synthetic_data/dataset.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"✅ Generated {len(candidates)} candidates and {len(jobs)} jobs")
    print(f"   Avg experience: {output['stats']['avg_experience']} years")
    print("   Saved to: synthetic_data/dataset.json")

    # Also generate SQL insert file
    with open("synthetic_data/seed.sql", "w") as f:
        f.write("USE talentlens;\n\n-- Seed Candidates\n")
        for c in candidates[:100]:  # First 100 as SQL
            ph = pwd_ctx.hash(c["password"])
            f.write(f"INSERT IGNORE INTO users (name, email, password_hash, role) VALUES "
                    f"('{c['name'].replace(chr(39), '')}', '{c['email']}', '{ph}', 'candidate');\n")
        f.write("\n-- Seed Jobs\n")
        for j in jobs:
            f.write(f"INSERT IGNORE INTO jobs (title, description, requirements, deadline, created_by, published) VALUES "
                    f"('{j['title']}', '{j['description']}', '{j['requirements']}', '{j['deadline']}', 1, 1);\n")

    print("   Seed SQL saved to: synthetic_data/seed.sql")


if __name__ == "__main__":
    save_data()
