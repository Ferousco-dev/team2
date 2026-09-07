-- PostgreSQL Schema for OpportunityHub

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    fullName VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    course VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opportunities (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    deadline DATE NOT NULL,
    requirements TEXT NOT NULL,
    stipend VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    opportunityId INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    course VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    motivation TEXT NOT NULL,
    resumePath VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_opportunity FOREIGN KEY (opportunityId) REFERENCES opportunities(id)
);


-- Seed Data
INSERT INTO opportunities (type, title, company, location, category, description, deadline, requirements, stipend) VALUES
('Internship', 'Software Engineering Intern', 'Google', 'Mountain View, CA', 'Tech', 'Join our team to work on cutting-edge software solutions.', '2026-12-31', 'Enrollment in CS degree\nProficiency in Python or Java\nStrong problem-solving skills', '$5000/month'),
('Full-time', 'Junior Frontend Developer', 'Meta', 'Remote', 'Tech', 'Help us build the next generation of social interaction.', '2026-11-30', 'Experience with React\nStrong CSS skills\nGood communication', '$80,000/year'),
('Internship', 'Marketing Intern', 'Nike', 'Portland, OR', 'Marketing', 'Gain experience in global brand marketing.', '2026-10-15', 'Enrolled in a Marketing or related degree\nCreative thinking\nAbility to work in a team', 'Unpaid (Travel expenses covered)'),
('Full-time', 'Data Analyst', 'Amazon', 'Seattle, WA', 'Data Science', 'Analyze customer data to improve shopping experience.', '2026-12-15', 'Degree in Statistics, Math or related field\nProficiency in SQL and R/Python\nExperience with data visualization tools', '$90,000/year');
