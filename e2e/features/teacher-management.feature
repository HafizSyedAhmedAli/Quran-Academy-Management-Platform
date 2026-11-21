Feature: Teacher manages students and parents

  As a teacher
  I want to add students, link parent accounts, and manage student active status
  So that enrollment records stay accurate and parents have controlled access to their child's portal

  Background:
    Given a teacher is authenticated

  Scenario: Teacher adds a student
    When the teacher adds a student named "Bilal Ahmed"
    Then the student "Bilal Ahmed" appears in the student list

  Scenario: Teacher adds a parent and links them to a student
    Given a student named "Hamza Raza" exists
    When the teacher adds a parent with a unique email and a WhatsApp number
    And the teacher links that parent to "Hamza Raza"
    Then the parent can log in and sees "Hamza Raza" only

  Scenario: Teacher deactivates a student
    Given a student named "Zain Ali" exists
    When the teacher deactivates "Zain Ali"
    Then the student is shown as inactive