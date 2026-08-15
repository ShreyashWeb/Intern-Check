// Curated Skills Dictionary for InternCheck V4
export const skillsDictionary = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Ruby", "PHP", 
  "Swift", "Kotlin", "Go", "Rust", "SQL", "HTML", "CSS", "C", "R", "Scala", "Perl",
  
  // Frameworks & Libraries
  "React", "Angular", "Vue", "Node.js", "Express", "Django", "Flask", 
  "Spring Boot", "Laravel", "Ruby on Rails", "FastAPI", "Next.js", 
  "Spring", "Hibernate", "jQuery", "Bootstrap", "Tailwind", "Redux",
  
  // Databases & Storage
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Oracle", "Firebase", "DynamoDB",
  
  // Tools, Cloud & Devops
  "Git", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Jenkins", 
  "GitHub", "GitLab", "Linux", "Figma", "Postman", "Jira", "Webpack", "Vite",
  
  // General & Business
  "Excel", "Word", "PowerPoint", "Canva", "Photoshop", "Illustrator",
  
  // Concepts
  "REST API", "GraphQL", "Microservices", "CI/CD", "Machine Learning", "Deep Learning", "OOP"
];

// Ambiguous short skill names that collide with common English words
const caseSensitiveSkills = ["Go", "R", "C"];

/**
 * Extracts skills from the provided text using the curated dictionary.
 * Avoids false-positives by enforcing custom word boundaries that handle special characters.
 * Matches ambiguous short skills (like "Go", "R", "C") case-sensitively.
 * 
 * @param {string} text Plain text content
 * @returns {string[]} List of matched skills
 */
export function extractSkills(text) {
  if (!text || typeof text !== 'string') return [];
  
  const matched = [];

  skillsDictionary.forEach(skill => {
    // 1. Determine case-sensitivity
    const isCaseSensitive = caseSensitiveSkills.includes(skill);
    const targetText = isCaseSensitive ? text : text.toLowerCase();
    const query = isCaseSensitive ? skill : skill.toLowerCase();

    // 2. Escape regex special characters in the skill name (e.g. C++ -> C\+\+)
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    // 3. Define boundary matching:
    // Preceded by: start of string or a character that is NOT alphanumeric, '+', or '#'
    // Followed by: end of string or a character that is NOT alphanumeric, '+', or '#'
    const regex = new RegExp(`(?<=^|[^a-zA-Z0-9+#])` + escapedQuery + `(?=$|[^a-zA-Z0-9+#])`, isCaseSensitive ? 'g' : 'gi');

    if (regex.test(targetText)) {
      matched.push(skill);
    }
  });

  return matched;
}
