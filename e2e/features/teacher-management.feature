Feature: Teacher manages students and parents

  Scenario: Teacher adds a student
    Given a teacher is authenticated
    When the teacher adds a student named "Bilal Ahmed"
    Then the student "Bilal Ahmed" appears in the student list

  Scenario: Teacher adds a parent and links them to a student
    Given a teacher is authenticated
    And a student named "Hamza Raza" exists
    When the teacher adds a parent with a unique email and a WhatsApp number
    And the teacher links that parent to "Hamza Raza"
    Then the parent can log in and sees "Hamza Raza" only

  Scenario: Teacher deactivates a student
    Given a teacher is authenticated
    And a student named "Zain Ali" exists
    When the teacher deactivates "Zain Ali"
    Then the student is shown as inactive